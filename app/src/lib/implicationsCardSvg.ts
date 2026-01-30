/**
 * SVG generator for implications summary card.
 * Shows macro implications: electricity, urbanization, emissions.
 */

import { formatNumber } from "./convergence";
import type { ImplicationsData } from "./threadGenerator";

export interface ImplicationsCardParams {
  chaserName: string;
  implicationsData: ImplicationsData;
  horizonYear: number;
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
    electricity: "#f59e0b",
    urban: "#3b82f6",
    emissions: "#10b981",
    gdp: "#8b5cf6",
  },
  dark: {
    bgTop: "#0f0e0d",
    bgBottom: "#0a0908",
    card: "#1a1918",
    border: "#2a2826",
    ink: "#f5f3ef",
    muted: "#a8a49c",
    faint: "#6b675f",
    electricity: "#fbbf24",
    urban: "#60a5fa",
    emissions: "#34d399",
    gdp: "#a78bfa",
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

function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1e12) {
    return `${(value / 1e12).toFixed(1)}T`;
  }
  if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  return formatNumber(Math.round(value));
}

export function generateImplicationsCardSvg(params: ImplicationsCardParams): string {
  const {
    chaserName,
    implicationsData,
    horizonYear,
    theme,
    siteUrl = "convergence-explorer.com",
    dataSource = "World Bank",
  } = params;

  const width = 1200;
  const height = 675;
  const palette = PALETTES[theme];
  const font = FONT_FAMILY;

  const {
    electricityDeltaTWh,
    nuclearPlants,
    urbanDeltaPersons,
    homesNeeded,
    co2DeltaMt,
    gdpCurrent,
    gdpFuture,
  } = implicationsData;

  // Layout
  const headerHeight = 100;
  const footerHeight = 50;
  const cardY = headerHeight + 30;
  const cardHeight = 180;
  const cardWidth = 340;
  const gap = 30;
  const leftX = (width - (cardWidth * 3 + gap * 2)) / 2;

  // GDP summary area
  const gdpY = cardY + cardHeight + 40;

  // Build implication cards
  interface ImplCard {
    icon: string;
    title: string;
    value: string | null;
    subtitle: string | null;
    color: string;
  }

  const cards: ImplCard[] = [
    {
      icon: "⚡",
      title: "ELECTRICITY",
      value: electricityDeltaTWh != null ? `+${Math.round(electricityDeltaTWh)} TWh` : null,
      subtitle: nuclearPlants != null ? `≈${Math.round(nuclearPlants)} nuclear plants` : null,
      color: palette.electricity,
    },
    {
      icon: "🏠",
      title: "URBANIZATION",
      value: urbanDeltaPersons != null ? `+${formatLargeNumber(urbanDeltaPersons)} people` : null,
      subtitle: homesNeeded != null ? `≈${formatLargeNumber(homesNeeded)} homes` : null,
      color: palette.urban,
    },
    {
      icon: "🌍",
      title: "EMISSIONS",
      value: co2DeltaMt != null ? `${co2DeltaMt >= 0 ? "+" : ""}${Math.round(co2DeltaMt)} MtCO₂` : null,
      subtitle: "Territorial emissions",
      color: palette.emissions,
    },
  ];

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
    ${escapeXml(truncateName(chaserName, 30))}
  </text>
  <text x="48" y="75" font-family="${font}" font-size="18" font-weight="500" fill="${palette.muted}">
    What convergence means by ${horizonYear}
  </text>

  <!-- Implication Cards -->
  ${cards.map((card, i) => `
  <g transform="translate(${leftX + i * (cardWidth + gap)}, ${cardY})">
    <rect width="${cardWidth}" height="${cardHeight}" rx="16" fill="${palette.card}" stroke="${palette.border}"/>

    <!-- Icon circle -->
    <circle cx="40" cy="40" r="28" fill="${card.color}" fill-opacity="0.15"/>
    <text x="40" y="50" text-anchor="middle" font-size="28">${card.icon}</text>

    <!-- Title -->
    <text x="80" y="35" font-family="${font}" font-size="11" font-weight="700" fill="${palette.faint}" letter-spacing="0.8">${escapeXml(card.title)}</text>

    <!-- Value -->
    ${card.value != null ? `
    <text x="24" y="100" font-family="${font}" font-size="32" font-weight="800" fill="${palette.ink}">${escapeXml(card.value)}</text>
    ` : `
    <text x="24" y="100" font-family="${font}" font-size="20" fill="${palette.faint}">Data unavailable</text>
    `}

    <!-- Subtitle -->
    ${card.subtitle != null ? `
    <text x="24" y="140" font-family="${font}" font-size="14" fill="${palette.muted}">${escapeXml(card.subtitle)}</text>
    ` : ""}

    <!-- Accent bar (bottom rounded corners via clip-path) -->
    <defs>
      <clipPath id="accentClip${i}">
        <rect x="0" y="${cardHeight - 16}" width="${cardWidth}" height="32" rx="16"/>
      </clipPath>
    </defs>
    <rect x="0" y="${cardHeight - 6}" width="${cardWidth}" height="6" fill="${card.color}" fill-opacity="0.6" clip-path="url(#accentClip${i})"/>
  </g>
  `).join("")}

  <!-- GDP Summary -->
  <g transform="translate(${leftX}, ${gdpY})">
    <rect width="${cardWidth * 3 + gap * 2}" height="80" rx="12" fill="${palette.card}" stroke="${palette.border}"/>

    <!-- GDP Icon -->
    <circle cx="50" cy="40" r="24" fill="${palette.gdp}" fill-opacity="0.15"/>
    <text x="50" y="48" text-anchor="middle" font-size="22">💰</text>

    <!-- GDP Label -->
    <text x="90" y="30" font-family="${font}" font-size="11" font-weight="700" fill="${palette.faint}" letter-spacing="0.8">GDP (TOTAL)</text>

    <!-- GDP Values -->
    ${gdpCurrent != null && gdpFuture != null ? `
    <text x="90" y="55" font-family="${font}" font-size="24" font-weight="700" fill="${palette.ink}">$${formatLargeNumber(gdpCurrent)}</text>
    <text x="250" y="55" font-family="${font}" font-size="18" fill="${palette.muted}">→</text>
    <text x="280" y="55" font-family="${font}" font-size="24" font-weight="700" fill="${palette.gdp}">$${formatLargeNumber(gdpFuture)}</text>
    <text x="430" y="55" font-family="${font}" font-size="14" fill="${palette.muted}">by ${horizonYear}</text>
    ` : `
    <text x="90" y="50" font-family="${font}" font-size="16" fill="${palette.faint}">GDP projection data unavailable</text>
    `}
  </g>

  <!-- Disclaimer -->
  <text x="${width / 2}" y="${gdpY + 110}" text-anchor="middle" font-family="${font}" font-size="11" fill="${palette.faint}">
    Estimates based on template country development paths. Actual outcomes vary by policy and technology.
  </text>

  <!-- Footer -->
  <line x1="48" y1="${height - footerHeight}" x2="${width - 48}" y2="${height - footerHeight}" stroke="${palette.border}" stroke-opacity="0.5"/>
  <text x="48" y="${height - 18}" font-family="${font}" font-size="13" fill="${palette.faint}">${escapeXml(siteUrl)}</text>
  <text x="${width - 48}" y="${height - 18}" text-anchor="end" font-family="${font}" font-size="11" fill="${palette.faint}">Data: ${escapeXml(dataSource)}</text>
</svg>`;

  return svg;
}
