import {
  appPath,
  DEFAULT_BASE_YEAR,
  DEFAULT_INDICATOR,
  type RateInput,
  type Scenario,
  type ScenarioInput,
  scenarioSummary,
} from "./scenario";

const ISO3_RE = /^[A-Z]{3}$/;
const INDICATOR_RE = /^[A-Z0-9_]{2,64}$/;

export function errorResponse(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function parseRate(url: URL, name: string, fallback: RateInput): number | RateInput | Response {
  const raw = url.searchParams.get(name);
  if (raw == null || raw === "") return fallback;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= -0.99 || rate > 1) {
    return errorResponse(
      400,
      "INVALID_GROWTH_RATE",
      `${name} must be a number in (-0.99, 1], as a fraction (0.035 means 3.5% a year)`,
    );
  }
  return rate;
}

export function parseCountries(url: URL): { chaser: string; target: string } | Response {
  const chaser = url.searchParams.get("chaser")?.trim().toUpperCase();
  const target = url.searchParams.get("target")?.trim().toUpperCase();
  if (!chaser || !target) {
    return errorResponse(400, "MISSING_PARAMS", "chaser and target (ISO3 codes) are required");
  }
  if (!ISO3_RE.test(chaser) || !ISO3_RE.test(target)) {
    return errorResponse(
      400,
      "INVALID_COUNTRY",
      "chaser and target must be valid ISO3 country codes",
    );
  }
  return { chaser, target };
}

export function parseIndicator(url: URL): string | Response {
  const indicator = (url.searchParams.get("indicator")?.trim() || DEFAULT_INDICATOR).toUpperCase();
  return INDICATOR_RE.test(indicator)
    ? indicator
    : errorResponse(400, "INVALID_INDICATOR", "indicator must be a valid code");
}

export function parseAdjusted(url: URL): boolean {
  const raw = url.searchParams.get("adjusted");
  return raw === "true" || raw === "1";
}

/**
 * Shared query parsing for the scenario endpoints. `defaults` says what a missing rate
 * means for that endpoint (its own trailing 10-year growth, or a fixed number).
 */
export function parseScenarioInput(
  url: URL,
  defaults: { chaserRate: RateInput; targetRate: RateInput },
): ScenarioInput | Response {
  const countries = parseCountries(url);
  if (countries instanceof Response) return countries;
  const indicator = parseIndicator(url);
  if (indicator instanceof Response) return indicator;
  const chaserRate = parseRate(url, "growth_rate", defaults.chaserRate);
  if (chaserRate instanceof Response) return chaserRate;
  const targetRate = parseRate(url, "target_growth_rate", defaults.targetRate);
  if (targetRate instanceof Response) return targetRate;

  const baseYearRaw = url.searchParams.get("base_year");
  const baseYear = baseYearRaw == null ? DEFAULT_BASE_YEAR : Number.parseInt(baseYearRaw, 10);
  if (!Number.isInteger(baseYear) || baseYear < 1950 || baseYear > 2100) {
    return errorResponse(
      400,
      "INVALID_BASE_YEAR",
      "base_year must be an integer from 1950 to 2100",
    );
  }

  return {
    ...countries,
    indicator,
    chaserRate,
    targetRate,
    baseYear,
    adjusted: parseAdjusted(url),
  };
}

const round = (value: number, dp = 2) => Math.round(value * 10 ** dp) / 10 ** dp;
const rows = (list: Scenario["observed"]) =>
  list.map((r) => ({ year: r.year, chaser: round(r.chaser), target: round(r.target) }));

export const SCENARIO_DISCLAIMER =
  "A scenario, not a forecast: the result follows only from the stated growth rates.";

/** Query string that reproduces a scenario on the chart endpoint. */
export function scenarioQuery(s: Scenario): string {
  const query = new URLSearchParams({
    chaser: s.chaser.iso,
    target: s.target.iso,
    indicator: s.indicator.code,
    growth_rate: String(s.rates.chaser),
    target_growth_rate: String(s.rates.target),
    base_year: String(s.baseYear),
  });
  if (s.adjusted) query.set("adjusted", "true");
  return query.toString();
}

/** Fields every scenario response shares, with absolute links back to the site. */
export function scenarioBody(s: Scenario, origin: string) {
  const { handoff, outcome } = s;
  return {
    summary: scenarioSummary(s),
    scenario: {
      note: SCENARIO_DISCLAIMER,
      chaser_annual_growth: s.rates.chaser,
      target_annual_growth: s.rates.target,
      chaser_growth_basis: s.rates.chaserBasis,
      target_growth_basis: s.rates.targetBasis,
      base_year: s.baseYear,
      projection_start_year: outcome.start.year,
      adjusted: s.adjusted,
    },
    indicator_detail: {
      code: s.indicator.code,
      name: s.indicator.name,
      unit: s.indicator.unit,
      source: s.indicator.source,
      source_code: s.indicator.source_code,
    },
    latest: {
      year: handoff.year,
      chaser_value: round(handoff.chaser),
      target_value: round(handoff.target),
      chaser_share_of_target: round(handoff.chaser / handoff.target, 4),
    },
    convergence: {
      already_ahead: handoff.chaser >= handoff.target,
      years: Number.isFinite(outcome.yearsToConvergence)
        ? round(outcome.yearsToConvergence, 1)
        : null,
      year: outcome.convergenceYear,
    },
    series: { observed: rows(s.observed), projection: rows(s.projection) },
    caveats: s.caveats.map((c) => ({
      country: c.country,
      iso: c.iso,
      title: c.title,
      explanation: c.explanation,
      adjustment_factor: c.adjustmentFactor,
      applied: c.appliedFactor !== 1,
    })),
    links: {
      app: `${origin}${appPath(s)}`,
      chart_svg: `${origin}/api/chart.svg?${scenarioQuery(s)}`,
      compare_page: `${origin}/compare/${s.chaser.slug}/${s.target.slug}`,
      methodology: `${origin}/methodology`,
      openapi: `${origin}/openapi.json`,
    },
  };
}
