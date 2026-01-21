import type { ImplicationMetricCode } from "./templatePaths";

export type SeriesPoint = { year: number; value: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function projectValue(value: number, growthRate: number, years: number) {
  return value * Math.pow(1 + growthRate, years);
}

export function calculateCagr(params: {
  series: SeriesPoint[];
  lookbackYears: number;
}): number | null {
  const { series, lookbackYears } = params;
  if (!series.length) return null;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];
  if (!Number.isFinite(latest.value) || latest.value <= 0) return null;

  const targetYear = latest.year - lookbackYears;
  let earlier: SeriesPoint | null = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].year <= targetYear) {
      earlier = sorted[i];
      break;
    }
  }
  if (!earlier) {
    earlier = sorted[0];
  }
  if (!earlier || !Number.isFinite(earlier.value) || earlier.value <= 0) return null;

  const years = latest.year - earlier.year;
  if (years <= 0) return null;
  const rate = Math.pow(latest.value / earlier.value, 1 / years) - 1;
  return Number.isFinite(rate) ? rate : null;
}

export type TotalDisplay =
  | { unit: "persons"; value: number }
  | { unit: "toe"; value: number } // tonnes of oil equivalent
  | { unit: "TWh"; value: number }
  | { unit: "MtCO2"; value: number }
  | { unit: "int$"; value: number };

export function computeTotals(params: {
  code: ImplicationMetricCode;
  currentMetric: number | null;
  impliedMetric: number | null;
  popCurrent: number | null;
  popFuture: number | null;
  gdpPcapCurrent: number;
  gdpPcapFuture: number;
}): { currentTotal: TotalDisplay | null; impliedTotal: TotalDisplay | null } {
  const {
    code,
    currentMetric,
    impliedMetric,
    popCurrent,
    popFuture,
    gdpPcapCurrent,
    gdpPcapFuture,
  } = params;

  const safePopCurrent =
    popCurrent != null && Number.isFinite(popCurrent) && popCurrent > 0 ? popCurrent : null;
  const safePopFuture =
    popFuture != null && Number.isFinite(popFuture) && popFuture > 0 ? popFuture : null;

  const gdpTotalCurrent =
    safePopCurrent != null ? gdpPcapCurrent * safePopCurrent : null;
  const gdpTotalFuture =
    safePopFuture != null ? gdpPcapFuture * safePopFuture : null;

  const metricCurrent =
    currentMetric != null && Number.isFinite(currentMetric) ? currentMetric : null;
  const metricImplied =
    impliedMetric != null && Number.isFinite(impliedMetric) ? impliedMetric : null;

  const toPercent = (x: number) => clamp(x, 0, 100) / 100;

  const perCapToTotal = (perCap: number, pop: number, unit: TotalDisplay["unit"]) => {
    if (unit === "toe") return { unit, value: (perCap * pop) / 1000 }; // kg -> tonnes
    if (unit === "TWh") return { unit, value: (perCap * pop) / 1e9 }; // kWh -> TWh
    if (unit === "MtCO2") return { unit, value: (perCap * pop) / 1e6 }; // t -> Mt
    return null;
  };

  const pctOfGdpToLevel = (pct: number, gdpTotal: number) => {
    return { unit: "int$" as const, value: toPercent(pct) * gdpTotal };
  };

  const pctOfPopToPersons = (pct: number, pop: number) => {
    return { unit: "persons" as const, value: toPercent(pct) * pop };
  };

  switch (code) {
    case "ENERGY_USE_PCAP": {
      if (!safePopCurrent || !safePopFuture) return { currentTotal: null, impliedTotal: null };
      return {
        currentTotal: metricCurrent != null ? perCapToTotal(metricCurrent, safePopCurrent, "toe") : null,
        impliedTotal: metricImplied != null ? perCapToTotal(metricImplied, safePopFuture, "toe") : null,
      };
    }
    case "ELECTRICITY_USE_PCAP": {
      if (!safePopCurrent || !safePopFuture) return { currentTotal: null, impliedTotal: null };
      return {
        currentTotal: metricCurrent != null ? perCapToTotal(metricCurrent, safePopCurrent, "TWh") : null,
        impliedTotal: metricImplied != null ? perCapToTotal(metricImplied, safePopFuture, "TWh") : null,
      };
    }
    case "CO2_PCAP": {
      if (!safePopCurrent || !safePopFuture) return { currentTotal: null, impliedTotal: null };
      return {
        currentTotal: metricCurrent != null ? perCapToTotal(metricCurrent, safePopCurrent, "MtCO2") : null,
        impliedTotal: metricImplied != null ? perCapToTotal(metricImplied, safePopFuture, "MtCO2") : null,
      };
    }
    case "URBAN_POP_PCT": {
      if (!safePopCurrent || !safePopFuture) return { currentTotal: null, impliedTotal: null };
      return {
        currentTotal: metricCurrent != null ? pctOfPopToPersons(metricCurrent, safePopCurrent) : null,
        impliedTotal: metricImplied != null ? pctOfPopToPersons(metricImplied, safePopFuture) : null,
      };
    }
    case "INDUSTRY_VA_PCT_GDP":
    case "CAPITAL_FORMATION_PCT_GDP": {
      if (gdpTotalCurrent == null || gdpTotalFuture == null) return { currentTotal: null, impliedTotal: null };
      return {
        currentTotal: metricCurrent != null ? pctOfGdpToLevel(metricCurrent, gdpTotalCurrent) : null,
        impliedTotal: metricImplied != null ? pctOfGdpToLevel(metricImplied, gdpTotalFuture) : null,
      };
    }
    default:
      return { currentTotal: null, impliedTotal: null };
  }
}

