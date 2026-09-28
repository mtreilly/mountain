import { enforceRateLimit } from "../_lib/requestGuards";
import { computeScenario, DEFAULT_BASE_YEAR, isFailure } from "../_lib/scenario";
import {
  errorResponse,
  parseAdjusted,
  parseCountries,
  parseIndicator,
  scenarioBody,
} from "../_lib/scenarioParams";
import { STATIC_DATA_CACHE_CONTROL, type StaticDataEnv } from "../_lib/staticData";

/** compare_countries: where two countries stand now, and what their recent growth implies. */
export const onRequestGet: PagesFunction<StaticDataEnv> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:compare",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  const countries = parseCountries(url);
  if (countries instanceof Response) return countries;
  const indicator = parseIndicator(url);
  if (indicator instanceof Response) return indicator;

  try {
    const scenario = await computeScenario(context.env, context.request.url, {
      ...countries,
      indicator,
      chaserRate: "trailing",
      targetRate: "trailing",
      baseYear: DEFAULT_BASE_YEAR,
      adjusted: parseAdjusted(url),
    });
    if (isFailure(scenario)) return errorResponse(scenario.status, scenario.code, scenario.message);
    const { series: _series, ...body } = scenarioBody(scenario, url.origin);
    return Response.json(
      {
        chaser: { country: scenario.chaser.name, iso: scenario.chaser.iso },
        target: { country: scenario.target.name, iso: scenario.target.iso },
        note: "Convergence below assumes each country keeps growing at its own trailing 10-year rate.",
        ...body,
      },
      { headers: { "cache-control": STATIC_DATA_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("api/compare failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to compare countries");
  }
};
