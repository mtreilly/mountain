/**
 * SVG generator for historical context card.
 * Shows dual-country comparison with starting points and growth multipliers.
 */

import { formatNumber } from "./convergence";
import type { HistoricalData } from "./threadGenerator";

export interface HistoricalCardParams {
  chaserName: string;
  targetName: string;
  historicalData: HistoricalData;
  metricUnit?: string | null;
  theme: "light" | "dark";
  siteUrl?: string;
  dataSource?: string;
}

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
    barBg: "#f0ebe4",
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
    barBg: "#252322",
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

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${formatNumber(value)}`;
  }
  return `$${value.toLocaleString()}`;
}

export function generateHistoricalCardSvg(params: HistoricalCardParams): string {
  const {
    chaserName,
    targetName,
    historicalData,
    theme,
    siteUrl = "convergence-explorer.com",
    dataSource = "World Bank",
  } = params;

  const width = 1200;
  const height = 675;
  const palette = PALETTES[theme];
  const font = FONT_FAMILY;

  const { chaserStart, chaserCurrent, targetStart, targetCurrent } = historicalData;

  // Calculate growth multipliers
  const chaserMult = chaserStart && chaserCurrent && chaserStart.value > 0
    ? chaserCurrent.value / chaserStart.value
    : null;
  const targetMult = targetStart && targetCurrent && targetStart.value > 0
    ? targetCurrent.value / targetStart.value
    : null;

  // For bar visualization: normalize to max multiplier
  const maxMult = Math.max(chaserMult || 1, targetMult || 1);
  const chaserBarWidth = chaserMult ? (chaserMult / maxMult) * 400 : 0;
  const targetBarWidth = targetMult ? (targetMult / maxMult) * 400 : 0;

  // Layout
  const headerHeight = 100;
  const footerHeight = 50;
  const cardY = headerHeight + 30;
  const cardHeight = 200;
  const cardWidth = 500;
  const gap = 60;
  const leftCardX = (width - (cardWidth * 2 + gap)) / 2;
  const rightCardX = leftCardX + cardWidth + gap;

  // Bar chart area
  const barAreaY = cardY + cardHeight + 50;
  const barHeight = 50;
  const barAreaX = 120;
  const barAreaWidth = width - 240;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette.bgTop}"/>
      <stop offset="100%" stop-color="${palette.bgBottom}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Header -->
  <text x="48" y="45" font-family="${font}" font-size="28" font-weight="700" fill="${palette.ink}">
    ${escapeXml(truncateName(chaserName, 20))} → ${escapeXml(truncateName(targetName, 20))}
  </text>
  <text x="48" y="75" font-family="${font}" font-size="18" font-weight="500" fill="${palette.muted}">
    Where they started
  </text>

  <!-- Chaser Card -->
  <g transform="translate(${leftCardX}, ${cardY})">
    <rect width="${cardWidth}" height="${cardHeight}" rx="16" fill="${palette.card}" stroke="${palette.border}"/>
    <rect x="0" y="0" width="${cardWidth}" height="48" rx="16" fill="${palette.chaser}" fill-opacity="0.1"/>
    <rect x="0" y="32" width="${cardWidth}" height="16" fill="${palette.card}"/>
    <circle cx="28" cy="24" r="10" fill="${palette.chaser}"/>
    <text x="48" y="30" font-family="${font}" font-size="18" font-weight="700" fill="${palette.ink}">${escapeXml(truncateName(chaserName, 30))}</text>

    ${chaserStart ? `
    <text x="28" y="85" font-family="${font}" font-size="14" font-weight="500" fill="${palette.muted}">${chaserStart.year}</text>
    <text x="28" y="110" font-family="${font}" font-size="28" font-weight="700" fill="${palette.ink}">${formatCurrency(chaserStart.value)}</text>
    ` : `
    <text x="28" y="100" font-family="${font}" font-size="16" fill="${palette.faint}">No historical data</text>
    `}

    ${chaserCurrent ? `
    <text x="${cardWidth / 2 + 40}" y="85" font-family="${font}" font-size="14" font-weight="500" fill="${palette.muted}">${chaserCurrent.year}</text>
    <text x="${cardWidth / 2 + 40}" y="110" font-family="${font}" font-size="28" font-weight="700" fill="${palette.ink}">${formatCurrency(chaserCurrent.value)}</text>
    ` : ""}

    ${chaserMult != null ? `
    <text x="28" y="165" font-family="${font}" font-size="14" font-weight="500" fill="${palette.muted}">Growth</text>
    <text x="28" y="185" font-family="${font}" font-size="24" font-weight="700" fill="${palette.chaser}">${chaserMult.toFixed(1)}×</text>
    ` : ""}

    <!-- Arrow -->
    ${chaserStart && chaserCurrent ? `
    <path d="M ${cardWidth / 2 - 10} 95 L ${cardWidth / 2 + 20} 95" stroke="${palette.faint}" stroke-width="2" marker-end="url(#arrow)"/>
    ` : ""}
  </g>

  <!-- Target Card -->
  <g transform="translate(${rightCardX}, ${cardY})">
    <rect width="${cardWidth}" height="${cardHeight}" rx="16" fill="${palette.card}" stroke="${palette.border}"/>
    <rect x="0" y="0" width="${cardWidth}" height="48" rx="16" fill="${palette.target}" fill-opacity="0.1"/>
    <rect x="0" y="32" width="${cardWidth}" height="16" fill="${palette.card}"/>
    <circle cx="28" cy="24" r="10" fill="${palette.target}"/>
    <text x="48" y="30" font-family="${font}" font-size="18" font-weight="700" fill="${palette.ink}">${escapeXml(truncateName(targetName, 30))}</text>

    ${targetStart ? `
    <text x="28" y="85" font-family="${font}" font-size="14" font-weight="500" fill="${palette.muted}">${targetStart.year}</text>
    <text x="28" y="110" font-family="${font}" font-size="28" font-weight="700" fill="${palette.ink}">${formatCurrency(targetStart.value)}</text>
    ` : `
    <text x="28" y="100" font-family="${font}" font-size="16" fill="${palette.faint}">No historical data</text>
    `}

    ${targetCurrent ? `
    <text x="${cardWidth / 2 + 40}" y="85" font-family="${font}" font-size="14" font-weight="500" fill="${palette.muted}">${targetCurrent.year}</text>
    <text x="${cardWidth / 2 + 40}" y="110" font-family="${font}" font-size="28" font-weight="700" fill="${palette.ink}">${formatCurrency(targetCurrent.value)}</text>
    ` : ""}

    ${targetMult != null ? `
    <text x="28" y="165" font-family="${font}" font-size="14" font-weight="500" fill="${palette.muted}">Growth</text>
    <text x="28" y="185" font-family="${font}" font-size="24" font-weight="700" fill="${palette.target}">${targetMult.toFixed(1)}×</text>
    ` : ""}

    <!-- Arrow -->
    ${targetStart && targetCurrent ? `
    <path d="M ${cardWidth / 2 - 10} 95 L ${cardWidth / 2 + 20} 95" stroke="${palette.faint}" stroke-width="2"/>
    ` : ""}
  </g>

  <!-- Growth Comparison Bars -->
  <g transform="translate(${barAreaX}, ${barAreaY})">
    <text x="0" y="-15" font-family="${font}" font-size="14" font-weight="600" fill="${palette.ink}">Relative Growth Since ${chaserStart?.year || "Start"}</text>

    <!-- Chaser bar -->
    <text x="-10" y="20" text-anchor="end" font-family="${font}" font-size="13" font-weight="500" fill="${palette.muted}">${escapeXml(truncateName(chaserName, 15))}</text>
    <rect x="0" y="8" width="${barAreaWidth}" height="${barHeight - 16}" rx="4" fill="${palette.barBg}"/>
    ${chaserMult != null ? `
    <rect x="0" y="8" width="${(chaserBarWidth / 400) * barAreaWidth}" height="${barHeight - 16}" rx="4" fill="${palette.chaser}"/>
    <text x="${(chaserBarWidth / 400) * barAreaWidth + 10}" y="26" font-family="${font}" font-size="16" font-weight="700" fill="${palette.ink}">${chaserMult.toFixed(1)}×</text>
    ` : ""}

    <!-- Target bar -->
    <text x="-10" y="${barHeight + 30}" text-anchor="end" font-family="${font}" font-size="13" font-weight="500" fill="${palette.muted}">${escapeXml(truncateName(targetName, 15))}</text>
    <rect x="0" y="${barHeight + 18}" width="${barAreaWidth}" height="${barHeight - 16}" rx="4" fill="${palette.barBg}"/>
    ${targetMult != null ? `
    <rect x="0" y="${barHeight + 18}" width="${(targetBarWidth / 400) * barAreaWidth}" height="${barHeight - 16}" rx="4" fill="${palette.target}"/>
    <text x="${(targetBarWidth / 400) * barAreaWidth + 10}" y="${barHeight + 36}" font-family="${font}" font-size="16" font-weight="700" fill="${palette.ink}">${targetMult.toFixed(1)}×</text>
    ` : ""}
  </g>

  <!-- Footer -->
  <line x1="48" y1="${height - footerHeight}" x2="${width - 48}" y2="${height - footerHeight}" stroke="${palette.border}" stroke-opacity="0.5"/>
  <text x="48" y="${height - 18}" font-family="${font}" font-size="13" fill="${palette.faint}">${escapeXml(siteUrl)}</text>
  <text x="${width - 48}" y="${height - 18}" text-anchor="end" font-family="${font}" font-size="11" fill="${palette.faint}">Data: ${escapeXml(dataSource)}</text>
</svg>`;

  return svg;
}
