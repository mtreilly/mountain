import { formatMetricValue, formatPercent, formatYears } from "./convergence";

export interface ShareCardParams {
  chaserName: string;
  targetName: string;
  chaserCode: string;
  targetCode: string;
  metricLabel: string;
  metricUnit?: string | null;
  observed?: Array<{ year: number; chaser: number; target: number }>;
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

/** Estimate hero font size — scale down from 32px to 24px floor for long headlines. */
function heroFontSize(text: string, maxWidth: number): number {
  // Approximate char width at 32px ≈ 18px for system-ui bold
  const charWidth = 18;
  const idealWidth = text.length * charWidth;
  if (idealWidth <= maxWidth) return 32;
  const scaled = Math.floor(32 * (maxWidth / idealWidth));
  return Math.max(24, scaled);
}

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
  observed: ShareCardParams["observed"],
  projection: ShareCardParams["projection"],
  geometry: ChartGeometry,
): {
  observedChaserPath: string;
  observedTargetPath: string;
  chaserPath: string;
  targetPath: string;
  connectorChaserPath: string;
  connectorTargetPath: string;
  projectionStartYear: number | null;
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

  // Merge observed + projection to compute scales from the full range
  const allPoints = [...(observed ?? []), ...projection];
  const years = allPoints.map((d) => d.year);
  const values = allPoints.flatMap((d) => [d.chaser, d.target]);

  const xMin = Math.min(...years);
  const xMax = Math.max(...years);
  const xRange = Math.max(1, xMax - xMin);
  const yMaxRaw = Math.max(...values);
  // Guard against yMax=0 which would produce NaN coordinates in the SVG.
  const yMax = Math.max(1, yMaxRaw * 1.1);

  const scales = {
    x: (year: number) => x + padding.left + ((year - xMin) / xRange) * chartWidth,
    y: (value: number) => y + padding.top + chartHeight - (value / yMax) * chartHeight,
    xMin,
    xMax,
    yMax,
  };

  const toPath = (data: typeof projection, prop: "chaser" | "target") =>
    data
      .map(
        (d, i) =>
          `${i === 0 ? "M" : "L"} ${scales.x(d.year).toFixed(1)} ${scales.y(d[prop]).toFixed(1)}`,
      )
      .join(" ");

  const obs = observed ?? [];
  const observedChaserPath = obs.length >= 2 ? toPath(obs, "chaser") : "";
  const observedTargetPath = obs.length >= 2 ? toPath(obs, "target") : "";
  const chaserPath = toPath(projection, "chaser");
  const targetPath = toPath(projection, "target");

  // Connector lines bridging last observed → first projected
  let connectorChaserPath = "";
  let connectorTargetPath = "";
  if (obs.length > 0 && projection.length > 0) {
    const last = obs[obs.length - 1];
    const first = projection[0];
    const lx = scales.x(last.year).toFixed(1);
    const fx = scales.x(first.year).toFixed(1);
    connectorChaserPath = `M ${lx} ${scales.y(last.chaser).toFixed(1)} L ${fx} ${scales.y(first.chaser).toFixed(1)}`;
    connectorTargetPath = `M ${lx} ${scales.y(last.target).toFixed(1)} L ${fx} ${scales.y(first.target).toFixed(1)}`;
  }

  const projectionStartYear = projection[0]?.year ?? null;

  return {
    observedChaserPath,
    observedTargetPath,
    chaserPath,
    targetPath,
    connectorChaserPath,
    connectorTargetPath,
    projectionStartYear,
    scales,
  };
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
    observed,
    projection,
    convergenceYear,
    currentGap,
    chaserGrowth,
    targetGrowth,
    targetMode,
    theme,
    siteUrl = "mountaintoclimb.com",
    dataSource = "Penn World Table",
  } = params;

  const { width, height } = params.dimensions ?? SHARE_CARD_SIZES.twitter;
  const palette = PALETTES[theme];
  const font = FONT_FAMILY;

  const headline = generateHeadlineText(params);

  // Layout calculations
  const headerHeight = 140;
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

  const hasEnoughData = projection.length >= 2 || (observed?.length ?? 0) >= 2;
  const {
    observedChaserPath,
    observedTargetPath,
    chaserPath,
    targetPath,
    connectorChaserPath,
    connectorTargetPath,
    projectionStartYear,
    scales,
  } = hasEnoughData
    ? buildChartPaths(observed, projection, chartGeometry)
    : {
        observedChaserPath: "",
        observedTargetPath: "",
        chaserPath: "",
        targetPath: "",
        connectorChaserPath: "",
        connectorTargetPath: "",
        projectionStartYear: null,
        scales: null,
      };

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
      value:
        params.yearsToConvergence &&
        Number.isFinite(params.yearsToConvergence) &&
        params.yearsToConvergence > 0
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

  const endPointLabels =
    scales && projection.length > 0
      ? (() => {
          const last = projection[projection.length - 1];
          const endX = scales.x(last.year);
          const endYChaser = scales.y(last.chaser);
          const endYTarget = scales.y(last.target);
          const anchorY = (endYChaser + endYTarget) / 2;

          const maxNameLength = 16;
          const chaserLabel = truncateName(chaserName, maxNameLength);
          const targetLabel = truncateName(targetName, maxNameLength);

          const chartLeft = chartGeometry.x + chartGeometry.padding.left;
          const chartRight = chartGeometry.x + chartGeometry.width - chartGeometry.padding.right;
          const chartTop = chartGeometry.y + chartGeometry.padding.top;
          const chartBottom = chartGeometry.y + chartGeometry.height - chartGeometry.padding.bottom;

          const boxHeight = 48;
          const boxPadding = 10;
          const rowOffset = 20;
          const rowGap = 20;
          const dotRadius = 4;
          const approxCharWidth = 6.2; // ~10px font in system-ui
          const labelWidth = Math.max(
            72,
            Math.min(
              190,
              Math.ceil(Math.max(chaserLabel.length, targetLabel.length) * approxCharWidth) +
                boxPadding * 2 +
                16,
            ),
          );
          const gap = 10;

          let boxX = endX + gap;
          if (boxX + labelWidth > chartRight) {
            boxX = endX - gap - labelWidth;
          }
          if (boxX < chartLeft) {
            boxX = chartLeft;
          }

          const boxY = Math.min(Math.max(anchorY - boxHeight / 2, chartTop), chartBottom - boxHeight);
          const boxCenterY = boxY + boxHeight / 2;
          const connectorEdgeX = boxX > endX ? boxX : boxX + labelWidth;

          return `
  <line x1="${endX.toFixed(1)}" y1="${anchorY.toFixed(1)}" x2="${connectorEdgeX.toFixed(1)}" y2="${boxCenterY.toFixed(1)}" stroke="${palette.border}" stroke-width="1.5" opacity="0.8"/>
  <g transform="translate(${boxX.toFixed(1)}, ${boxY.toFixed(1)})">
    <rect x="0" y="0" width="${labelWidth}" height="${boxHeight}" rx="6" fill="${palette.card}" fill-opacity="0.95" stroke="${palette.border}" stroke-opacity="0.9"/>
    <circle cx="${boxPadding}" cy="${rowOffset - 2}" r="${dotRadius}" fill="${palette.chaser}"/>
    <text x="${boxPadding + 10}" y="${rowOffset + 2}" font-family="${font}" font-size="10" font-weight="500" fill="${palette.muted}">${escapeXml(chaserLabel)}</text>
    <circle cx="${boxPadding}" cy="${rowOffset + rowGap - 2}" r="${dotRadius}" fill="${palette.target}"/>
    <text x="${boxPadding + 10}" y="${rowOffset + rowGap + 2}" font-family="${font}" font-size="10" font-weight="500" fill="${palette.muted}">${escapeXml(targetLabel)}</text>
  </g>
  `;
        })()
      : "";

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

  <!-- Header: Hero headline + subtitle -->
  <text x="48" y="${56}" font-family="${font}" font-size="${heroFontSize(headline.main, width - 230)}" font-weight="800" fill="${palette.ink}">
    ${escapeXml(headline.main)}
  </text>
  <text x="48" y="${92}" font-family="${font}" font-size="15" font-weight="500" fill="${palette.muted}">
    ${escapeXml([headline.sub, metricLabel, metricUnit, `${truncateName(chaserName, 18)} → ${truncateName(targetName, 18)}`].filter(Boolean).join(" · "))}
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

  ${
    scales
      ? `
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

  <!-- Phase split backgrounds -->
  ${
    projectionStartYear != null &&
    observed &&
    observed.length > 0 &&
    projectionStartYear > scales.xMin &&
    projectionStartYear <= scales.xMax
      ? (
          () => {
            const breakX = scales.x(projectionStartYear).toFixed(1);
            const chartLeft = chartGeometry.x + chartGeometry.padding.left;
            const chartRight = chartGeometry.x + chartGeometry.width - chartGeometry.padding.right;
            const chartTop = chartGeometry.y + chartGeometry.padding.top;
            const chartBot = chartGeometry.y + chartGeometry.height - chartGeometry.padding.bottom;
            const chartH = chartBot - chartTop;
            return `
  <rect x="${chartLeft}" y="${chartTop}" width="${(Number(breakX) - chartLeft).toFixed(1)}" height="${chartH}" fill="#059669" opacity="${theme === "dark" ? 0.035 : 0.025}" rx="4"/>
  <rect x="${breakX}" y="${chartTop}" width="${(chartRight - Number(breakX)).toFixed(1)}" height="${chartH}" fill="#8b5cf6" opacity="${theme === "dark" ? 0.04 : 0.025}" rx="4"/>
  <line x1="${breakX}" y1="${chartTop}" x2="${breakX}" y2="${chartBot}" stroke="${palette.faint}" stroke-dasharray="2,6" stroke-width="1" opacity="0.4"/>
  `;
          }
        )()
      : ""
  }

  <!-- Convergence marker -->
  ${
    convergenceYear && convergenceYear <= scales.xMax
      ? `
  <line x1="${scales.x(convergenceYear)}" y1="${chartGeometry.y + chartGeometry.padding.top}" x2="${scales.x(convergenceYear)}" y2="${chartGeometry.y + chartGeometry.height - chartGeometry.padding.bottom}" stroke="${palette.convergence}" stroke-dasharray="6,4" stroke-width="2" opacity="0.8"/>
  <rect x="${scales.x(convergenceYear) - 28}" y="${chartGeometry.y + chartGeometry.padding.top - 22}" width="56" height="20" rx="4" fill="${palette.convergence}"/>
  <text x="${scales.x(convergenceYear)}" y="${chartGeometry.y + chartGeometry.padding.top - 8}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="600" fill="#ffffff">${convergenceYear}</text>
  `
      : ""
  }

  <!-- Observed target line (dashed, faded) -->
  ${observedTargetPath ? `<path d="${observedTargetPath}" fill="none" stroke="${palette.target}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,4" opacity="0.45"/>` : ""}

  <!-- Observed chaser line (solid, faded) -->
  ${observedChaserPath ? `<path d="${observedChaserPath}" fill="none" stroke="${palette.chaser}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>` : ""}

  <!-- Connector lines bridging observed → projected -->
  ${connectorTargetPath ? `<path d="${connectorTargetPath}" fill="none" stroke="${palette.target}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4,4" opacity="0.6"/>` : ""}
  ${connectorChaserPath ? `<path d="${connectorChaserPath}" fill="none" stroke="${palette.chaser}" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>` : ""}

  <!-- Projected target line (dashed) -->
  <path d="${targetPath}" fill="none" stroke="${palette.target}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7,5"/>

  <!-- Projected chaser line (solid) -->
  <path d="${chaserPath}" fill="none" stroke="${palette.chaser}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- End point dots -->
  ${
    projection.length > 0
      ? `
  <circle cx="${scales.x(projection[projection.length - 1].year)}" cy="${scales.y(projection[projection.length - 1].chaser)}" r="5" fill="${palette.chaser}"/>
  <circle cx="${scales.x(projection[projection.length - 1].year)}" cy="${scales.y(projection[projection.length - 1].target)}" r="5" fill="${palette.target}"/>
  `
      : ""
  }

  <!-- End point labels -->
  ${endPointLabels}
  `
      : `
  <!-- No data placeholder -->
  <text x="${width / 2}" y="${chartGeometry.y + chartGeometry.height / 2}" text-anchor="middle" font-family="${font}" font-size="18" fill="${palette.muted}">Insufficient data for projection</text>
  `
  }

  <!-- Stat cards -->
  <g transform="translate(48, ${statCardsY})">
    ${stats
      .map(
        (stat, i) => `
    <g transform="translate(${i * (statCardWidth + 12)}, 0)">
      <rect width="${statCardWidth}" height="${statCardsHeight}" rx="10" fill="${palette.card}" stroke="${palette.border}"/>
      <text x="14" y="22" font-family="${font}" font-size="10" font-weight="700" fill="${palette.faint}" letter-spacing="0.8">${escapeXml(stat.label)}</text>
      <text x="14" y="50" font-family="${font}" font-size="22" font-weight="700" fill="${palette.ink}">${escapeXml(stat.value)}</text>
    </g>
    `,
      )
      .join("")}
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
