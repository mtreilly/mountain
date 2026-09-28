/**
 * The convergence model: the one place that decides where a projection starts and
 * when the chaser catches the target.
 *
 * Every surface (the app, regions, share pages, OG images, the public API, thread
 * and sensitivity cards) calls these functions instead of repeating the maths, so a
 * data update moves every reported year together. scripts/test.ts fails if
 * `Math.log(ratio) / Math.log(...)` appears anywhere else.
 */

export interface YearValue {
  year: number;
  value: number;
}

/** Values for both sides at the same year. */
export interface PairPoint {
  year: number;
  chaser: number;
  target: number;
}

export interface GrowthRates {
  chaserRate: number;
  targetRate: number;
}

/** The latest year both series have a value, or null when they never overlap. */
export function latestCommonPoint(chaser: YearValue[], target: YearValue[]): PairPoint | null {
  const targetByYear = new Map(target.map((p) => [p.year, p.value]));
  let best: PairPoint | null = null;
  for (const { year, value } of chaser) {
    const other = targetByYear.get(year);
    if (other == null || (best && year <= best.year)) continue;
    best = { year, chaser: value, target: other };
  }
  return best;
}

/**
 * Where projections start: the year after the latest shared data, or `baseYear` if
 * that is later. `baseYear` is a floor chosen by the user, never a data year; values
 * are grown forward from the shared data point to the start year.
 */
export function projectionStart(
  handoff: PairPoint,
  baseYear: number,
  { chaserRate, targetRate }: GrowthRates,
): PairPoint {
  const year = Math.max(baseYear, handoff.year + 1);
  const steps = year - handoff.year;
  return {
    year,
    chaser: handoff.chaser * (1 + chaserRate) ** steps,
    target: handoff.target * (1 + targetRate) ** steps,
  };
}

/** Years until the chaser matches the target: 0 if already ahead, Infinity if never. */
export function yearsToConverge(
  chaserValue: number,
  targetValue: number,
  { chaserRate, targetRate }: GrowthRates,
): number {
  if (chaserValue >= targetValue) return 0;
  const growthRatio = (1 + chaserRate) / (1 + targetRate);
  if (!(growthRatio > 1) || !(chaserValue > 0)) return Number.POSITIVE_INFINITY;
  const ratio = targetValue / chaserValue;
  return Math.log(ratio) / Math.log(growthRatio);
}

/** Calendar year of convergence for a projection starting at `startYear`, or null if never. */
export function convergenceYearFrom(startYear: number, years: number): number | null {
  return Number.isFinite(years) ? Math.round(startYear + years) : null;
}

export interface ConvergenceOutcome {
  start: PairPoint;
  yearsToConvergence: number;
  convergenceYear: number | null;
}

/** Start, years and calendar year of convergence from the latest shared data. */
export function convergenceOutcome(params: {
  handoff: PairPoint;
  baseYear: number;
  rates: GrowthRates;
}): ConvergenceOutcome {
  const start = projectionStart(params.handoff, params.baseYear, params.rates);
  const years = yearsToConverge(start.chaser, start.target, params.rates);
  return {
    start,
    yearsToConvergence: years,
    convergenceYear: convergenceYearFrom(start.year, years),
  };
}
