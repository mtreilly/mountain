import { enforceRateLimit } from "../_lib/requestGuards";

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:indicators",
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const result = await DB.prepare(
      `SELECT code, name, description, unit, source, source_code, category
       FROM indicators
       ORDER BY category, name`,
    ).all();

    return Response.json(
      { data: result.results },
      {
        headers: {
          "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch indicators" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
};
