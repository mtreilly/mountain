import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const ORIGIN = "https://mountaintoclimb.com";
const SNAPSHOT_FILE = ".indexnow-before.json";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

type Snapshot = Record<string, string>;

function indexNowKey(): string {
  const filename = readdirSync("public").find((file) => /^[a-f0-9]{32}\.txt$/.test(file));
  if (!filename) throw new Error("IndexNow key file is missing from public/");
  const key = filename.slice(0, -4);
  if (readFileSync(`public/${filename}`, "utf8").trim() !== key) {
    throw new Error("IndexNow key file does not contain its filename key");
  }
  return key;
}

async function get(url: string): Promise<Response> {
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response;
}

function canonicalHtmlUrl(url: string): boolean {
  const parsed = new URL(url);
  return (
    parsed.origin === ORIGIN &&
    !parsed.search &&
    !parsed.hash &&
    (parsed.pathname === "/" ||
      parsed.pathname === "/methodology" ||
      /^\/compare\/[^/]+\/[^/]+$/.test(parsed.pathname))
  );
}

async function snapshot(): Promise<Snapshot> {
  const xml = await (await get(`${ORIGIN}/sitemap.xml`)).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .filter(canonicalHtmlUrl);
  if (!urls.includes(`${ORIGIN}/`)) throw new Error("Sitemap does not list the homepage");

  const result: Snapshot = {};
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        const response = await get(url);
        if (!response.headers.get("content-type")?.includes("text/html")) {
          throw new Error(`${url} is not HTML`);
        }
        const html = await response.text();
        if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
          throw new Error(`${url} is noindex but listed in the sitemap`);
        }
        result[url] = createHash("sha256").update(html).digest("hex");
      }
    }),
  );

  // A data refresh changes the interactive homepage even if its HTML shell is identical.
  const manifest = await (await get(`${ORIGIN}/data-manifest.json`)).text();
  result[`${ORIGIN}/`] = createHash("sha256")
    .update(result[`${ORIGIN}/`])
    .update(manifest)
    .digest("hex");
  return result;
}

async function notify(before: Snapshot, after: Snapshot): Promise<void> {
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (url) => before[url] !== after[url],
  );
  if (changed.length === 0) {
    console.log("IndexNow: no canonical page changes");
    return;
  }

  const key = indexNowKey();
  const keyResponse = await get(`${ORIGIN}/${key}.txt`);
  if ((await keyResponse.text()).trim() !== key) {
    throw new Error("Deployed IndexNow key file has the wrong content");
  }
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: "mountaintoclimb.com", key, urlList: changed }),
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow rejected ${changed.length} URLs: HTTP ${response.status}`);
  }
  console.log(
    `IndexNow: submitted ${changed.length} changed canonical URLs (HTTP ${response.status})`,
  );
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "before") {
    const current = await snapshot();
    writeFileSync(SNAPSHOT_FILE, JSON.stringify(current));
    console.log(`IndexNow: captured ${Object.keys(current).length} live canonical pages`);
  } else if (command === "after") {
    const before = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as Snapshot;
    const after = await snapshot();
    await notify(before, after);
    unlinkSync(SNAPSHOT_FILE);
  } else {
    throw new Error("Usage: tsx scripts/indexnow.ts before|after");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
