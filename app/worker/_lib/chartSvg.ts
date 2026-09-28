import { formatMetricValue } from "../../src/lib/convergence";
import type { Scenario } from "./scenario";

export function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const W = 800;
const H = 460;
const PLOT = { left: 72, right: 24, top: 64, bottom: 88 };

/** Nice axis step so ticks land on round numbers. */
function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / pow;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
}

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

export function scenarioAttribution(s: Scenario): string {
  return `Mountain to Climb · ${s.indicator.source ?? "World Bank"} data · Scenario: ${s.chaser.name} ${pct(s.rates.chaser)}, ${s.target.name} ${pct(s.rates.target)}`;
}

/**
 * A self-contained SVG line chart (observed history solid, scenario dashed). Adapts to
 * light/dark via prefers-color-scheme, and carries a title, description and canonical
 * link so a copy of the image still points back to its source.
 */
export function scenarioChartSvg(
  s: Scenario,
  meta: { canonicalUrl: string; summary: string },
): string {
  const rows = [...s.observed, ...s.projection];
  const firstYear = rows[0].year;
  const lastYear = rows[rows.length - 1].year;
  const maxValue = Math.max(...rows.flatMap((r) => [r.chaser, r.target]));
  const step = niceStep(maxValue, 4);
  const yMax = Math.ceil(maxValue / step) * step;

  const x = (year: number) =>
    PLOT.left +
    ((year - firstYear) / Math.max(1, lastYear - firstYear)) * (W - PLOT.left - PLOT.right);
  const y = (value: number) => PLOT.top + (1 - value / yMax) * (H - PLOT.top - PLOT.bottom);

  const path = (data: typeof rows, key: "chaser" | "target") =>
    data
      .map((r, i) => `${i === 0 ? "M" : "L"}${x(r.year).toFixed(1)} ${y(r[key]).toFixed(1)}`)
      .join(" ");

  // The dashed scenario line starts from the last observed point so the lines join up.
  const lastObserved = s.observed.at(-1);
  const scenarioRows = lastObserved ? [lastObserved, ...s.projection] : s.projection;

  const unit = s.indicator.unit;
  const grid: string[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) {
    grid.push(
      `<line class="grid" x1="${PLOT.left}" x2="${W - PLOT.right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>` +
        `<text class="axis" x="${PLOT.left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${escapeXml(formatMetricValue(v, unit))}</text>`,
    );
  }
  const yearStep = lastYear - firstYear > 60 ? 20 : 10;
  const xTicks: string[] = [];
  for (let year = Math.ceil(firstYear / yearStep) * yearStep; year <= lastYear; year += yearStep) {
    xTicks.push(
      `<text class="axis" x="${x(year).toFixed(1)}" y="${H - PLOT.bottom + 20}" text-anchor="middle">${year}</text>`,
    );
  }

  const convergenceYear = s.outcome.convergenceYear;
  const marker =
    convergenceYear != null && convergenceYear >= firstYear && convergenceYear <= lastYear
      ? `<line class="conv" x1="${x(convergenceYear).toFixed(1)}" x2="${x(convergenceYear).toFixed(1)}" y1="${PLOT.top}" y2="${H - PLOT.bottom}"/>` +
        `<text class="conv-label" x="${x(convergenceYear).toFixed(1)}" y="${PLOT.top - 8}" text-anchor="middle">${convergenceYear}</text>`
      : "";

  const heading = `${s.chaser.name} → ${s.target.name}: ${s.indicator.name}`;
  const legendY = H - 44;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
  <title id="t">${escapeXml(heading)}</title>
  <desc id="d">${escapeXml(meta.summary)}</desc>
  <metadata><link xmlns="http://www.w3.org/1999/xhtml" rel="canonical" href="${escapeXml(meta.canonicalUrl)}"/></metadata>
  <style>
    .bg{fill:#fffffe}.ink{fill:#1a1815}.muted{fill:#5c574f}.axis{fill:#5c574f;font:12px system-ui,sans-serif}
    .grid{stroke:#e5e0d8;stroke-width:1}.chaser{stroke:#ea580c}.target{stroke:#059669}
    .conv{stroke:#8b5cf6;stroke-width:1.5;stroke-dasharray:2 3}.conv-label{fill:#8b5cf6;font:600 12px system-ui,sans-serif}
    .line{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.proj{stroke-dasharray:7 5}
    .sw-chaser{fill:#ea580c}.sw-target{fill:#059669}
    @media (prefers-color-scheme: dark){.bg{fill:#1a1918}.ink{fill:#f5f3ef}.muted,.axis{fill:#a8a49c}.grid{stroke:#2a2826}
      .chaser{stroke:#fb923c}.target{stroke:#34d399}.sw-chaser{fill:#fb923c}.sw-target{fill:#34d399}.conv{stroke:#a78bfa}.conv-label{fill:#a78bfa}}
  </style>
  <rect class="bg" width="${W}" height="${H}" rx="12"/>
  <text class="ink" x="${PLOT.left}" y="30" font-family="system-ui,sans-serif" font-size="17" font-weight="600">${escapeXml(heading)}</text>
  <text class="muted" x="${PLOT.left}" y="50" font-family="system-ui,sans-serif" font-size="12">${escapeXml(`Solid: observed · Dashed: scenario from ${s.outcome.start.year}`)}</text>
  ${grid.join("\n  ")}
  ${xTicks.join("\n  ")}
  ${marker}
  <path class="line target" d="${path(s.observed, "target")}"/>
  <path class="line chaser" d="${path(s.observed, "chaser")}"/>
  <path class="line target proj" d="${path(scenarioRows, "target")}"/>
  <path class="line chaser proj" d="${path(scenarioRows, "chaser")}"/>
  <rect class="sw-chaser" x="${PLOT.left}" y="${legendY - 9}" width="12" height="12" rx="2"/>
  <text class="ink" x="${PLOT.left + 18}" y="${legendY + 2}" font-family="system-ui,sans-serif" font-size="13">${escapeXml(s.chaser.name)} (${pct(s.rates.chaser)} a year)</text>
  <rect class="sw-target" x="${PLOT.left + 280}" y="${legendY - 9}" width="12" height="12" rx="2"/>
  <text class="ink" x="${PLOT.left + 298}" y="${legendY + 2}" font-family="system-ui,sans-serif" font-size="13">${escapeXml(s.target.name)} (${pct(s.rates.target)} a year)</text>
  <text class="muted" x="${PLOT.left}" y="${H - 16}" font-family="system-ui,sans-serif" font-size="11">${escapeXml(scenarioAttribution(s))}</text>
</svg>
`;
}
