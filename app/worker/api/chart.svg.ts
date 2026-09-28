import { scenarioChartSvg } from "../_lib/chartSvg";
import { enforceRateLimit } from "../_lib/requestGuards";
import { computeScenario, isFailure, scenarioSummary } from "../_lib/scenario";
import { errorResponse, parseScenarioInput, scenarioQuery } from "../_lib/scenarioParams";
import { STATIC_DATA_CACHE_CONTROL, type StaticDataEnv } from "../_lib/staticData";

/** An embeddable SVG chart of a scenario. Same parameters as /api/convergence. */
export const onRequestGet: PagesFunction<StaticDataEnv> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:chart",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  const input = parseScenarioInput(url, { chaserRate: "trailing", targetRate: "trailing" });
  if (input instanceof Response) return input;

  try {
    const scenario = await computeScenario(context.env, context.request.url, input);
    if (isFailure(scenario)) return errorResponse(scenario.status, scenario.code, scenario.message);
    const svg = scenarioChartSvg(scenario, {
      canonicalUrl: `${url.origin}/api/chart.svg?${scenarioQuery(scenario)}`,
      summary: scenarioSummary(scenario),
    });
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": STATIC_DATA_CACHE_CONTROL,
        "access-control-allow-origin": "*",
      },
    });
  } catch (error) {
    console.error("api/chart.svg failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to render chart");
  }
};
