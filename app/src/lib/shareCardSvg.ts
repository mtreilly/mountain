import { formatMetricValue, formatPercent, formatYears } from "./convergence";

export interface ShareCardParams {
  chaserName: string;
  targetName: string;
  chaserCode: string;
  targetCode: string;
  metricLabel: string;
  metricUnit?: string | null;
  projection: Array<{ year: number; chaser: number; target: number }>;
  convergenceYear: number | null;
  yearsToConvergence: number | null;
  currentGap: number;
  chaserGrowth: number;
  targetGrowth: number;
  targetMode: "growing" | "static";
  theme: "light" | "dark";
  dimensions?: { width: number; height: number };
  siteUrl?: string;
  dataSource?: string;
}

export type ShareCardSize = "twitter" | "linkedin" | "square";

export const SHARE_CARD_SIZES: Record<ShareCardSize, { width: number; height: number }> = {
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 },
  square: { width: 1080, height: 1080 },
};

const PALETTES = {
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

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeXml(s: string): string {
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

interface ChartGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

function buildChartPaths(
  projection: ShareCardParams["projection"],
  geometry: ChartGeometry
): {
  chaserPath: string;
  targetPath: string;
  scales: {
    x: (year: number) => number;
    y: (value: number) => number;
    xMin: number;
    xMax: number;
    yMax: number;
  };
} {
  const { x, y, width, height, padding } = geometry;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const years = projection.map((d) => d.year);
  const values = projection.flatMap((d) => [d.chaser, d.target]);

  const xMin = Math.min(...years);
  const xMax = Math.max(...years);
  const xRange = Math.max(1, xMax - xMin);
  const yMax = Math.max(...values) * 1.1;

  const scales = {
    x: (year: number) => x + padding.left + ((year - xMin) / xRange) * chartWidth,
    y: (value: number) => y + padding.top + chartHeight - (value / yMax) * chartHeight,
    xMin,
    xMax,
    yMax,
  };

  const chaserPath = projection
    .map((d, i) => `${i === 0 ? "M" : "L"} ${scales.x(d.year).toFixed(1)} ${scales.y(d.chaser).toFixed(1)}`)
    .join(" ");

  const targetPath = projection
    .map((d, i) => `${i === 0 ? "M" : "L"} ${scales.x(d.year).toFixed(1)} ${scales.y(d.target).toFixed(1)}`)
    .join(" ");

  return { chaserPath, targetPath, scales };
}

function generateHeadlineText(params: ShareCardParams): { main: string; sub: string } {
  const { chaserName, targetName, yearsToConvergence, convergenceYear, currentGap } = params;

  if (currentGap <= 1) {
    return {
      main: `${chaserName} already leads ${targetName}`,
      sub: "No convergence needed",
    };
  }

  if (!yearsToConvergence || !Number.isFinite(yearsToConvergence) || yearsToConvergence <= 0) {
    return {
      main: `${chaserName} won't catch ${targetName}`,
      sub: "At current growth rates",
    };
  }

  return {
    main: `${chaserName} catches ${targetName} in ${formatYears(yearsToConvergence)}`,
    sub: convergenceYear ? `By ${convergenceYear}` : "",
  };
}

export function generateShareCardSvg(params: ShareCardParams): string {
  const {
    chaserName,
    targetName,
    metricLabel,
    metricUnit,
    projection,
    convergenceYear,
    currentGap,
    chaserGrowth,
    targetGrowth,
    targetMode,
    theme,
    siteUrl = "convergence-explorer.com",
    dataSource = "World Bank",
  } = params;

  const { width, height } = params.dimensions ?? SHARE_CARD_SIZES.twitter;
  const palette = PALETTES[theme];
  const font = FONT_FAMILY;

  const headline = generateHeadlineText(params);

  // Layout calculations
  const headerHeight = 120;
  const footerHeight = 50;
  const statCardsHeight = 70;
  const chartAreaY = headerHeight + 10;
  const chartAreaHeight = height - headerHeight - footerHeight - statCardsHeight - 30;

  const chartGeometry: ChartGeometry = {
    x: 48,
    y: chartAreaY,
    width: width - 96,
    height: chartAreaHeight,
    padding: { top: 30, right: 60, bottom: 40, left: 60 },
  };

  const { chaserPath, targetPath, scales } =
    projection.length >= 2
      ? buildChartPaths(projection, chartGeometry)
      : { chaserPath: "", targetPath: "", scales: null };

  // Generate Y-axis ticks
  const yTicks: number[] = [];
  if (scales) {
    const segments = 4;
    const step = scales.yMax / segments;
    for (let i = 0; i <= segments; i++) {
      yTicks.push(Math.round(step * i));
    }
  }

  // Generate X-axis ticks
  const xTicks: number[] = [];
  if (scales) {
    const range = scales.xMax - scales.xMin;
    const targetTicks = 5;
    const rough = range / Math.max(1, targetTicks);
    const step = Math.max(1, Math.ceil(rough / 5) * 5);
    for (let year = scales.xMin; year <= scales.xMax; year += step) {
      xTicks.push(year);
    }
  }

  // Stat cards data
  const stats = [
    {
      label: "TIME TO CONVERGE",
      value: params.yearsToConvergence && Number.isFinite(params.yearsToConvergence) && params.yearsToConvergence > 0
        ? formatYears(params.yearsToConvergence)
        : currentGap <= 1
          ? "Already ahead"
          : "Never",
    },
    {
      label: "CURRENT GAP",
      value: currentGap > 1 ? `${currentGap.toFixed(1)}×` : "—",
    },
    {
      label: "GROWTH RATES",
      value: `${formatPercent(chaserGrowth)} / ${targetMode === "static" ? "0%" : formatPercent(targetGrowth)}`,
    },
  ];

  const statCardWidth = (width - 96 - 24) / 3;
  const statCardsY = height - footerHeight - statCardsHeight - 10;

  // Build SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette.bgTop}"/>
      <stop offset="100%" stop-color="${palette.bgBottom}"/>
    </linearGradient>
    <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.card}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${palette.card}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Header -->
  <text x="48" y="50" font-family="${font}" font-size="36" font-weight="800" fill="${palette.ink}">
    ${escapeXml(truncateName(chaserName, 20))} → ${escapeXml(truncateName(targetName, 20))}
  </text>
  <text x="48" y="78" font-family="${font}" font-size="16" font-weight="500" fill="${palette.muted}">
    ${escapeXml(metricLabel)}${metricUnit ? ` · ${escapeXml(metricUnit)}` : ""}
  </text>
  <text x="48" y="108" font-family="${font}" font-size="20" font-weight="600" fill="${palette.convergence}">
    ${escapeXml(headline.main)}
  </text>

  <!-- Data source pill -->
  <g transform="translate(${width - 180}, 30)">
    <rect width="132" height="28" rx="14" fill="${palette.card}" stroke="${palette.border}"/>
    <text x="66" y="18" text-anchor="middle" font-family="${font}" font-size="12" font-weight="600" fill="${palette.muted}">
      ${escapeXml(dataSource)}
    </text>
  </g>

  <!-- Chart area -->
  <rect x="${chartGeometry.x}" y="${chartGeometry.y}" width="${chartGeometry.width}" height="${chartGeometry.height}" rx="12" fill="url(#chartBg)" stroke="${palette.border}" stroke-opacity="0.5"/>

  ${scales ? `
  <!-- Grid lines -->
  <g stroke="${palette.grid}" stroke-dasharray="3,3" stroke-opacity="0.6">
    ${yTicks.map((tick) => `<line x1="${chartGeometry.x + chartGeometry.padding.left}" y1="${scales.y(tick)}" x2="${chartGeometry.x + chartGeometry.width - chartGeometry.padding.right}" y2="${scales.y(tick)}"/>`).join("\n    ")}
  </g>

  <!-- Y-axis labels -->
  <g font-family="${font}" font-size="11" fill="${palette.faint}">
    ${yTicks.map((tick) => `<text x="${chartGeometry.x + chartGeometry.padding.left - 8}" y="${scales.y(tick)}" text-anchor="end" dominant-baseline="middle">${formatMetricValue(tick, metricUnit)}</text>`).join("\n    ")}
  </g>

  <!-- X-axis labels -->
  <g font-family="${font}" font-size="11" fill="${palette.faint}">
    ${xTicks.map((year) => `<text x="${scales.x(year)}" y="${chartGeometry.y + chartGeometry.height - chartGeometry.padding.bottom + 18}" text-anchor="middle">${year}</text>`).join("\n    ")}
  </g>

  <!-- Convergence marker -->
  ${convergenceYear && convergenceYear <= scales.xMax ? `
  <line x1="${scales.x(convergenceYear)}" y1="${chartGeometry.y + chartGeometry.padding.top}" x2="${scales.x(convergenceYear)}" y2="${chartGeometry.y + chartGeometry.height - chartGeometry.padding.bottom}" stroke="${palette.convergence}" stroke-dasharray="6,4" stroke-width="2" opacity="0.8"/>
  <rect x="${scales.x(convergenceYear) - 28}" y="${chartGeometry.y + chartGeometry.padding.top - 22}" width="56" height="20" rx="4" fill="${palette.convergence}"/>
  <text x="${scales.x(convergenceYear)}" y="${chartGeometry.y + chartGeometry.padding.top - 8}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="600" fill="#ffffff">${convergenceYear}</text>
  ` : ""}

  <!-- Target line (dashed) -->
  <path d="${targetPath}" fill="none" stroke="${palette.target}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7,5"/>

  <!-- Chaser line (solid) -->
  <path d="${chaserPath}" fill="none" stroke="${palette.chaser}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- End point dots -->
  ${projection.length > 0 ? `
  <circle cx="${scales.x(projection[projection.length - 1].year)}" cy="${scales.y(projection[projection.length - 1].chaser)}" r="5" fill="${palette.chaser}"/>
  <circle cx="${scales.x(projection[projection.length - 1].year)}" cy="${scales.y(projection[projection.length - 1].target)}" r="5" fill="${palette.target}"/>
  ` : ""}

  <!-- Legend -->
  <g transform="translate(${chartGeometry.x + chartGeometry.width - chartGeometry.padding.right + 8}, ${chartGeometry.y + chartGeometry.padding.top})">
    <rect x="-4" y="-6" width="52" height="48" rx="6" fill="${palette.card}" fill-opacity="0.9" stroke="${palette.border}" stroke-opacity="0.5"/>
    <circle cx="6" cy="8" r="4" fill="${palette.chaser}"/>
    <text x="16" y="12" font-family="${font}" font-size="10" font-weight="500" fill="${palette.muted}">${escapeXml(truncateName(chaserName, 6))}</text>
    <circle cx="6" cy="28" r="4" fill="${palette.target}"/>
    <text x="16" y="32" font-family="${font}" font-size="10" font-weight="500" fill="${palette.muted}">${escapeXml(truncateName(targetName, 6))}</text>
  </g>
  ` : `
  <!-- No data placeholder -->
  <text x="${width / 2}" y="${chartGeometry.y + chartGeometry.height / 2}" text-anchor="middle" font-family="${font}" font-size="18" fill="${palette.muted}">Insufficient data for projection</text>
  `}

  <!-- Stat cards -->
  <g transform="translate(48, ${statCardsY})">
    ${stats.map((stat, i) => `
    <g transform="translate(${i * (statCardWidth + 12)}, 0)">
      <rect width="${statCardWidth}" height="${statCardsHeight}" rx="10" fill="${palette.card}" stroke="${palette.border}"/>
      <text x="14" y="22" font-family="${font}" font-size="10" font-weight="700" fill="${palette.faint}" letter-spacing="0.8">${escapeXml(stat.label)}</text>
      <text x="14" y="50" font-family="${font}" font-size="22" font-weight="700" fill="${palette.ink}">${escapeXml(stat.value)}</text>
    </g>
    `).join("")}
  </g>

  <!-- Footer -->
  <line x1="48" y1="${height - footerHeight}" x2="${width - 48}" y2="${height - footerHeight}" stroke="${palette.border}" stroke-opacity="0.5"/>
  <text x="48" y="${height - 18}" font-family="${font}" font-size="13" fill="${palette.faint}">${escapeXml(siteUrl)}</text>
  <text x="${width - 48}" y="${height - 18}" text-anchor="end" font-family="${font}" font-size="11" fill="${palette.faint}">Data: ${escapeXml(dataSource)}</text>
</svg>`;

  return svg;
}

export function getShareCardFilename(params: ShareCardParams, size: ShareCardSize): string {
  const { chaserCode, targetCode, theme } = params;
  const timestamp = new Date().toISOString().slice(0, 10);
  return `convergence-${chaserCode}-${targetCode}-${size}-${theme}-${timestamp}.png`;
}
