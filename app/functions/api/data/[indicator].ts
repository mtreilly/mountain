import { enforceRateLimit } from "../../_lib/requestGuards";

interface Env {
  DB: D1Database;
}

const ISO3_RE = /^[A-Z]{3}$/;
const INDICATOR_RE = /^[A-Z0-9_]{2,64}$/;
const MAX_COUNTRIES = 16;
const MIN_YEAR = 1900;

function uniqueIso3List(list: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const code = raw.trim().toUpperCase();
    if (!ISO3_RE.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function parseYear(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:data",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const indicatorCode = String(context.params.indicator || "").trim().toUpperCase();
  const url = new URL(context.request.url);
  const maxYear = new Date().getFullYear() + 1;

  if (!INDICATOR_RE.test(indicatorCode)) {
    return Response.json(
      { error: { code: "INVALID_INDICATOR", message: "indicator path parameter is invalid" } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const countries = uniqueIso3List(url.searchParams.get("countries")?.split(",") || []);
  const startYear = parseYear(url.searchParams.get("start_year"), 1960);
  const endYear = parseYear(url.searchParams.get("end_year"), maxYear);

  if (countries.length === 0) {
    return Response.json(
      { error: { code: "MISSING_COUNTRIES", message: "countries parameter is required" } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (countries.length > MAX_COUNTRIES) {
    return Response.json(
      {
        error: {
          code: "TOO_MANY_COUNTRIES",
          message: `countries must contain at most ${MAX_COUNTRIES} ISO3 codes`,
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (startYear < MIN_YEAR || endYear > maxYear || startYear > endYear) {
    return Response.json(
      {
        error: {
          code: "INVALID_YEAR_RANGE",
          message: `year range must be between ${MIN_YEAR} and ${maxYear}, with start_year <= end_year`,
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    // Get indicator info
    const indicator = await DB.prepare(
      `SELECT code, name, unit, source, source_code FROM indicators WHERE code = ?`,
    )
      .bind(indicatorCode)
      .first();

    if (!indicator) {
      return Response.json(
        { error: { code: "INDICATOR_NOT_FOUND", message: `Indicator ${indicatorCode} not found` } },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    // Build placeholders for countries
    const placeholders = countries.map(() => "?").join(",");

    const result = await DB.prepare(
      `SELECT c.iso_alpha3, d.year, d.value
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE i.code = ?
         AND c.iso_alpha3 IN (${placeholders})
         AND d.year BETWEEN ? AND ?
       ORDER BY c.iso_alpha3, d.year`,
    )
      .bind(indicatorCode, ...countries, startYear, endYear)
      .all();

    // Group by country
    const data: Record<string, Array<{ year: number; value: number }>> = {};
    for (const row of result.results as Array<{ iso_alpha3: string; year: number; value: number }>) {
      if (!data[row.iso_alpha3]) {
        data[row.iso_alpha3] = [];
      }
      data[row.iso_alpha3].push({ year: row.year, value: row.value });
    }

    return Response.json(
      { indicator, data },
      {
        headers: {
          "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch indicator data" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
};
