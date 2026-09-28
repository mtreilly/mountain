import { escapeXml as esc } from "./chartSvg";

export { esc };

export interface PageMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  /** Extra <head> JSON-LD objects. */
  jsonLd?: unknown[];
  noindex?: boolean;
}

const CSS = `
:root{color-scheme:light dark;--bg:#faf8f5;--ink:#1a1815;--muted:#5c574f;--line:#e5e0d8;--card:#fffffe;--link:#9a3412}
@media (prefers-color-scheme:dark){:root{--bg:#0f0e0d;--ink:#f5f3ef;--muted:#a8a49c;--line:#2a2826;--card:#1a1918;--link:#fb923c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Instrument Sans",system-ui,sans-serif}
header,main,footer{max-width:46rem;margin:0 auto;padding:1rem}
header a.brand{font:700 1.1rem "Fraunces",Georgia,serif;color:var(--ink);text-decoration:none}
h1{font:700 1.8rem/1.25 "Fraunces",Georgia,serif;margin:.5rem 0 1rem}h2{font-size:1.2rem;margin:2rem 0 .5rem}
a{color:var(--link)}table{border-collapse:collapse;width:100%;background:var(--card);font-size:.95rem}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:right}th:first-child,td:first-child{text-align:left}
.scroll{overflow-x:auto}img.chart{width:100%;height:auto;border-radius:12px}
.cta{display:inline-block;padding:.6rem 1rem;border-radius:8px;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:600}
.note{color:var(--muted);font-size:.9rem}ul{padding-left:1.2rem}footer{color:var(--muted);font-size:.85rem;border-top:1px solid var(--line);margin-top:2rem}
`;

export function pageShell(meta: PageMeta, body: string): string {
  const jsonLd = (meta.jsonLd ?? [])
    .map(
      (obj) =>
        `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`,
    )
    .join("\n    ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(meta.title)}</title>
    <meta name="description" content="${esc(meta.description)}" />
    <link rel="canonical" href="${esc(meta.canonicalUrl)}" />
    ${meta.noindex ? '<meta name="robots" content="noindex, follow" />' : ""}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mountain to Climb" />
    <meta property="og:title" content="${esc(meta.title)}" />
    <meta property="og:description" content="${esc(meta.description)}" />
    <meta property="og:url" content="${esc(meta.canonicalUrl)}" />
    <meta name="twitter:card" content="summary" />
    ${jsonLd}
    <style>${CSS}</style>
  </head>
  <body>
    <header><a class="brand" href="/">Mountain to Climb</a></header>
    <main>
${body}
    </main>
    <footer>
      <p>Mountain to Climb is an economic convergence calculator.
      <a href="/">Open the calculator</a> · <a href="/methodology">Methodology</a> ·
      <a href="/llms.txt">llms.txt</a> · <a href="/openapi.json">API</a></p>
    </footer>
  </body>
</html>`;
}

export const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300, s-maxage=3600",
  vary: "Accept",
};

export const MARKDOWN_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  "cache-control": "public, max-age=300, s-maxage=3600",
  vary: "Accept",
};

export function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const md = accept.indexOf("text/markdown");
  if (md === -1) return false;
  const html = accept.indexOf("text/html");
  return html === -1 || md < html;
}

export function notFoundPage(message: string): Response {
  return new Response(
    pageShell(
      {
        title: "Not found — Mountain to Climb",
        description: message,
        canonicalUrl: "https://mountaintoclimb.com/",
        noindex: true,
      },
      `<h1>Not found</h1><p>${esc(message)}</p><p><a href="/">Open the economic convergence calculator</a></p>`,
    ),
    { status: 404, headers: { ...HTML_HEADERS, "cache-control": "no-store" } },
  );
}
