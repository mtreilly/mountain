import { enforceRateLimit } from "../_lib/requestGuards";
import { computeScenario, isFailure } from "../_lib/scenario";
import { errorResponse, parseScenarioInput, scenarioBody } from "../_lib/scenarioParams";
import { STATIC_DATA_CACHE_CONTROL, type StaticDataEnv } from "../_lib/staticData";

type Env = StaticDataEnv;

const round = (value: number) => Math.round(value);

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:convergence",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  // A missing growth_rate means the chaser's own trailing 10-year growth; a missing
  // target_growth_rate holds the target constant (this endpoint's long-standing default).
  const input = parseScenarioInput(url, { chaserRate: "trailing", targetRate: 0 });
  if (input instanceof Response) return input;

  try {
    const scenario = await computeScenario(context.env, context.request.url, input);
    if (isFailure(scenario)) return errorResponse(scenario.status, scenario.code, scenario.message);

    const { handoff, outcome } = scenario;
    return Response.json(
      {
        // Original response shape, kept for existing callers.
        chaser: {
          country: scenario.chaser.name,
          iso: scenario.chaser.iso,
          current_value: handoff.chaser,
          current_year: handoff.year,
        },
        target: {
          country: scenario.target.name,
          iso: scenario.target.iso,
          current_value: handoff.target,
          current_year: handoff.year,
        },
        indicator: scenario.indicator.code,
        growth_rate: scenario.rates.chaser,
        years_to_convergence: Number.isFinite(outcome.yearsToConvergence)
          ? Math.round(outcome.yearsToConvergence * 10) / 10
          : null,
        convergence_year: outcome.convergenceYear,
        projection: scenario.projection
          .filter((_, i) => i % 5 === 0)
          .map((r) => ({ year: r.year, chaser: round(r.chaser), target: round(r.target) })),
        ...scenarioBody(scenario, new URL(context.request.url).origin),
      },
      { headers: { "cache-control": STATIC_DATA_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("api/convergence failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to calculate convergence");
  }
};
