import { parseShareStateFromSearch, toSearchParams } from "../../src/lib/shareState";
import { formatPercent, formatYears, formatMetricValue } from "../../src/lib/convergence";
import { getRegionByCode, getLatestRegionData } from "../../src/lib/oecdRegions";

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

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
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

function makePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

const THEMES = {
  light: {
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
    grid: "#e5e0d8",
  },
  dark: {
    bgTop: "#0f0e0d",
    bgBottom: "#0a0908",
    card: "#1a1918",
    border: "#2a2826",
    ink: "#f5f3ef",
    muted: "#a8a49c",
    faint: "#6b675f",
    chaser: "#fb923c",
    target: "#34d399",
    convergence: "#a78bfa",
    grid: "#2a2826",
  },
} as const;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const state = parseShareStateFromSearch(url.search);
  const params = toSearchParams(state);
  const canonical = `${url.origin}/share?${params.toString()}`;

  // Determine theme
  const themeParam = url.searchParams.get("theme");
  const themeName = themeParam === "dark" ? "dark" : "light";
  const theme = THEMES[themeName];

  // Determine mode and get data
  const isRegionalMode = state.mode === "regions";

  let chaserName: string;
  let targetName: string;
  let chaserValue: number | null;
  let targetValue: number | null;
  let metricName: string;
  let metricUnit: string | null;
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
    metricName = "GDP per capita";
    metricUnit = "USD PPP";
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
    metricUnit = indicator?.unit || null;
    source = indicator?.source || "World Bank";
  }

  const title = `${truncateName(chaserName, 18)} → ${truncateName(targetName, 18)}`;

  // Calculate convergence
  const outcome = (() => {
    if (chaserValue == null || targetValue == null) return { headline: "Data unavailable", years: null, year: null };
    if (chaserValue >= targetValue) return { headline: "Already ahead", years: null, year: null };
    const tg = state.tmode === "static" ? 0 : state.tg;
    if (state.cg <= tg) return { headline: "No convergence", years: null, year: null };

    const ratio = targetValue / chaserValue;
    const growthRatio = (1 + state.cg) / (1 + tg);
    const years = Math.log(ratio) / Math.log(growthRatio);
    const year = Math.round(state.baseYear + years);
    return { headline: formatYears(years), years, year };
  })();

  const gap = chaserValue && targetValue && chaserValue > 0 ? targetValue / chaserValue : null;

  // Build projection
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

  // Chart layout - hero chart in center
  const chartArea = {
    x: 48,
    y: 140,
    width: 1104,
    height: 340,
    padding: { top: 40, right: 80, bottom: 50, left: 80 },
  };

  const chartInner = {
    x: chartArea.x + chartArea.padding.left,
    y: chartArea.y + chartArea.padding.top,
    width: chartArea.width - chartArea.padding.left - chartArea.padding.right,
    height: chartArea.height - chartArea.padding.top - chartArea.padding.bottom,
  };

  // Build chart paths
  const chart = (() => {
    if (projection.length < 2) return null;

    const years = projection.map((p) => p.year);
    const values = projection.flatMap((p) => [p.chaser, p.target]);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const xRange = Math.max(1, maxYear - minYear);
    const yMax = Math.max(...values) * 1.1;

    const toX = (year: number) => chartInner.x + ((year - minYear) / xRange) * chartInner.width;
    const toY = (value: number) => chartInner.y + chartInner.height - (value / yMax) * chartInner.height;

    const chaserPts = projection.map((p) => ({ x: toX(p.year), y: toY(p.chaser) }));
    const targetPts = projection.map((p) => ({ x: toX(p.year), y: toY(p.target) }));

    // Y-axis ticks
    const yTicks: number[] = [];
    const segments = 4;
    const step = yMax / segments;
    for (let i = 0; i <= segments; i++) {
      yTicks.push(Math.round(step * i));
    }

    // X-axis ticks
    const xTicks: number[] = [];
    const targetTicks = 5;
    const rough = xRange / Math.max(1, targetTicks);
    const xStep = Math.max(1, Math.ceil(rough / 5) * 5);
    for (let year = minYear; year <= maxYear; year += xStep) {
      xTicks.push(year);
    }

    const last = projection[projection.length - 1];

    return {
      chaserPath: makePath(chaserPts),
      targetPath: makePath(targetPts),
      lastX: toX(last.year),
      lastYChaser: toY(last.chaser),
      lastYTarget: toY(last.target),
      yTicks,
      xTicks,
      toX,
      toY,
      minYear,
      maxYear,
      yMax,
    };
  })();

  const font = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";

  // Build SVG parts
  const gridLines = chart
    ? chart.yTicks.map((tick) =>
        `<line x1="${chartInner.x}" y1="${chart.toY(tick)}" x2="${chartInner.x + chartInner.width}" y2="${chart.toY(tick)}" stroke="${theme.grid}" stroke-dasharray="3,3" stroke-opacity="0.6"/>`
      ).join("\n    ")
    : "";

  const yAxisLabels = chart
    ? chart.yTicks.map((tick) =>
        `<text x="${chartInner.x - 12}" y="${chart.toY(tick)}" text-anchor="end" dominant-baseline="middle" font-family="${font}" font-size="11" fill="${theme.faint}">${formatMetricValue(tick, metricUnit)}</text>`
      ).join("\n    ")
    : "";

  const xAxisLabels = chart
    ? chart.xTicks.map((year) =>
        `<text x="${chart.toX(year)}" y="${chartInner.y + chartInner.height + 24}" text-anchor="middle" font-family="${font}" font-size="11" fill="${theme.faint}">${year}</text>`
      ).join("\n    ")
    : "";

  const convergenceMarker = chart && outcome.year && outcome.year <= chart.maxYear
    ? `<line x1="${chart.toX(outcome.year)}" y1="${chartInner.y}" x2="${chart.toX(outcome.year)}" y2="${chartInner.y + chartInner.height}" stroke="${theme.convergence}" stroke-dasharray="6,4" stroke-width="2" opacity="0.8"/>
       <rect x="${chart.toX(outcome.year) - 28}" y="${chartInner.y - 22}" width="56" height="20" rx="4" fill="${theme.convergence}"/>
       <text x="${chart.toX(outcome.year)}" y="${chartInner.y - 8}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="600" fill="#ffffff">${outcome.year}</text>`
    : "";

  const chartPaths = chart
    ? `<path d="${chart.targetPath}" fill="none" stroke="${theme.target}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7,5"/>
       <path d="${chart.chaserPath}" fill="none" stroke="${theme.chaser}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="${chart.lastX}" cy="${chart.lastYChaser}" r="5" fill="${theme.chaser}"/>
       <circle cx="${chart.lastX}" cy="${chart.lastYTarget}" r="5" fill="${theme.target}"/>`
    : "";

  // Stat cards
  const stats = [
    { label: "TIME TO CONVERGE", value: outcome.headline },
    { label: "CURRENT GAP", value: gap ? `${gap.toFixed(1)}×` : "—" },
    { label: "GROWTH RATES", value: `${formatPercent(state.cg)} / ${state.tmode === "static" ? "0%" : formatPercent(state.tg)}` },
  ];

  const statCardWidth = 340;
  const statCardsY = 510;
  const statCards = stats.map((stat, i) => `
    <g transform="translate(${48 + i * (statCardWidth + 16)}, ${statCardsY})">
      <rect width="${statCardWidth}" height="70" rx="10" fill="${theme.card}" stroke="${theme.border}"/>
      <text x="16" y="24" font-family="${font}" font-size="10" font-weight="700" fill="${theme.faint}" letter-spacing="0.8">${escapeXml(stat.label)}</text>
      <text x="16" y="52" font-family="${font}" font-size="24" font-weight="700" fill="${theme.ink}">${escapeXml(stat.value)}</text>
    </g>
  `).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${theme.bgTop}"/>
      <stop offset="100%" stop-color="${theme.bgBottom}"/>
    </linearGradient>
    <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.card}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${theme.card}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Header -->
  <text x="48" y="52" font-family="${font}" font-size="36" font-weight="800" fill="${theme.ink}">${escapeXml(title)}</text>
  <text x="48" y="82" font-family="${font}" font-size="16" font-weight="500" fill="${theme.muted}">${escapeXml(metricName)}${metricUnit ? ` · ${escapeXml(metricUnit)}` : ""}</text>

  <!-- Headline insight -->
  <text x="48" y="118" font-family="${font}" font-size="20" font-weight="600" fill="${theme.convergence}">
    ${outcome.year ? `Converges in ${escapeXml(outcome.headline)} (by ${outcome.year})` : escapeXml(outcome.headline)}
  </text>

  <!-- Source pill -->
  <g transform="translate(1020, 24)">
    <rect width="132" height="28" rx="14" fill="${theme.card}" stroke="${theme.border}"/>
    <text x="66" y="18" text-anchor="middle" font-family="${font}" font-size="12" font-weight="600" fill="${theme.muted}">${escapeXml(source)}</text>
  </g>

  <!-- Chart area -->
  <rect x="${chartArea.x}" y="${chartArea.y}" width="${chartArea.width}" height="${chartArea.height}" rx="12" fill="url(#chartBg)" stroke="${theme.border}" stroke-opacity="0.5"/>

  ${chart ? `
  <!-- Grid -->
  <g>
    ${gridLines}
  </g>

  <!-- Y-axis labels -->
  <g>
    ${yAxisLabels}
  </g>

  <!-- X-axis labels -->
  <g>
    ${xAxisLabels}
  </g>

  <!-- Convergence marker -->
  ${convergenceMarker}

  <!-- Chart lines -->
  ${chartPaths}

  <!-- Legend -->
  <g transform="translate(${chartInner.x + chartInner.width + 12}, ${chartInner.y})">
    <rect x="-4" y="-6" width="60" height="52" rx="6" fill="${theme.card}" fill-opacity="0.9" stroke="${theme.border}" stroke-opacity="0.5"/>
    <circle cx="8" cy="10" r="5" fill="${theme.chaser}"/>
    <text x="20" y="14" font-family="${font}" font-size="11" font-weight="500" fill="${theme.muted}">${escapeXml(truncateName(chaserName, 7))}</text>
    <circle cx="8" cy="32" r="5" fill="${theme.target}"/>
    <text x="20" y="36" font-family="${font}" font-size="11" font-weight="500" fill="${theme.muted}">${escapeXml(truncateName(targetName, 7))}</text>
  </g>
  ` : `
  <!-- No data placeholder -->
  <text x="600" y="${chartArea.y + chartArea.height / 2}" text-anchor="middle" font-family="${font}" font-size="18" fill="${theme.muted}">Insufficient data for projection</text>
  `}

  <!-- Stat cards -->
  ${statCards}

  <!-- Footer -->
  <line x1="48" y1="598" x2="1152" y2="598" stroke="${theme.border}" stroke-opacity="0.5"/>
  <text x="48" y="618" font-family="${font}" font-size="12" fill="${theme.faint}">${escapeXml(canonical)}</text>
  <text x="1152" y="618" text-anchor="end" font-family="${font}" font-size="11" fill="${theme.faint}">Data: ${escapeXml(source)}</text>
</svg>`;

  // Prefer PNG via resvg (WASM). If WASM is unavailable, fall back to returning SVG.
  try {
    const { Resvg } = await import("@resvg/resvg-wasm");
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      background: themeName === "dark" ? "#0f0e0d" : "white",
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
