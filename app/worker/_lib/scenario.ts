import { calculateRequiredChaserGrowthRate } from "../../src/lib/convergence";
import {
  type ConvergenceOutcome,
  convergenceOutcome,
  latestCommonPoint,
  type PairPoint,
  type YearValue,
} from "../../src/lib/convergenceModel";
import { adjustmentFactor, getAdjustment } from "../../src/lib/countryAdjustments";
import { calculateCagr } from "../../src/lib/implicationsMath";
import { parseShareStateFromSearch, toSearchParams } from "../../src/lib/shareState";
import {
  type StaticCountry,
  type StaticIndicator,
  seriesPoints,
} from "../../src/lib/staticDataFormat";
import { countryDisplayName, countrySlug } from "./countrySlugs";
import { loadCountries, loadSeries, type StaticDataEnv } from "./staticData";

/**
 * A convergence scenario for two countries: the same model as the app, share pages and
 * OG images, shaped for the public API, compare pages and SVG charts. Results follow
 * from the stated growth rates. They are scenarios, never forecasts.
 */

/** Growth rate for one side: a number, or its own trailing 10-year CAGR. */
export type RateInput = number | "trailing";
export type RateBasis = "given" | "trailing_10y_cagr" | "fallback";

export interface ScenarioInput {
  chaser: string;
  target: string;
  indicator: string;
  chaserRate: RateInput;
  targetRate: RateInput;
  baseYear: number;
  adjusted: boolean;
}

export interface CountryRef {
  iso: string;
  name: string;
  slug: string;
}

export interface SeriesRow {
  year: number;
  chaser: number;
  target: number;
}

export interface Caveat {
  iso: string;
  country: string;
  title: string;
  explanation: string;
  /** Multiplier applied to this country's values in this scenario (1 when not applied). */
  appliedFactor: number;
  adjustmentFactor: number;
}

export interface Failure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

interface Pair {
  ok: true;
  indicator: StaticIndicator;
  chaser: CountryRef;
  target: CountryRef;
  adjusted: boolean;
  handoff: PairPoint;
  chaserPoints: YearValue[];
  targetPoints: YearValue[];
  caveats: Caveat[];
}

export interface Scenario extends Omit<Pair, "chaserPoints" | "targetPoints"> {
  baseYear: number;
  rates: {
    chaser: number;
    target: number;
    chaserBasis: RateBasis;
    targetBasis: RateBasis;
  };
  outcome: ConvergenceOutcome;
  /** Years both countries have observed values, oldest first. */
  observed: SeriesRow[];
  /** Start year onward, ending shortly after convergence. */
  projection: SeriesRow[];
}

export const DEFAULT_INDICATOR = "GDP_PCAP_PPP";
export const DEFAULT_BASE_YEAR = 2023;
const FALLBACK_RATE = 0.02;
const OBSERVED_YEARS = 30;
const MAX_PROJECTION_YEARS = 100;
const NEVER_PROJECTION_YEARS = 50;
const AFTER_CONVERGENCE_YEARS = 5;
// The app's slider ranges (see parseShareStateFromSearch), so pages and app links agree.
const CHASER_RATE_RANGE = [-0.05, 0.12] as const;
const TARGET_RATE_RANGE = [-0.05, 0.08] as const;

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.max(min, Math.min(max, value));

function countryRef(country: StaticCountry): CountryRef {
  return {
    iso: country.iso_alpha3,
    name: countryDisplayName(country),
    slug: countrySlug(country),
  };
}

export async function loadPair(
  env: StaticDataEnv,
  requestUrl: string,
  params: { chaser: string; target: string; indicator: string; adjusted: boolean },
): Promise<Pair | Failure> {
  const [countries, series] = await Promise.all([
    loadCountries(env, requestUrl),
    loadSeries(env, requestUrl, params.indicator),
  ]);
  if (!series) {
    return {
      ok: false,
      status: 404,
      code: "INDICATOR_NOT_FOUND",
      message: `Unknown indicator ${params.indicator}. See /api/indicators.`,
    };
  }
  const chaser = countries.find((c) => c.iso_alpha3 === params.chaser);
  const target = countries.find((c) => c.iso_alpha3 === params.target);
  if (!chaser || !target) {
    return {
      ok: false,
      status: 404,
      code: "COUNTRY_NOT_FOUND",
      message: `Unknown country code ${chaser ? params.target : params.chaser}. See /api/countries.`,
    };
  }

  // Observed points only: projections never seed another projection.
  const endYear = series.projectedFrom == null ? undefined : series.projectedFrom - 1;
  const points = (country: StaticCountry) => {
    const factor = adjustmentFactor(country.iso_alpha3, params.indicator, params.adjusted);
    return seriesPoints(series, country.iso_alpha3, { endYear }).map((p) => ({
      year: p.year,
      value: p.value * factor,
    }));
  };
  const chaserPoints = points(chaser);
  const targetPoints = points(target);
  const handoff = latestCommonPoint(chaserPoints, targetPoints);
  if (!handoff) {
    return {
      ok: false,
      status: 404,
      code: "DATA_NOT_FOUND",
      message: "The two countries have no year of data in common for this indicator.",
    };
  }

  const caveats = [chaser, target].flatMap((country): Caveat[] => {
    const adjustment = getAdjustment(country.iso_alpha3, params.indicator);
    if (!adjustment) return [];
    return [
      {
        iso: country.iso_alpha3,
        country: countryDisplayName(country),
        title: adjustment.title,
        explanation: adjustment.explanation,
        adjustmentFactor: adjustment.adjustmentFactor,
        appliedFactor: params.adjusted ? adjustment.adjustmentFactor : 1,
      },
    ];
  });

  return {
    ok: true,
    indicator: series.indicator,
    chaser: countryRef(chaser),
    target: countryRef(target),
    adjusted: params.adjusted,
    handoff,
    chaserPoints,
    targetPoints,
    caveats,
  };
}

function resolveRate(
  input: RateInput,
  points: YearValue[],
  handoffYear: number,
  range: readonly [number, number],
): { rate: number; basis: RateBasis } {
  if (input !== "trailing") return { rate: input, basis: "given" };
  const cagr = calculateCagr({
    series: points.filter((p) => p.year <= handoffYear),
    lookbackYears: 10,
  });
  return cagr == null
    ? { rate: FALLBACK_RATE, basis: "fallback" }
    : { rate: round3(clamp(cagr, range)), basis: "trailing_10y_cagr" };
}

export async function computeScenario(
  env: StaticDataEnv,
  requestUrl: string,
  input: ScenarioInput,
): Promise<Scenario | Failure> {
  const pair = await loadPair(env, requestUrl, input);
  if (!pair.ok) return pair;

  const chaserRate = resolveRate(
    input.chaserRate,
    pair.chaserPoints,
    pair.handoff.year,
    CHASER_RATE_RANGE,
  );
  const targetRate = resolveRate(
    input.targetRate,
    pair.targetPoints,
    pair.handoff.year,
    TARGET_RATE_RANGE,
  );
  const rates = { chaserRate: chaserRate.rate, targetRate: targetRate.rate };
  const outcome = convergenceOutcome({ handoff: pair.handoff, baseYear: input.baseYear, rates });

  const chaserByYear = new Map(pair.chaserPoints.map((p) => [p.year, p.value]));
  const observed: SeriesRow[] = [];
  for (const { year, value } of pair.targetPoints) {
    const chaser = chaserByYear.get(year);
    if (chaser != null && year > pair.handoff.year - OBSERVED_YEARS && year <= pair.handoff.year) {
      observed.push({ year, chaser, target: value });
    }
  }
  observed.sort((a, b) => a.year - b.year);

  const { start, yearsToConvergence } = outcome;
  const span = Number.isFinite(yearsToConvergence)
    ? Math.min(Math.ceil(yearsToConvergence) + AFTER_CONVERGENCE_YEARS, MAX_PROJECTION_YEARS)
    : NEVER_PROJECTION_YEARS;
  const projection: SeriesRow[] = [];
  for (let i = 0; i <= span; i++) {
    projection.push({
      year: start.year + i,
      chaser: start.chaser * (1 + chaserRate.rate) ** i,
      target: start.target * (1 + targetRate.rate) ** i,
    });
  }

  return {
    ok: true,
    indicator: pair.indicator,
    chaser: pair.chaser,
    target: pair.target,
    adjusted: pair.adjusted,
    handoff: pair.handoff,
    caveats: pair.caveats,
    baseYear: input.baseYear,
    rates: {
      chaser: chaserRate.rate,
      target: targetRate.rate,
      chaserBasis: chaserRate.basis,
      targetBasis: targetRate.basis,
    },
    outcome,
    observed,
    projection,
  };
}

export interface RequiredGrowth {
  scenario: Omit<Pair, "chaserPoints" | "targetPoints">;
  byYear: number;
  targetRate: number;
  /** Chaser growth needed each year from the latest shared data year, or null if undefined. */
  requiredChaserRate: number | null;
}

export async function computeRequiredGrowth(
  env: StaticDataEnv,
  requestUrl: string,
  params: {
    chaser: string;
    target: string;
    indicator: string;
    adjusted: boolean;
    byYear: number;
    targetRate: number;
  },
): Promise<RequiredGrowth | Failure> {
  const pair = await loadPair(env, requestUrl, params);
  if (!pair.ok) return pair;
  const years = params.byYear - pair.handoff.year;
  if (years <= 0) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_YEAR",
      message: `by_year must be after the latest shared data year (${pair.handoff.year}).`,
    };
  }
  const { chaserPoints: _c, targetPoints: _t, ...scenario } = pair;
  return {
    scenario,
    byYear: params.byYear,
    targetRate: params.targetRate,
    requiredChaserRate: calculateRequiredChaserGrowthRate({
      chaserValue: pair.handoff.chaser,
      targetValue: pair.handoff.target,
      targetGrowthRate: params.targetRate,
      years,
    }),
  };
}

export function isFailure(value: { ok?: boolean }): value is Failure {
  return value.ok === false;
}

/** The app URL that reproduces this scenario (relative to the site origin). */
export function appPath(
  scenario: Pick<Scenario, "chaser" | "target" | "indicator" | "adjusted" | "baseYear" | "rates">,
): string {
  const query = new URLSearchParams({
    chaser: scenario.chaser.iso,
    target: scenario.target.iso,
    indicator: scenario.indicator.code,
    cg: String(scenario.rates.chaser),
    tg: String(scenario.rates.target),
    baseYear: String(scenario.baseYear),
  });
  if (!scenario.adjusted) {
    query.set("adjC", "0");
    query.set("adjT", "0");
  }
  return `/?${toSearchParams(parseShareStateFromSearch(query.toString())).toString()}`;
}

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/** One factual sentence: what the scenario says, framed as an assumption. */
export function scenarioSummary(s: Scenario): string {
  const { chaser, target, outcome, rates } = s;
  const metric = s.indicator.name;
  if (s.handoff.chaser >= s.handoff.target) {
    return `${chaser.name} is already ahead of ${target.name} on ${metric} in the latest shared data (${s.handoff.year}).`;
  }
  const assumption = `If ${chaser.name} grew ${pct(rates.chaser)} a year and ${target.name} ${pct(rates.target)} a year`;
  if (outcome.convergenceYear == null) {
    return `${assumption}, ${chaser.name} would never catch up with ${target.name} on ${metric}.`;
  }
  const years = Math.max(1, Math.round(outcome.yearsToConvergence));
  return `${assumption}, ${chaser.name} would catch up with ${target.name} on ${metric} in about ${years} ${years === 1 ? "year" : "years"}, around ${outcome.convergenceYear}. This is a scenario, not a forecast.`;
}
