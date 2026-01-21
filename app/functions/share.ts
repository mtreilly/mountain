import { parseShareStateFromSearch, toSearchParams } from "../src/lib/shareState";
import { getRegionByCode, getLatestRegionData } from "../src/lib/oecdRegions";

interface Env {
  DB: D1Database;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const state = parseShareStateFromSearch(url.search);
  const params = toSearchParams(state);
  const canonicalPath = `/share?${params.toString()}`;
  const appPath = `/?${params.toString()}`;

  const isRegionalMode = state.mode === "regions";

  let chaserName: string;
  let targetName: string;
  let chaserValue: number | null;
  let targetValue: number | null;
  let metricName: string;
  let source: string;

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
    // Country mode - query database
    const { DB } = context.env;

    const indicator = await DB.prepare(
      `SELECT code, name, unit, source
       FROM indicators
       WHERE code = ?`
    )
      .bind(state.indicator)
      .first<{
        code: string;
        name: string;
        unit: string | null;
        source: string | null;
      }>();

    const countries = await DB.prepare(
      `SELECT iso_alpha3, name
       FROM countries
       WHERE iso_alpha3 IN (?, ?)`
    )
      .bind(state.chaser, state.target)
      .all<{ iso_alpha3: string; name: string }>();

    const countryName = (iso3: string) =>
      (countries.results || []).find((c) => c.iso_alpha3 === iso3)?.name || iso3;

    chaserName = countryName(state.chaser);
    targetName = countryName(state.target);

    const latest = await DB.prepare(
      `SELECT c.iso_alpha3 AS iso, d.year AS year, d.value AS value
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE i.code = ?
         AND c.iso_alpha3 IN (?, ?)
         AND d.year = (
           SELECT MAX(year)
           FROM data_points
           WHERE country_id = d.country_id
             AND indicator_id = d.indicator_id
         )`
    )
      .bind(state.indicator, state.chaser, state.target)
      .all<{ iso: string; year: number; value: number }>();

    const byIso: Record<string, { year: number; value: number }> = {};
    for (const row of latest.results || []) byIso[row.iso] = { year: row.year, value: row.value };

    chaserValue = byIso[state.chaser]?.value ?? null;
    targetValue = byIso[state.target]?.value ?? null;
    metricName = indicator?.name || state.indicator;
    source = indicator?.source || "World Bank";
  }

  const title = `${chaserName} → ${targetName} · ${metricName}`;

  const outcome = (() => {
    const entityType = isRegionalMode ? "regions" : "countries";
    if (chaserValue == null || targetValue == null) return `Data unavailable for one or both ${entityType}.`;
    if (chaserValue >= targetValue) return "Already ahead at the latest observed values.";
    const tg = state.tmode === "static" ? 0 : state.tg;
    if (state.cg <= tg) return "No convergence at these growth rates.";

    const ratio = targetValue / chaserValue;
    const growthRatio = (1 + state.cg) / (1 + tg);
    const years = Math.log(ratio) / Math.log(growthRatio);
    const year = Math.round(state.baseYear + years);
    return `Could converge in ~${Math.round(years)} years (by ${year}).`;
  })();

  const description = `${outcome} Chaser ${Math.round(state.cg * 1000) / 10}% · Target ${
    state.tmode === "static" ? "Static" : `${Math.round(state.tg * 1000) / 10}%`
  } · Base year ${state.baseYear}. Data: ${source}.`;

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
