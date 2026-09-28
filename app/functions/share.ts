import { getLatestRegionData, getRegionByCode } from "../src/lib/oecdRegions";
import { parseShareStateFromSearch, toSearchParams } from "../src/lib/shareState";
import { enforceRateLimit } from "./_lib/requestGuards";
import { loadPairSnapshot, type StaticDataEnv } from "./_lib/staticData";

type Env = StaticDataEnv;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "share",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  const state = parseShareStateFromSearch(url.search);
  const params = toSearchParams(state);
  const canonicalSearch = params.toString();
  if (url.search !== `?${canonicalSearch}`) {
    // Response.redirect() headers are immutable, so build the redirect by hand.
    return new Response(null, {
      status: 301,
      headers: {
        location: `${url.origin}/share?${canonicalSearch}`,
        "cache-control": "public, max-age=300, s-maxage=3600",
      },
    });
  }

  const canonicalPath = `/share?${params.toString()}`;
  const appPath = `/?${params.toString()}`;

  const isRegionalMode = state.mode === "regions";

  let chaserName: string;
  let targetName: string;
  let chaserValue: number | null;
  let targetValue: number | null;
  let metricName: string;
  let source: string;
  // Like the app, project from the latest year both series have data when it's past the base year.
  let startYear = state.baseYear;

  if (isRegionalMode) {
    // Regional mode - use static OECD data
    const chaserCode = state.cr ?? "UKC";
    const targetCode = state.tr ?? "UKI";

    const chaserRegion = getRegionByCode(chaserCode);
    const targetRegion = getRegionByCode(targetCode);
    const chaserData = getLatestRegionData(chaserCode);
    const targetData = getLatestRegionData(targetCode);

    chaserName = chaserRegion?.name ?? chaserCode;
    targetName = targetRegion?.name ?? targetCode;
    chaserValue = chaserData?.gdpPerCapita ?? null;
    targetValue = targetData?.gdpPerCapita ?? null;
    metricName = "GDP per capita (USD PPP)";
    source = "OECD";
  } else {
    // Country mode - read the build-time data snapshot
    const snapshot = await loadPairSnapshot(context.env, context.request.url, {
      indicator: state.indicator,
      chaser: state.chaser,
      target: state.target,
    });
    const indicator = snapshot.indicator;

    chaserName = snapshot.chaserName;
    targetName = snapshot.targetName;
    chaserValue = snapshot.chaserLatest?.value ?? null;
    targetValue = snapshot.targetLatest?.value ?? null;
    if (snapshot.chaserLatest && snapshot.targetLatest) {
      const dataYear = Math.min(snapshot.chaserLatest.year, snapshot.targetLatest.year);
      startYear = Math.max(state.baseYear, dataYear);
    }
    metricName = indicator?.name || state.indicator;
    source = indicator?.source || "World Bank";
  }

  const title = `${chaserName} → ${targetName} · ${metricName}`;

  const outcome = (() => {
    const entityType = isRegionalMode ? "regions" : "countries";
    if (chaserValue == null || targetValue == null)
      return `Data unavailable for one or both ${entityType}.`;
    if (chaserValue >= targetValue) return "Already ahead at the latest observed values.";
    const tg = state.tmode === "static" ? 0 : state.tg;
    if (state.cg <= tg) return "No convergence at these growth rates.";

    const ratio = targetValue / chaserValue;
    const growthRatio = (1 + state.cg) / (1 + tg);
    const years = Math.log(ratio) / Math.log(growthRatio);
    const year = Math.round(startYear + years);
    return `Could converge in ~${Math.round(years)} years (by ${year}).`;
  })();

  const description = `${outcome} Chaser ${Math.round(state.cg * 1000) / 10}% · Target ${
    state.tmode === "static" ? "Static" : `${Math.round(state.tg * 1000) / 10}%`
  } · From ${startYear}. Data: ${source}.`;

  const origin = url.origin;
  const ogImageUrl = `${origin}/api/og.png?${params.toString()}`;
  const ogAlt = `${title} chart`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(origin + canonicalPath)}" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(origin + canonicalPath)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(ogAlt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(ogAlt)}" />

    <meta http-equiv="refresh" content="0;url=${escapeHtml(appPath)}" />
    <script>
      try { window.location.replace(${JSON.stringify(appPath)}); } catch {}
    </script>
  </head>
  <body>
    <p>Redirecting… <a href="${escapeHtml(appPath)}">Open interactive view</a></p>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
