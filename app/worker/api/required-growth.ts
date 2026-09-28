import { enforceRateLimit } from "../_lib/requestGuards";
import { computeRequiredGrowth, isFailure } from "../_lib/scenario";
import {
  errorResponse,
  parseAdjusted,
  parseCountries,
  parseIndicator,
  SCENARIO_DISCLAIMER,
} from "../_lib/scenarioParams";
import { STATIC_DATA_CACHE_CONTROL, type StaticDataEnv } from "../_lib/staticData";

/** growth_required_by_deadline: the chaser growth needed to match the target by a given year. */
export const onRequestGet: PagesFunction<StaticDataEnv> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:required-growth",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  const countries = parseCountries(url);
  if (countries instanceof Response) return countries;
  const indicator = parseIndicator(url);
  if (indicator instanceof Response) return indicator;

  const byYear = Number.parseInt(url.searchParams.get("by_year") ?? "", 10);
  if (!Number.isInteger(byYear) || byYear < 1951 || byYear > 2200) {
    return errorResponse(400, "INVALID_YEAR", "by_year is required and must be an integer year");
  }
  const targetRaw = url.searchParams.get("target_growth_rate");
  const targetRate = targetRaw == null || targetRaw === "" ? 0 : Number(targetRaw);
  if (!Number.isFinite(targetRate) || targetRate <= -0.99 || targetRate > 1) {
    return errorResponse(
      400,
      "INVALID_GROWTH_RATE",
      "target_growth_rate must be a number in (-0.99, 1], as a fraction",
    );
  }

  try {
    const result = await computeRequiredGrowth(context.env, context.request.url, {
      ...countries,
      indicator,
      adjusted: parseAdjusted(url),
      byYear,
      targetRate,
    });
    if (isFailure(result)) return errorResponse(result.status, result.code, result.message);

    const { scenario, requiredChaserRate } = result;
    const fromYear = scenario.handoff.year;
    const pctText =
      requiredChaserRate == null ? null : `${(requiredChaserRate * 100).toFixed(2)}% a year`;
    return Response.json(
      {
        chaser: { country: scenario.chaser.name, iso: scenario.chaser.iso },
        target: { country: scenario.target.name, iso: scenario.target.iso },
        indicator: scenario.indicator.code,
        by_year: byYear,
        from_year: fromYear,
        target_annual_growth: targetRate,
        required_chaser_annual_growth: requiredChaserRate,
        summary:
          pctText == null
            ? "No growth rate can be computed for these values."
            : `${scenario.chaser.name} would need about ${pctText} from ${fromYear} to ${byYear} to match ${scenario.target.name} on ${scenario.indicator.name}, if ${scenario.target.name} grows ${(targetRate * 100).toFixed(1)}% a year. ${SCENARIO_DISCLAIMER}`,
        latest: {
          year: fromYear,
          chaser_value: Math.round(scenario.handoff.chaser * 100) / 100,
          target_value: Math.round(scenario.handoff.target * 100) / 100,
        },
        adjusted: scenario.adjusted,
        caveats: scenario.caveats.map((c) => ({
          country: c.country,
          title: c.title,
          applied: c.appliedFactor !== 1,
        })),
        links: {
          methodology: `${url.origin}/methodology`,
          openapi: `${url.origin}/openapi.json`,
        },
      },
      { headers: { "cache-control": STATIC_DATA_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("api/required-growth failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to calculate required growth");
  }
};
