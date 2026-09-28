import { enforceRateLimit } from "../_lib/requestGuards";
import { loadCountries, STATIC_DATA_CACHE_CONTROL, type StaticDataEnv } from "../_lib/staticData";

type Env = StaticDataEnv;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:countries",
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const data = await loadCountries(context.env, context.request.url);

    return Response.json(
      { data },
      {
        headers: {
          "cache-control": STATIC_DATA_CACHE_CONTROL,
        },
      },
    );
  } catch {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch countries" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
};
