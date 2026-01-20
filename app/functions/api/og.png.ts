import { parseShareStateFromSearch, toSearchParams } from "../../src/lib/shareState";
import { formatPercent, formatYears, formatMetricValue } from "../../src/lib/convergence";

interface Env {
  DB: D1Database;
}

type IndicatorRow = { code: string; name: string; unit: string | null; source: string | null };

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatShortNumber(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function buildProjection(params: {
  baseYear: number;
  chaserValue: number;
  targetValue: number;
  chaserRate: number;
  targetRate: number;
  maxYears: number;
}) {
  const { baseYear, chaserValue, targetValue, chaserRate, targetRate, maxYears } = params;
  const points: Array<{ year: number; chaser: number; target: number }> = [];
  for (let i = 0; i <= maxYears; i++) {
    const year = baseYear + i;
    const chaser = chaserValue * Math.pow(1 + chaserRate, i);
    const target = targetValue * Math.pow(1 + targetRate, i);
    points.push({ year, chaser, target });
    if (chaser >= target) break;
  }
  return points;
}

function makeSparkPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const state = parseShareStateFromSearch(url.search);
  const params = toSearchParams(state);
  const canonical = `${url.origin}/share?${params.toString()}`;

  const { DB } = context.env;

  const indicator = await DB.prepare(
    `SELECT code, name, unit, source
     FROM indicators
     WHERE code = ?`
  )
    .bind(state.indicator)
    .first<IndicatorRow>();

  const countries = await DB.prepare(
    `SELECT iso_alpha3, name
     FROM countries
     WHERE iso_alpha3 IN (?, ?)`
  )
    .bind(state.chaser, state.target)
    .all<{ iso_alpha3: string; name: string }>();

  const countryName = (iso3: string) =>
    (countries.results || []).find((c) => c.iso_alpha3 === iso3)?.name || iso3;

  const chaserName = countryName(state.chaser);
  const targetName = countryName(state.target);

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

  const chaserValue = byIso[state.chaser]?.value ?? null;
  const targetValue = byIso[state.target]?.value ?? null;

  const metricName = indicator?.name || state.indicator;
  const metricUnit = indicator?.unit || null;
  const source = indicator?.source || "World Bank";

  const title = `${chaserName} → ${targetName}`;
  const subtitle = `${metricName}${metricUnit ? ` · ${metricUnit}` : ""}`;

  const outcome = (() => {
    if (chaserValue == null || targetValue == null) return { headline: "Data unavailable", detail: "" };
    if (chaserValue >= targetValue) return { headline: "Already ahead", detail: "" };
    const tg = state.tmode === "static" ? 0 : state.tg;
    if (state.cg <= tg) return { headline: "No convergence", detail: "" };

    const ratio = targetValue / chaserValue;
    const growthRatio = (1 + state.cg) / (1 + tg);
    const years = Math.log(ratio) / Math.log(growthRatio);
    const year = Math.round(state.baseYear + years);
    return { headline: formatYears(years), detail: `by ${year}` };
  })();

  const assumptions = `Chaser ${formatPercent(state.cg)} · Target ${
    state.tmode === "static" ? "Static" : formatPercent(state.tg)
  } · Base year ${state.baseYear}`;

  const current = (() => {
    if (chaserValue == null || targetValue == null) return null;
    const gap = targetValue / chaserValue;
    return {
      chaser: formatMetricValue(chaserValue, metricUnit),
      target: formatMetricValue(targetValue, metricUnit),
      gap: `${gap.toFixed(1)}× gap`,
    };
  })();

  const theme = {
    bgTop: "#faf8f5",
    bgBottom: "#f3f0eb",
    card: "#fffffe",
    border: "#e5e0d8",
    ink: "#1a1815",
    muted: "#5c574f",
    faint: "#8a847a",
    chaser: "#ea580c",
    target: "#059669",
    convergence: "#8b5cf6",
  } as const;

  const projection =
    chaserValue != null && targetValue != null
      ? buildProjection({
          baseYear: state.baseYear,
          chaserValue,
          targetValue,
          chaserRate: state.cg,
          targetRate: state.tmode === "static" ? 0 : state.tg,
          maxYears: 60,
        })
      : [];

  const spark = (() => {
    if (projection.length < 2) return null;
    const W = 520;
    const H = 140;
    const pad = { x: 16, y: 14 };
    const x0 = 64 + 28;
    const y0 = 630 - 56 - H - 18;

    const years = projection.map((p) => p.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const xRange = Math.max(1, maxYear - minYear);

    const maxVal = Math.max(...projection.flatMap((p) => [p.chaser, p.target])) * 1.05;
    const minVal = 0;
    const yRange = Math.max(1, maxVal - minVal);

    const toX = (year: number) => x0 + pad.x + ((year - minYear) / xRange) * (W - pad.x * 2);
    const toY = (value: number) =>
      y0 + pad.y + (1 - (value - minVal) / yRange) * (H - pad.y * 2);

    const chaserPts = projection.map((p) => ({ x: toX(p.year), y: toY(p.chaser) }));
    const targetPts = projection.map((p) => ({ x: toX(p.year), y: toY(p.target) }));

    const chaserPath = makeSparkPath(chaserPts);
    const targetPath = makeSparkPath(targetPts);

    const last = projection[projection.length - 1];
    const lastX = toX(last.year);
    const lastYChaser = toY(last.chaser);
    const lastYTarget = toY(last.target);

    return {
      x0,
      y0,
      W,
      H,
      minYear,
      maxYear,
      maxVal,
      chaserPath,
      targetPath,
      lastX,
      lastYChaser,
      lastYTarget,
    };
  })();

  const font = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  const currentBlock = current
    ? `<text x="712" y="276" font-family="${font}" font-size="16" fill="${theme.muted}">
      <tspan fill="${theme.chaser}" font-weight="700">${escapeXml(chaserName)}:</tspan> ${escapeXml(
        current.chaser
      )}
    </text>
    <text x="712" y="304" font-family="${font}" font-size="16" fill="${theme.muted}">
      <tspan fill="${theme.target}" font-weight="700">${escapeXml(targetName)}:</tspan> ${escapeXml(
        current.target
      )}
    </text>
    <text x="712" y="328" font-family="${font}" font-size="13" fill="${theme.faint}">${escapeXml(
      current.gap
    )}</text>`
    : "";

  const sparkBlock = spark
    ? `<g>
      <rect x="${spark.x0}" y="${spark.y0}" width="${spark.W}" height="${spark.H}" rx="16" fill="${theme.card}" stroke="${theme.border}"/>
      <text x="${spark.x0 + 18}" y="${spark.y0 + 28}" font-family="${font}" font-size="12" font-weight="700" fill="${theme.faint}" letter-spacing="1.2">PROJECTION</text>
      <path d="${spark.targetPath}" fill="none" stroke="${theme.target}" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 6" opacity="0.95"/>
      <path d="${spark.chaserPath}" fill="none" stroke="${theme.chaser}" stroke-width="3" stroke-linecap="round" opacity="0.98"/>
      <circle cx="${spark.lastX}" cy="${spark.lastYChaser}" r="4.5" fill="${theme.chaser}"/>
      <circle cx="${spark.lastX}" cy="${spark.lastYTarget}" r="4.5" fill="${theme.target}"/>
      <text x="${spark.x0 + 18}" y="${spark.y0 + spark.H - 16}" font-family="${font}" font-size="12" fill="${theme.faint}">${escapeXml(
        `${spark.minYear} → ${spark.maxYear} · max ${formatShortNumber(spark.maxVal)}`
      )}</text>
    </g>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${theme.bgTop}"/>
      <stop offset="100%" stop-color="${theme.bgBottom}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Title -->
  <text x="64" y="112" font-family="${font}" font-size="52" font-weight="900" fill="${theme.ink}">${escapeXml(
    title
  )}</text>
  <text x="64" y="148" font-family="${font}" font-size="20" font-weight="600" fill="${theme.muted}">${escapeXml(
    subtitle
  )}</text>

  <!-- Source pill -->
  <g>
    <rect x="900" y="72" width="236" height="34" rx="12" fill="${theme.card}" stroke="${theme.border}"/>
    <text x="1018" y="94" text-anchor="middle" font-family="${font}" font-size="14" font-weight="700" fill="${theme.muted}">${escapeXml(
      source
    )}</text>
  </g>

  <!-- Main cards -->
  <rect x="64" y="190" width="620" height="220" rx="20" fill="${theme.card}" stroke="${theme.border}"/>
  <rect x="712" y="190" width="424" height="220" rx="20" fill="${theme.card}" stroke="${theme.border}"/>

  <text x="92" y="232" font-family="${font}" font-size="12" font-weight="800" fill="${theme.faint}" letter-spacing="1.4">OUTCOME</text>
  <text x="92" y="312" font-family="${font}" font-size="64" font-weight="900" fill="${theme.ink}">${escapeXml(
    outcome.headline
  )}</text>
  <text x="92" y="346" font-family="${font}" font-size="22" font-weight="700" fill="${theme.muted}">${escapeXml(
    outcome.detail || ""
  )}</text>

  <text x="740" y="232" font-family="${font}" font-size="12" font-weight="800" fill="${theme.faint}" letter-spacing="1.4">ASSUMPTIONS</text>
  <text x="740" y="262" font-family="${font}" font-size="16" font-weight="600" fill="${theme.ink}">${escapeXml(
    assumptions
  )}</text>
  ${currentBlock}

  ${sparkBlock}

  <!-- Footer -->
  <text x="64" y="588" font-family="${font}" font-size="13" fill="${theme.faint}">${escapeXml(
    canonical
  )}</text>
</svg>`;

  // Prefer PNG via resvg (WASM). If WASM is unavailable, fall back to returning SVG.
  try {
    const { Resvg } = await import("@resvg/resvg-wasm");
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      background: "white",
    });
    const png = resvg.render().asPng();
    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-og-fallback": "svg",
      },
    });
  }
};
