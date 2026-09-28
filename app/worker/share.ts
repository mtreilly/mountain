import { parseShareStateFromSearch, toSearchParams } from "../src/lib/shareState";
import { loadPairOutcome } from "./_lib/pairOutcome";
import { enforceRateLimit } from "./_lib/requestGuards";
import type { StaticDataEnv } from "./_lib/staticData";

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
  const { chaserName, targetName, metricName, source, outcome } = await loadPairOutcome(
    context.env,
    context.request.url,
    state,
  );

  const title = `${chaserName} → ${targetName} · ${metricName}`;

  const outcomeText = (() => {
    const entityType = isRegionalMode ? "regions" : "countries";
    if (!outcome) return `Data unavailable for one or both ${entityType}.`;
    if (outcome.yearsToConvergence === 0) return "Already ahead at the latest observed values.";
    if (outcome.convergenceYear == null) return "No convergence at these growth rates.";
    return `Could converge in ~${Math.round(outcome.yearsToConvergence)} years (by ${outcome.convergenceYear}).`;
  })();

  const description = `${outcomeText} Chaser ${Math.round(state.cg * 1000) / 10}% · Target ${
    state.tmode === "static" ? "Static" : `${Math.round(state.tg * 1000) / 10}%`
  }${outcome ? ` · From ${outcome.start.year}` : ""}. Data: ${source}.`;

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
