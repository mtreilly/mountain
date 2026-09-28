import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { convergenceOutcome } from "../src/lib/convergenceModel";
import { parseShareStateFromSearch } from "../src/lib/shareState";
import { CURATED_PAIRS } from "../worker/_lib/curatedPairs";
import { loadPairOutcome } from "../worker/_lib/pairOutcome";
import { computeRequiredGrowth, computeScenario, isFailure } from "../worker/_lib/scenario";
import worker from "../worker/index";

// The worker reads the data snapshot through ASSETS; serve public/ from disk.
const env = {
  ASSETS: {
    fetch: async (input: Request | URL | string) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      try {
        const body = readFileSync(join("public", url.pathname));
        const type = url.pathname.endsWith(".json") ? "application/json" : "text/plain";
        return new Response(body, { headers: { "content-type": type } });
      } catch {
        return new Response("not found", { status: 404 });
      }
    },
  },
};
const ORIGIN = "https://mountaintoclimb.com";
const get = (path: string, headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`${ORIGIN}${path}`, { headers }), env as never);
interface ApiBody {
  error: { code: string };
  summary: string;
  convergence: { year: number | null };
  convergence_year: number | null;
  scenario: { projection_start_year: number; chaser_growth_basis: string };
  series: { observed: unknown[]; projection: unknown[] };
  latest: { year: number };
  links: { app: string };
  caveats: Array<{ iso: string; applied: boolean }>;
}
const json = async (path: string) => (await get(path)).json() as Promise<ApiBody>;

async function testScenarioMatchesShareModel() {
  const path = "/api/convergence?chaser=POL&target=GBR&growth_rate=0.04&target_growth_rate=0.01";
  const body = await json(path);
  const shared = await loadPairOutcome(
    env as never,
    `${ORIGIN}/share`,
    parseShareStateFromSearch(
      "?chaser=POL&target=GBR&indicator=GDP_PCAP_PPP&cg=0.040&tg=0.010&adjC=0&adjT=0",
    ),
  );
  assert.equal(body.convergence.year, shared.outcome?.convergenceYear, "API vs share year");
  assert.equal(body.convergence_year, body.convergence.year, "legacy field mirrors new field");
  assert.equal(body.scenario.projection_start_year, shared.outcome?.start.year, "start year");
  assert.ok(body.summary.includes("not a forecast"), "summary frames a scenario");
  assert.ok(body.series.observed.length > 5 && body.series.projection.length > 3, "series");
  assert.equal(body.latest.year, shared.handoff?.year, "latest shared year");
  assert.ok(body.links.app.includes("chaser=POL") && body.links.app.includes("adjC=0"), "app link");
}

async function testRequiredGrowthRoundTrips() {
  const result = await computeRequiredGrowth(env as never, `${ORIGIN}/x`, {
    chaser: "ROU",
    target: "DEU",
    indicator: "GDP_PCAP_PPP",
    adjusted: false,
    byYear: 2040,
    targetRate: 0.012,
  });
  assert.ok(!isFailure(result));
  const rate = result.requiredChaserRate;
  assert.ok(rate != null && rate > 0);
  const scenario = await computeScenario(env as never, `${ORIGIN}/x`, {
    chaser: "ROU",
    target: "DEU",
    indicator: "GDP_PCAP_PPP",
    chaserRate: rate,
    targetRate: 0.012,
    baseYear: 2023,
    adjusted: false,
  });
  assert.ok(!isFailure(scenario));
  assert.ok(
    Math.abs((scenario.outcome.convergenceYear ?? 0) - 2040) <= 1,
    `required growth converges by 2040, got ${scenario.outcome.convergenceYear}`,
  );

  const past = await json("/api/required-growth?chaser=ROU&target=DEU&by_year=2020");
  assert.equal(past.error.code, "INVALID_YEAR");
}

async function testApiValidation() {
  const cases: Array<[string, number, string]> = [
    ["/api/convergence?chaser=POL", 400, "MISSING_PARAMS"],
    ["/api/convergence?chaser=PO&target=GBR", 400, "INVALID_COUNTRY"],
    ["/api/convergence?chaser=POL&target=GBR&growth_rate=5", 400, "INVALID_GROWTH_RATE"],
    ["/api/convergence?chaser=ZZZ&target=GBR", 404, "COUNTRY_NOT_FOUND"],
    ["/api/convergence?chaser=POL&target=GBR&indicator=NOPE", 404, "INDICATOR_NOT_FOUND"],
    ["/api/compare?chaser=POL", 400, "MISSING_PARAMS"],
  ];
  for (const [path, status, code] of cases) {
    const res = await get(path);
    assert.equal(res.status, status, path);
    assert.equal(((await res.json()) as ApiBody).error.code, code, path);
  }
  const compare = await json("/api/compare?chaser=POL&target=DEU");
  assert.equal(compare.scenario.chaser_growth_basis, "trailing_10y_cagr");
  assert.equal("series" in compare, false, "compare omits the series");

  const ireland = await json("/api/convergence?chaser=POL&target=IRL&growth_rate=0.04");
  assert.ok(
    ireland.caveats.some((c) => c.iso === "IRL" && c.applied === false),
    "caveat",
  );
}

async function testChartSvg() {
  const res = await get(
    "/api/chart.svg?chaser=POL&target=DEU&growth_rate=0.035&target_growth_rate=0.012",
  );
  assert.equal(res.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  const svg = await res.text();
  assert.ok(svg.startsWith("<?xml"), "xml prolog");
  assert.ok(svg.includes("Scenario: Poland 3.5%, Germany 1.2%"), "attribution");
  assert.ok(svg.includes('rel="canonical"'), "canonical metadata");
  assert.ok(!/NaN|undefined/.test(svg), "no NaN or undefined in path data");
}

async function testComparePages() {
  const res = await get("/compare/poland/united-kingdom");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("<h1>Poland vs United Kingdom"), "h1");
  assert.ok(
    html.includes(
      'rel="canonical" href="https://mountaintoclimb.com/compare/poland/united-kingdom"',
    ),
  );
  assert.ok(!html.includes('content="noindex'), "curated pair is indexable");
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1];
  assert.equal(JSON.parse(ld ?? "null")["@type"], "WebPage");

  const custom = await (await get("/compare/poland/united-kingdom?cg=0.035&tg=0.012")).text();
  assert.ok(custom.includes('content="noindex'), "custom rates are noindex");
  assert.ok(custom.includes('href="https://mountaintoclimb.com/compare/poland/united-kingdom"'));

  const uncurated = await (await get("/compare/iceland/malta")).text();
  assert.ok(uncurated.includes('content="noindex'), "uncurated pair is noindex");

  const redirect = await get("/compare/pol/gbr");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), `${ORIGIN}/compare/poland/united-kingdom`);
  assert.equal((await get("/compare/poland/atlantis")).status, 404);
  assert.equal((await get("/compare/poland/poland")).status, 404);

  for (const md of [
    await get("/compare/poland/united-kingdom", { accept: "text/markdown" }),
    await get("/compare/poland/united-kingdom.md"),
  ]) {
    assert.equal(md.headers.get("content-type"), "text/markdown; charset=utf-8");
    const text = await md.text();
    assert.ok(text.startsWith("# Poland → United Kingdom economic convergence"));
    assert.ok(text.includes("## Scenario") && text.includes("## Result"));
  }
  const browserAccept = await get("/compare/poland/united-kingdom", {
    accept: "text/html,application/xhtml+xml,*/*",
  });
  assert.ok((browserAccept.headers.get("content-type") ?? "").startsWith("text/html"));
}

async function testDiscoveryFilesResolve() {
  const sitemap = await (await get("/sitemap.xml")).text();
  const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.equal(
    locs.filter((l) => l.includes("/compare/")).length,
    CURATED_PAIRS.length,
    "all curated pairs",
  );

  const llms = readFileSync("public/llms.txt", "utf8");
  const links = [...llms.matchAll(/\]\((https:\/\/mountaintoclimb\.com[^)]*)\)/g)].map((m) => m[1]);
  assert.ok(links.length > 10);
  for (const link of new Set([...locs, ...links])) {
    const { pathname, search } = new URL(link);
    if (pathname === "/" || pathname === "/llms.txt" || pathname === "/openapi.json") continue; // static assets
    const res = await get(pathname + search);
    assert.equal(res.status, 200, `${link} should resolve`);
  }

  // Every path documented in the OpenAPI file is routed to a handler, not the SPA fallback.
  const spec = JSON.parse(readFileSync("public/openapi.json", "utf8"));
  for (const path of Object.keys(spec.paths)) {
    const res = await get(`${path}?chaser=POL&target=DEU`);
    assert.notEqual(res.status, 404, `${path} is routed`);
  }
}

async function main() {
  for (const test of [
    testScenarioMatchesShareModel,
    testRequiredGrowthRoundTrips,
    testApiValidation,
    testChartSvg,
    testComparePages,
    testDiscoveryFilesResolve,
  ]) {
    await test();
    console.log(`ok ${test.name}`);
  }
  // Anything convergence-related must come from the shared model.
  void convergenceOutcome;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
