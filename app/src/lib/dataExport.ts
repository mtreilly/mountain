import type { Indicator } from "../types";
import type { ShareState } from "./shareState";

type SeriesPoint = { year: number; value: number };

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toObservedCsv(params: {
  state: ShareState;
  indicator: Indicator | null;
  countriesByIso3: Record<string, { name: string }>;
  data: Record<string, SeriesPoint[]>;
}) {
  const { state, indicator, countriesByIso3, data } = params;
  const header = [
    "country_iso3",
    "country_name",
    "indicator",
    "indicator_name",
    "year",
    "value",
    "unit",
    "source",
  ];

  const rows: string[] = [header.join(",")];
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
}) {
  const { state, indicator, projection } = params;
  const header = [
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

  const rows: string[] = [header.join(",")];
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
}) {
  const { state, indicator, countriesByIso3, observed, projection, derived } = params;

  const lastObservedYear = (iso3: string) => {
    const s = observed[iso3] || [];
    let max = -Infinity;
    for (const p of s) max = Math.max(max, p.year);
    return Number.isFinite(max) ? max : null;
  };

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
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
        chaser: { iso3: state.chaser, name: countriesByIso3[state.chaser]?.name || state.chaser },
        target: { iso3: state.target, name: countriesByIso3[state.target]?.name || state.target },
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

