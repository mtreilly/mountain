/**
 * SVG generator for sensitivity analysis card.
 * Shows three-line chart with baseline, optimistic, and pessimistic scenarios.
 */

import { formatMetricValue, formatYears } from "./convergence";
import type { SensitivityResult } from "./sensitivityAnalysis";
import { generateSensitivityProjection } from "./sensitivityAnalysis";

export interface SensitivityCardParams {
  chaserName: string;
  targetName: string;
  chaserValue: number;
  targetValue: number;
  metricUnit?: string | null;
  sensitivity: SensitivityResult;
  baseYear: number;
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
    baseline: "#6366f1",
    optimistic: "#22c55e",
    pessimistic: "#ef4444",
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
    baseline: "#818cf8",
    optimistic: "#4ade80",
    pessimistic: "#f87171",
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

function buildMultiLinePaths(
  projections: {
    baseline: Array<{ year: number; chaser: number; target: number }>;
    optimistic: Array<{ year: number; chaser: number; target: number }>;
    pessimistic: Array<{ year: number; chaser: number; target: number }>;
  },
  geometry: ChartGeometry
): {
  baselinePath: string;
  optimisticPath: string;
  pessimisticPath: string;
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

  // Collect all years and values across all projections
  const allYears: number[] = [];
  const allValues: number[] = [];

  for (const proj of [projections.baseline, projections.optimistic, projections.pessimistic]) {
    for (const p of proj) {
      allYears.push(p.year);
      allValues.push(p.chaser, p.target);
    }
  }

  const xMin = Math.min(...allYears);
  const xMax = Math.max(...allYears);
  const xRange = Math.max(1, xMax - xMin);
  const yMax = Math.max(...allValues) * 1.1;

  const scales = {
    x: (year: number) => x + padding.left + ((year - xMin) / xRange) * chartWidth,
    y: (value: number) => y + padding.top + chartHeight - (value / yMax) * chartHeight,
    xMin,
    xMax,
    yMax,
  };

  const buildPath = (proj: Array<{ year: number; chaser: number }>) =>
    proj
      .map((d, i) => `${i === 0 ? "M" : "L"} ${scales.x(d.year).toFixed(1)} ${scales.y(d.chaser).toFixed(1)}`)
      .join(" ");

  return {
    baselinePath: buildPath(projections.baseline),
    optimisticPath: buildPath(projections.optimistic),
    pessimisticPath: buildPath(projections.pessimistic),
    targetPath: projections.baseline
      .map((d, i) => `${i === 0 ? "M" : "L"} ${scales.x(d.year).toFixed(1)} ${scales.y(d.target).toFixed(1)}`)
      .join(" "),
    scales,
  };
}

export function generateSensitivityCardSvg(params: SensitivityCardParams): string {
  const {
    chaserName,
    targetName,
    chaserValue,
    targetValue,
    metricUnit,
    sensitivity,
    baseYear,
    theme,
    siteUrl = "convergence-explorer.com",
    dataSource = "World Bank",
  } = params;

  const width = 1200;
  const height = 675;
  const palette = PALETTES[theme];
  const font = FONT_FAMILY;

  // Generate projections for all three scenarios
  const maxYears = 100;
  const projections = {
    baseline: generateSensitivityProjection(
      chaserValue, targetValue,
      sensitivity.baseline.chaserGrowth,
      sensitivity.baseline.targetGrowth,
      baseYear, maxYears
    ),
    optimistic: generateSensitivityProjection(
      chaserValue, targetValue,
      sensitivity.optimistic.chaserGrowth,
      sensitivity.optimistic.targetGrowth,
      baseYear, maxYears
    ),
    pessimistic: generateSensitivityProjection(
      chaserValue, targetValue,
      sensitivity.pessimistic.chaserGrowth,
      sensitivity.pessimistic.targetGrowth,
      baseYear, maxYears
    ),
  };

  // Layout calculations
  const headerHeight = 100;
  const footerHeight = 50;
  const chartAreaY = headerHeight + 10;
  const chartAreaHeight = height - headerHeight - footerHeight - 30;
  const chartWidth = 700;
  const tableX = chartWidth + 80;

  const chartGeometry: ChartGeometry = {
    x: 48,
    y: chartAreaY,
    width: chartWidth,
    height: chartAreaHeight,
    padding: { top: 30, right: 40, bottom: 40, left: 60 },
  };

  const { baselinePath, optimisticPath, pessimisticPath, targetPath, scales } =
    buildMultiLinePaths(projections, chartGeometry);

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
    const step = Math.max(1, Math.ceil(rough / 10) * 10);
    for (let year = scales.xMin; year <= scales.xMax; year += step) {
      xTicks.push(year);
    }
  }

  // Scenario table data
  const scenarios = [
    { label: sensitivity.optimistic.label, years: sensitivity.optimistic.yearsToConvergence, color: palette.optimistic },
    { label: "Baseline", years: sensitivity.baseline.yearsToConvergence, color: palette.baseline },
    { label: sensitivity.pessimistic.label, years: sensitivity.pessimistic.yearsToConvergence, color: palette.pessimistic },
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
    ${escapeXml(truncateName(chaserName, 20))} → ${escapeXml(truncateName(targetName, 20))}
  </text>
  <text x="48" y="75" font-family="${font}" font-size="18" font-weight="500" fill="${palette.muted}">
    What if growth changes by ±1%?
  </text>

  <!-- Chart area -->
  <rect x="${chartGeometry.x}" y="${chartGeometry.y}" width="${chartGeometry.width}" height="${chartGeometry.height}" rx="12" fill="${palette.card}" stroke="${palette.border}" stroke-opacity="0.5"/>

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

  <!-- Target line (dashed gray) -->
  <path d="${targetPath}" fill="none" stroke="${palette.faint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8,6"/>

  <!-- Pessimistic line (red dashed) -->
  <path d="${pessimisticPath}" fill="none" stroke="${palette.pessimistic}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8,4"/>

  <!-- Optimistic line (green dashed) -->
  <path d="${optimisticPath}" fill="none" stroke="${palette.optimistic}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8,4"/>

  <!-- Baseline line (solid) -->
  <path d="${baselinePath}" fill="none" stroke="${palette.baseline}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Scenario Table -->
  <g transform="translate(${tableX}, ${chartAreaY + 20})">
    <text x="0" y="0" font-family="${font}" font-size="14" font-weight="700" fill="${palette.ink}">Scenarios</text>
    <rect x="0" y="16" width="280" height="${scenarios.length * 50 + 20}" rx="8" fill="${palette.card}" stroke="${palette.border}"/>
    ${scenarios.map((s, i) => `
    <g transform="translate(16, ${36 + i * 50})">
      <rect x="0" y="4" width="12" height="12" rx="3" fill="${s.color}"/>
      <text x="22" y="14" font-family="${font}" font-size="14" font-weight="500" fill="${palette.ink}">${escapeXml(s.label)}</text>
      <text x="248" y="14" text-anchor="end" font-family="${font}" font-size="18" font-weight="700" fill="${palette.ink}">${s.years != null && Number.isFinite(s.years) && s.years > 0 ? formatYears(s.years) : "Never"}</text>
    </g>
    `).join("")}
  </g>

  <!-- Legend -->
  <g transform="translate(${tableX}, ${chartAreaY + 220})">
    <rect x="0" y="0" width="280" height="90" rx="8" fill="${palette.card}" stroke="${palette.border}"/>
    <g transform="translate(16, 24)">
      <line x1="0" y1="0" x2="24" y2="0" stroke="${palette.baseline}" stroke-width="3"/>
      <text x="32" y="4" font-family="${font}" font-size="12" fill="${palette.muted}">${escapeXml(chaserName)} (baseline)</text>
    </g>
    <g transform="translate(16, 50)">
      <line x1="0" y1="0" x2="24" y2="0" stroke="${palette.faint}" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="32" y="4" font-family="${font}" font-size="12" fill="${palette.muted}">${escapeXml(targetName)}</text>
    </g>
    <g transform="translate(16, 76)">
      <text x="0" y="0" font-family="${font}" font-size="10" fill="${palette.faint}">Dashed colored lines show ±1% scenarios</text>
    </g>
  </g>

  <!-- Footer -->
  <line x1="48" y1="${height - footerHeight}" x2="${width - 48}" y2="${height - footerHeight}" stroke="${palette.border}" stroke-opacity="0.5"/>
  <text x="48" y="${height - 18}" font-family="${font}" font-size="13" fill="${palette.faint}">${escapeXml(siteUrl)}</text>
  <text x="${width - 48}" y="${height - 18}" text-anchor="end" font-family="${font}" font-size="11" fill="${palette.faint}">Data: ${escapeXml(dataSource)}</text>
</svg>`;

  return svg;
}
