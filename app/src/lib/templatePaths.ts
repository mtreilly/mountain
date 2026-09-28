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
  {
    code: "CAPITAL_FORMATION_PCT_GDP",
    transform: "logx",
    apply: "add",
    clamp: { min: 0, max: 100 },
  },
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
  interpolateY: (a: number, b: number, t: number) => number,
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

// How far a path is carried on past the incomes it has actually seen. Elasticity is
// the % change in the metric per 1% change in income.
const EDGE_SHARE = 1 / 3; // trend measured over the outer third of the path's log-income range
const ELASTICITY_MIN = 0; // never extrapolate declines indefinitely
const ELASTICITY_MAX = 1.5;

/** Least-squares slope of log(y) on log(gdp). */
function logLogSlope(pairs: Array<{ gdp: number; y: number }>): number | null {
  if (pairs.length < 3) return null;
  const xs = pairs.map((p) => Math.log(p.gdp));
  const ys = pairs.map((p) => Math.log(p.y));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den > 0 ? num / den : null;
}

/**
 * Income elasticity near one end of a path, measured within each template country
 * (pooling countries would mix up their different levels) and averaged by points.
 */
function edgeElasticity(
  perIso: Array<Array<{ gdp: number; y: number }>>,
  edge: "low" | "high",
  logMin: number,
  logMax: number,
): number {
  const cutoff =
    edge === "high"
      ? logMax - (logMax - logMin) * EDGE_SHARE
      : logMin + (logMax - logMin) * EDGE_SHARE;
  let weighted = 0;
  let weight = 0;
  for (const pairs of perIso) {
    const inEdge = pairs.filter((p) =>
      edge === "high" ? Math.log(p.gdp) >= cutoff : Math.log(p.gdp) <= cutoff,
    );
    const slope = logLogSlope(inEdge);
    if (slope == null) continue;
    weighted += slope * inEdge.length;
    weight += inEdge.length;
  }
  const slope = weight > 0 ? weighted / weight : 0;
  return clamp(slope, ELASTICITY_MIN, ELASTICITY_MAX);
}

export function buildTemplateMapping(params: {
  gdpByIso: Record<string, SeriesPoint[]>;
  metricByIso: Record<string, SeriesPoint[]>;
  iso3: string[];
  metricTransform: MetricTransform;
}) {
  const { gdpByIso, metricByIso, iso3, metricTransform } = params;
  const requirePositiveY = metricTransform === "loglog";

  const perIso = iso3.map((iso) =>
    makePairs({
      gdpSeries: gdpByIso[iso] || [],
      metricSeries: metricByIso[iso] || [],
      requirePositiveY,
    }),
  );
  const pooledPairs = perIso.flat();

  pooledPairs.sort((a, b) => a.gdp - b.gdp);
  const points = dedupeByGdp(pooledPairs);
  const gdpMin = points.length ? points[0].gdp : null;
  const gdpMax = points.length ? points[points.length - 1].gdp : null;

  // Past the observed incomes, per-person metrics (loglog) follow the path's trend
  // near that end; shares (logx) stay at the end value because they saturate.
  const extendsTrend = metricTransform === "loglog" && points.length >= 2;
  const logMin = gdpMin != null ? Math.log(gdpMin) : 0;
  const logMax = gdpMax != null ? Math.log(gdpMax) : 0;
  const elasticityLow = extendsTrend ? edgeElasticity(perIso, "low", logMin, logMax) : 0;
  const elasticityHigh = extendsTrend ? edgeElasticity(perIso, "high", logMin, logMax) : 0;

  const predict = (gdp: number) => {
    if (metricTransform === "loglog") {
      if (extendsTrend && gdpMax != null && gdp > gdpMax) {
        return points[points.length - 1].y * (gdp / gdpMax) ** elasticityHigh;
      }
      if (extendsTrend && gdpMin != null && gdp > 0 && gdp < gdpMin) {
        return points[0].y * (gdp / gdpMin) ** elasticityLow;
      }
      return interpolateInLogX(points, gdp, logLerpPositive);
    }
    return interpolateInLogX(points, gdp, lerp);
  };

  /** Whether an income is outside what the path's countries have actually seen. */
  const isOutsideRange = (gdp: number) =>
    gdpMin == null || gdpMax == null || gdp < gdpMin || gdp > gdpMax;

  return { points, predict, gdpMin, gdpMax, elasticityLow, elasticityHigh, isOutsideRange };
}

export function estimateFromTemplate(params: {
  templateAtCurrentGdp: number | null;
  templateAtFutureGdp: number | null;
  chaserCurrentMetric: number | null;
  apply: MetricApply;
  clampRange?: { min: number; max: number };
}) {
  const { templateAtCurrentGdp, templateAtFutureGdp, chaserCurrentMetric, apply, clampRange } =
    params;
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
