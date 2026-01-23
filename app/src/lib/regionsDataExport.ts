import type { ShareState } from "./shareState";
import type { OECDRegion, OECDRegionData } from "./oecdRegions";
import { buildPermalink } from "./citations";

type ProjectionPoint = { year: number; chaser: number; target: number };
type SeriesPoint = { year: number; value: number };

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function generateRegionalCsvHeader(params: {
  state: ShareState;
  chaserName: string;
  targetName: string;
  metricName: string;
  unit: string;
  toolUrl?: string;
}): string {
  const { state, chaserName, targetName, metricName, unit, toolUrl = "https://convergence.example.com" } =
    params;
  const now = new Date();
  const permalink = buildPermalink(toolUrl, state);

  const lines = [
    "# Convergence Explorer Data Export",
    `# Generated: ${now.toISOString()}`,
    `# Comparison: ${chaserName} → ${targetName}`,
    `# Metric: ${metricName}`,
    `# Unit: ${unit}`,
    `# URL: ${permalink}`,
    "# Data Source: OECD Regions and Cities at a Glance 2024",
    "# License: CC-BY 4.0 (visualizations)",
    "#",
  ];

  return lines.join("\n");
}

export function toRegionalObservedCsv(params: {
  state: ShareState;
  observed: Record<string, SeriesPoint[]>;
  chaserRegion: OECDRegion;
  targetRegion: OECDRegion;
  toolUrl?: string;
}) {
  const { state, observed, chaserRegion, targetRegion, toolUrl } = params;

  const metricName = "GDP per capita (USD PPP)";
  const unit = "USD PPP";

  const csvHeader = generateRegionalCsvHeader({
    state,
    chaserName: `${chaserRegion.name} (${chaserRegion.countryName})`,
    targetName: `${targetRegion.name} (${targetRegion.countryName})`,
    metricName,
    unit,
    toolUrl,
  });

  const columnHeader = [
    "region_code",
    "region_name",
    "country_code",
    "country_name",
    "year",
    "value",
    "metric",
    "unit",
    "source",
  ];

  const rows: string[] = [csvHeader, columnHeader.join(",")];
  for (const region of [chaserRegion, targetRegion]) {
    const series = observed[region.code] || [];
    for (const point of series) {
      rows.push(
        [
          csvEscape(region.code),
          csvEscape(region.name),
          csvEscape(region.countryCode),
          csvEscape(region.countryName),
          String(point.year),
          String(point.value),
          csvEscape(metricName),
          csvEscape(unit),
          csvEscape("OECD Regions and Cities at a Glance 2024"),
        ].join(",")
      );
    }
  }

  return rows.join("\n");
}

export function toRegionalProjectionCsv(params: {
  state: ShareState;
  projection: ProjectionPoint[];
  chaserRegion: OECDRegion;
  targetRegion: OECDRegion;
  toolUrl?: string;
}) {
  const { state, projection, chaserRegion, targetRegion, toolUrl } = params;

  const metricName = "GDP per capita (USD PPP)";
  const unit = "USD PPP";

  const csvHeader = generateRegionalCsvHeader({
    state,
    chaserName: `${chaserRegion.name} (${chaserRegion.countryName})`,
    targetName: `${targetRegion.name} (${targetRegion.countryName})`,
    metricName,
    unit,
    toolUrl,
  });

  const columnHeader = [
    "year",
    "chaser_region_code",
    "chaser_region_name",
    "chaser_country",
    "chaser_value",
    "target_region_code",
    "target_region_name",
    "target_country",
    "target_value",
    "metric",
    "unit",
    "baseYear",
    "cg",
    "tg",
    "tmode",
  ];

  const rows: string[] = [csvHeader, columnHeader.join(",")];
  for (const p of projection) {
    rows.push(
      [
        String(p.year),
        csvEscape(chaserRegion.code),
        csvEscape(chaserRegion.name),
        csvEscape(chaserRegion.countryName),
        String(p.chaser),
        csvEscape(targetRegion.code),
        csvEscape(targetRegion.name),
        csvEscape(targetRegion.countryName),
        String(p.target),
        csvEscape(metricName),
        csvEscape(unit),
        String(state.baseYear),
        String(state.cg),
        String(state.tg),
        state.tmode,
      ].join(",")
    );
  }

  return rows.join("\n");
}

export function toRegionalReportJson(params: {
  state: ShareState;
  observed: Record<string, OECDRegionData[]>;
  projection: ProjectionPoint[];
  derived: { yearsToConvergence: number; convergenceYear: number | null; gap: number };
  chaserRegion: OECDRegion;
  targetRegion: OECDRegion;
  toolUrl?: string;
}) {
  const {
    state,
    observed,
    projection,
    derived,
    chaserRegion,
    targetRegion,
    toolUrl = "https://convergence.example.com",
  } =
    params;

  const now = new Date();
  const permalink = buildPermalink(toolUrl, state);

  const lastObservedYear = (regionCode: string) => {
    const s = observed[regionCode] || [];
    let max = -Infinity;
    for (const p of s) max = Math.max(max, p.year);
    return Number.isFinite(max) ? max : null;
  };

  return JSON.stringify(
    {
      meta: {
        generated: now.toISOString(),
        tool: "Convergence Explorer",
        version: "1.0",
        permalink,
      },
      dataSource: {
        name: "OECD Regions and Cities at a Glance 2024",
        metric: "GDP per capita (USD PPP)",
        unit: "USD PPP",
        license: { name: "CC-BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
      },
      state,
      regions: {
        chaser: chaserRegion,
        target: targetRegion,
      },
      observed: {
        [chaserRegion.code]: {
          lastObservedYear: lastObservedYear(chaserRegion.code),
          series: (observed[chaserRegion.code] || []).map((p) => ({
            year: p.year,
            value: p.gdpPerCapita,
          })),
        },
        [targetRegion.code]: {
          lastObservedYear: lastObservedYear(targetRegion.code),
          series: (observed[targetRegion.code] || []).map((p) => ({
            year: p.year,
            value: p.gdpPerCapita,
          })),
        },
      },
      projection,
      derived,
    },
    null,
    2
  );
}
