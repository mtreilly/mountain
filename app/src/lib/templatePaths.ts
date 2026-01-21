export type TemplateId = "china" | "us" | "eu";

export const TEMPLATE_PATHS: Array<{
  id: TemplateId;
  label: string;
  iso3: string[];
}> = [
  { id: "china", label: "China-like", iso3: ["CHN"] },
  { id: "us", label: "US-like", iso3: ["USA"] },
  { id: "eu", label: "Europe-like", iso3: ["DEU", "FRA", "GBR"] },
];

export const IMPLICATION_METRIC_CODES = [
  "ENERGY_USE_PCAP",
  "ELECTRICITY_USE_PCAP",
  "CO2_PCAP",
  "URBAN_POP_PCT",
  "INDUSTRY_VA_PCT_GDP",
  "CAPITAL_FORMATION_PCT_GDP",
] as const;

export type ImplicationMetricCode = (typeof IMPLICATION_METRIC_CODES)[number];

export type MetricTransform = "loglog" | "logx";
export type MetricApply = "multiply" | "add";

export const IMPLICATION_METRICS: Array<{
  code: ImplicationMetricCode;
  transform: MetricTransform;
  apply: MetricApply;
  clamp?: { min: number; max: number };
}> = [
  { code: "ENERGY_USE_PCAP", transform: "loglog", apply: "multiply" },
  { code: "ELECTRICITY_USE_PCAP", transform: "loglog", apply: "multiply" },
  { code: "CO2_PCAP", transform: "loglog", apply: "multiply" },
  { code: "URBAN_POP_PCT", transform: "logx", apply: "add", clamp: { min: 0, max: 100 } },
  { code: "INDUSTRY_VA_PCT_GDP", transform: "logx", apply: "add", clamp: { min: 0, max: 100 } },
  { code: "CAPITAL_FORMATION_PCT_GDP", transform: "logx", apply: "add", clamp: { min: 0, max: 100 } },
];

export type SeriesPoint = { year: number; value: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makePairs(params: {
  gdpSeries: SeriesPoint[];
  metricSeries: SeriesPoint[];
  requirePositiveY: boolean;
}) {
  const { gdpSeries, metricSeries, requirePositiveY } = params;
  const byYear = new Map<number, number>();
  for (const p of gdpSeries) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    byYear.set(p.year, p.value);
  }

  const pairs: Array<{ gdp: number; y: number }> = [];
  for (const p of metricSeries) {
    const gdp = byYear.get(p.year);
    if (gdp == null) continue;
    const y = p.value;
    if (!Number.isFinite(y)) continue;
    if (requirePositiveY && y <= 0) continue;
    pairs.push({ gdp, y });
  }

  pairs.sort((a, b) => a.gdp - b.gdp);
  return dedupeByGdp(pairs);
}

function dedupeByGdp(pairs: Array<{ gdp: number; y: number }>) {
  if (pairs.length <= 1) return pairs;
  const out: Array<{ gdp: number; y: number }> = [];
  let i = 0;
  while (i < pairs.length) {
    const gdp = pairs[i].gdp;
    let sum = 0;
    let n = 0;
    while (i < pairs.length && pairs[i].gdp === gdp) {
      sum += pairs[i].y;
      n += 1;
      i += 1;
    }
    out.push({ gdp, y: sum / Math.max(1, n) });
  }
  return out;
}

function interpolateInLogX(
  points: Array<{ gdp: number; y: number }>,
  gdp: number,
  interpolateY: (a: number, b: number, t: number) => number
) {
  if (points.length < 2) return null;
  if (!Number.isFinite(gdp) || gdp <= 0) return null;

  const x = Math.log(gdp);
  const xs = points.map((p) => Math.log(p.gdp));

  if (x <= xs[0]) return points[0].y;
  if (x >= xs[xs.length - 1]) return points[points.length - 1].y;

  let hi = 1;
  while (hi < xs.length && xs[hi] < x) hi += 1;
  const lo = Math.max(0, hi - 1);

  const x0 = xs[lo];
  const x1 = xs[hi];
  const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return interpolateY(points[lo].y, points[hi].y, t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function logLerpPositive(a: number, b: number, t: number) {
  if (a <= 0 || b <= 0) return lerp(a, b, t);
  return Math.exp(lerp(Math.log(a), Math.log(b), t));
}

export function buildTemplateMapping(params: {
  gdpByIso: Record<string, SeriesPoint[]>;
  metricByIso: Record<string, SeriesPoint[]>;
  iso3: string[];
  metricTransform: MetricTransform;
}) {
  const { gdpByIso, metricByIso, iso3, metricTransform } = params;
  const requirePositiveY = metricTransform === "loglog";

  const pooledPairs: Array<{ gdp: number; y: number }> = [];
  for (const iso of iso3) {
    const g = gdpByIso[iso] || [];
    const m = metricByIso[iso] || [];
    pooledPairs.push(
      ...makePairs({ gdpSeries: g, metricSeries: m, requirePositiveY })
    );
  }

  pooledPairs.sort((a, b) => a.gdp - b.gdp);
  const points = dedupeByGdp(pooledPairs);
  const gdpMin = points.length ? points[0].gdp : null;
  const gdpMax = points.length ? points[points.length - 1].gdp : null;

  const predict = (gdp: number) => {
    if (metricTransform === "loglog") {
      return interpolateInLogX(points, gdp, logLerpPositive);
    }
    return interpolateInLogX(points, gdp, lerp);
  };

  return { points, predict, gdpMin, gdpMax };
}

export function estimateFromTemplate(params: {
  templateAtCurrentGdp: number | null;
  templateAtFutureGdp: number | null;
  chaserCurrentMetric: number | null;
  apply: MetricApply;
  clampRange?: { min: number; max: number };
}) {
  const { templateAtCurrentGdp, templateAtFutureGdp, chaserCurrentMetric, apply, clampRange } = params;
  if (templateAtFutureGdp == null || !Number.isFinite(templateAtFutureGdp)) return null;

  let estimated: number | null = null;

  if (
    chaserCurrentMetric != null &&
    Number.isFinite(chaserCurrentMetric) &&
    templateAtCurrentGdp != null &&
    Number.isFinite(templateAtCurrentGdp)
  ) {
    if (apply === "multiply") {
      if (templateAtCurrentGdp !== 0) {
        estimated = chaserCurrentMetric * (templateAtFutureGdp / templateAtCurrentGdp);
      }
    } else {
      estimated = chaserCurrentMetric + (templateAtFutureGdp - templateAtCurrentGdp);
    }
  } else {
    estimated = templateAtFutureGdp;
  }

  if (estimated == null || !Number.isFinite(estimated)) return null;
  if (clampRange) return clamp(estimated, clampRange.min, clampRange.max);
  return estimated;
}
