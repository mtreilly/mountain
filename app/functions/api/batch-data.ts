import { enforceRateLimit } from "../_lib/requestGuards";

interface Env {
  DB: D1Database;
}

const ISO3_RE = /^[A-Z]{3}$/;
const INDICATOR_RE = /^[A-Z0-9_]{2,64}$/;
const MAX_COUNTRIES = 12;
const MAX_INDICATORS = 24;
const MAX_PAIR_COUNT = 120;
const MIN_YEAR = 1900;

function uniqueClean(list: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const v = raw.trim().toUpperCase();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeIso3(list: string[]) {
  return uniqueClean(list).filter((code) => ISO3_RE.test(code));
}

function normalizeIndicatorCodes(list: string[]) {
  return uniqueClean(list).filter((code) => INDICATOR_RE.test(code));
}

function parseYear(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:batch-data",
    limit: 90,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  const maxYear = new Date().getFullYear() + 1;

  const countries = normalizeIso3(url.searchParams.get("countries")?.split(",") || []);
  const indicators = normalizeIndicatorCodes(url.searchParams.get("indicators")?.split(",") || []);

  const startYear = parseYear(url.searchParams.get("start_year"), 1990);
  const endYear = parseYear(url.searchParams.get("end_year"), maxYear);
  const includeSourceVintage = url.searchParams.get("include_source_vintage") === "1";

  if (countries.length === 0) {
    return Response.json(
      { error: { code: "MISSING_COUNTRIES", message: "countries parameter is required" } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (indicators.length === 0) {
    return Response.json(
      { error: { code: "MISSING_INDICATORS", message: "indicators parameter is required" } },
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
  if (indicators.length > MAX_INDICATORS) {
    return Response.json(
      {
        error: {
          code: "TOO_MANY_INDICATORS",
          message: `indicators must contain at most ${MAX_INDICATORS} indicator codes`,
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (countries.length * indicators.length > MAX_PAIR_COUNT) {
    return Response.json(
      {
        error: {
          code: "REQUEST_TOO_LARGE",
          message: `countries × indicators must not exceed ${MAX_PAIR_COUNT}`,
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
    const countryPlaceholders = countries.map(() => "?").join(",");
    const indicatorPlaceholders = indicators.map(() => "?").join(",");

    const indicatorRows = await DB.prepare(
      `SELECT code, name, description, unit, source, source_code, category
       FROM indicators
       WHERE code IN (${indicatorPlaceholders})`,
    )
      .bind(...indicators)
      .all<{
        code: string;
        name: string;
        description: string | null;
        unit: string | null;
        source: string | null;
        source_code: string | null;
        category: string | null;
      }>();

    const indicatorByCode: Record<
      string,
      {
        code: string;
        name: string;
        description: string | null;
        unit: string | null;
        source: string | null;
        source_code: string | null;
        category: string | null;
      }
    > = {};
    for (const row of indicatorRows.results || []) indicatorByCode[row.code] = row;

    const points = await DB.prepare(
      `SELECT i.code AS indicator, c.iso_alpha3 AS iso, d.year AS year, d.value AS value${
        includeSourceVintage ? ", d.source_vintage AS source_vintage" : ""
      }
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE i.code IN (${indicatorPlaceholders})
         AND c.iso_alpha3 IN (${countryPlaceholders})
         AND d.year BETWEEN ? AND ?
       ORDER BY i.code, c.iso_alpha3, d.year`,
    )
      .bind(...indicators, ...countries, startYear, endYear)
      .all<{
        indicator: string;
        iso: string;
        year: number;
        value: number;
        source_vintage?: string | null;
      }>();

    const data: Record<
      string,
      Record<string, Array<{ year: number; value: number; source_vintage?: string | null }>>
    > = {};
    for (const row of points.results || []) {
      if (!data[row.indicator]) data[row.indicator] = {};
      if (!data[row.indicator][row.iso]) data[row.indicator][row.iso] = [];
      data[row.indicator][row.iso].push(
        includeSourceVintage
          ? { year: row.year, value: row.value, source_vintage: row.source_vintage ?? null }
          : { year: row.year, value: row.value },
      );
    }

    return Response.json(
      { indicators: indicatorByCode, data },
      {
        headers: {
          "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch batch data" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
};
