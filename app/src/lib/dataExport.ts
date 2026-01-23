import type { Indicator } from "../types";
import type { ShareState } from "./shareState";
import {
  generateToolCitation,
  generateDataSourceCitation,
  createCitationContext,
  buildPermalink,
  type CitationFormat,
} from "./citations";
import { WORLD_BANK_INDICATOR_CODES, getDataSourceLicense } from "./dataSourceUrls";

type SeriesPoint = { year: number; value: number };

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Generate CSV header comments with citation info
 */
function generateCsvHeader(params: {
  state: ShareState;
  indicator: Indicator | null;
  chaserName: string;
  targetName: string;
  toolUrl?: string;
}): string {
  const { state, indicator, chaserName, targetName, toolUrl = "https://convergence.example.com" } = params;
  const now = new Date();
  const permalink = buildPermalink(toolUrl, state);
  const source = indicator?.source || "World Bank";
  const sourceCode = WORLD_BANK_INDICATOR_CODES[indicator?.code || state.indicator] || null;
  const license = getDataSourceLicense(source);

  const lines = [
    "# Convergence Explorer Data Export",
    `# Generated: ${now.toISOString()}`,
    `# Comparison: ${chaserName} → ${targetName}`,
    `# Indicator: ${indicator?.name || state.indicator}`,
    `# URL: ${permalink}`,
    `# Data Source: ${source}${sourceCode ? ` (${sourceCode})` : ""}`,
    `# License: CC-BY 4.0 (visualizations)${license ? `, ${license.name} (data)` : ""}`,
    "#",
  ];

  return lines.join("\n");
}

export function toObservedCsv(params: {
  state: ShareState;
  indicator: Indicator | null;
  countriesByIso3: Record<string, { name: string }>;
  data: Record<string, SeriesPoint[]>;
  toolUrl?: string;
}) {
  const { state, indicator, countriesByIso3, data, toolUrl } = params;

  const chaserName = countriesByIso3[state.chaser]?.name || state.chaser;
  const targetName = countriesByIso3[state.target]?.name || state.target;

  const csvHeader = generateCsvHeader({
    state,
    indicator,
    chaserName,
    targetName,
    toolUrl,
  });

  const columnHeader = [
    "country_iso3",
    "country_name",
    "indicator",
    "indicator_name",
    "year",
    "value",
    "unit",
    "source",
  ];

  const rows: string[] = [csvHeader, columnHeader.join(",")];
  for (const iso3 of [state.chaser, state.target]) {
    const name = countriesByIso3[iso3]?.name || iso3;
    const series = data[iso3] || [];
    for (const point of series) {
      rows.push(
        [
          iso3,
          csvEscape(name),
          state.indicator,
          csvEscape(indicator?.name || state.indicator),
          String(point.year),
          String(point.value),
          csvEscape(indicator?.unit || ""),
          csvEscape(indicator?.source || ""),
        ].join(",")
      );
    }
  }
  return rows.join("\n");
}

export function toProjectionCsv(params: {
  state: ShareState;
  indicator: Indicator | null;
  projection: Array<{ year: number; chaser: number; target: number }>;
  chaserName?: string;
  targetName?: string;
  toolUrl?: string;
}) {
  const { state, indicator, projection, toolUrl } = params;
  const chaserName = params.chaserName || state.chaser;
  const targetName = params.targetName || state.target;

  const csvHeader = generateCsvHeader({
    state,
    indicator,
    chaserName,
    targetName,
    toolUrl,
  });

  const columnHeader = [
    "year",
    "chaser_iso3",
    "chaser_value",
    "target_iso3",
    "target_value",
    "indicator",
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
        state.chaser,
        String(p.chaser),
        state.target,
        String(p.target),
        state.indicator,
        csvEscape(indicator?.unit || ""),
        String(state.baseYear),
        String(state.cg),
        String(state.tg),
        state.tmode,
      ].join(",")
    );
  }

  return rows.join("\n");
}

export function toReportJson(params: {
  state: ShareState;
  indicator: Indicator | null;
  countriesByIso3: Record<string, { name: string }>;
  observed: Record<string, SeriesPoint[]>;
  projection: Array<{ year: number; chaser: number; target: number }>;
  derived: { yearsToConvergence: number; convergenceYear: number | null; gap: number };
  toolUrl?: string;
}) {
  const { state, indicator, countriesByIso3, observed, projection, derived, toolUrl = "https://convergence.example.com" } = params;

  const chaserName = countriesByIso3[state.chaser]?.name || state.chaser;
  const targetName = countriesByIso3[state.target]?.name || state.target;
  const now = new Date();
  const permalink = buildPermalink(toolUrl, state);

  // Generate citations
  const citationContext = createCitationContext({
    state,
    indicator: indicator ? { code: indicator.code, name: indicator.name, source: indicator.source } : null,
    chaserName,
    targetName,
    toolUrl,
    accessDate: now,
  });

  const toolCitations: Record<CitationFormat, string> = {
    bibtex: generateToolCitation(citationContext, "bibtex"),
    apa: generateToolCitation(citationContext, "apa"),
    chicago: generateToolCitation(citationContext, "chicago"),
    plaintext: generateToolCitation(citationContext, "plaintext"),
  };

  // Data source citation
  const source = indicator?.source || "World Bank";
  const sourceCode = WORLD_BANK_INDICATOR_CODES[indicator?.code || state.indicator] || null;
  const indicatorName = indicator?.name || state.indicator;
  const indicatorCode = indicator?.code || state.indicator;

  const dataCitations: Record<CitationFormat, string> = {
    bibtex: generateDataSourceCitation(source, sourceCode, indicatorName, indicatorCode, now, "bibtex"),
    apa: generateDataSourceCitation(source, sourceCode, indicatorName, indicatorCode, now, "apa"),
    chicago: generateDataSourceCitation(source, sourceCode, indicatorName, indicatorCode, now, "chicago"),
    plaintext: generateDataSourceCitation(source, sourceCode, indicatorName, indicatorCode, now, "plaintext"),
  };

  const license = getDataSourceLicense(source);

  const lastObservedYear = (iso3: string) => {
    const s = observed[iso3] || [];
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
      citation: {
        tool: toolCitations,
        dataSource: dataCitations,
      },
      dataSource: {
        name: source,
        code: sourceCode,
        indicatorCode,
        license: license ? { name: license.name, url: license.url } : null,
      },
      state,
      indicator: indicator
        ? {
            code: indicator.code,
            name: indicator.name,
            unit: indicator.unit,
            source: indicator.source,
            category: indicator.category,
          }
        : { code: state.indicator },
      countries: {
        chaser: { iso3: state.chaser, name: chaserName },
        target: { iso3: state.target, name: targetName },
      },
      observed: {
        [state.chaser]: {
          lastObservedYear: lastObservedYear(state.chaser),
          series: observed[state.chaser] || [],
        },
        [state.target]: {
          lastObservedYear: lastObservedYear(state.target),
          series: observed[state.target] || [],
        },
      },
      projection,
      derived,
    },
    null,
    2
  );
}
