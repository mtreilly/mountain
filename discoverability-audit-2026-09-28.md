# Discoverability audit — 28 September 2026

Live checks used plain HTTP requests and a rendered browser session.

- The homepage returns 200 and its initial HTML already identifies Mountain to Climb as an economic convergence calculator. It explains country comparisons, GDP per capita PPP, other indicators, World Bank/OECD/UN sources, the catch-up formula, and that projections are scenarios rather than forecasts. React replaces this text after hydration with the interactive calculator. The browser rendered the country selectors, indicator control, chart, and scenario inputs.
- The homepage has a descriptive title and meta description, a canonical URL, Open Graph/Twitter metadata, and `WebApplication` JSON-LD. `/methodology` and curated `/compare/...` pages return server-rendered HTML with canonical tags and structured data. Markdown representations are available.
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/openapi.json` all return 200. The default robots rule allows Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, and PerplexityBot, and the file names the sitemap. It also allows training crawlers; this is the site's existing policy.
- The sitemap includes the homepage, methodology, and curated comparison pages, but also lists `llms.txt` and `openapi.json`. Those two are useful discovery files, not canonical HTML pages; remove them from the sitemap.
- `www` redirects to the canonical host. Plain HTTP on the apex returns 200 instead of redirecting to HTTPS. An unknown path also returns the SPA's 200 homepage, creating duplicate/soft-404 risk.
- A curated comparison returns 200; its `.md` form returns Markdown. Custom parameter states are `noindex`, and noncurated comparison pages are `noindex`.
- Google Search Console and Bing Webmaster Tools opened to signed-out landing pages in the available browser session, so ownership, indexing, warnings, and sitemap submission cannot yet be checked there.

Next changes: make the sitemap HTML-only, enforce HTTPS and 404 for unknown paths, implement IndexNow deployment notifications, and verify the public results after deployment.

## After deployment, 29 September 2026

- Plain HTTP and `www` now 301 to the HTTPS apex. Unknown paths return 404, and `/index.html` 301s to `/`.
- The live sitemap contains 46 canonical HTML URLs. `llms.txt`, `openapi.json`, the IndexNow key, and the public API remain reachable but are not listed as indexable pages.
- The IndexNow key file returned 200. The first deployment submitted 46 changed canonical URLs (HTTP 202, key validation pending); the second submitted the changed homepage (HTTP 200). Future `pnpm deploy:prod` runs compare published HTML and the data manifest before and after deployment.
- Google Search Console shows a verified Domain property for `mountaintoclimb.com`. The homepage is indexed. Its live smartphone test fetched and rendered the calculator, reported crawling and indexing allowed, and read the HTTPS apex as the declared canonical. The homepage was added to Google's priority crawl queue. Google processed the submitted sitemap successfully and discovered 46 pages. The new property's aggregate page report is still processing; Settings temporarily says “No robots.txt file” even though the live test allows crawling and the public file returns 200.
- Bing Webmaster Tools has the site. Its sitemap was processed successfully and discovered 46 URLs with no errors or warnings. The homepage is indexed; Bing's prior crawl on 27 September reported a missing H1. A live test after the deployment found the H1 but flagged the meta description length, so the description was shortened to 138 characters and redeployed. The next live test found no SEO/GEO issues, and Bing accepted a fresh indexing request. Its aggregate reports are still processing.
- Brave Search confirmed successful submission of the homepage. The Actually Maybe blog already links to the site from two substantive posts, so no blog copy was changed.
