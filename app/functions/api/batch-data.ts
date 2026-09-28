import { type SeriesPoint, seriesForCountries } from "../../src/lib/staticDataFormat";
import { enforceRateLimit } from "../_lib/requestGuards";
import { loadSeries, STATIC_DATA_CACHE_CONTROL, type StaticDataEnv } from "../_lib/staticData";

type Env = StaticDataEnv;

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
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:batch-data",
    limit: 90,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);
  // Pinned demographic projection series are available through 2100.
  const maxYear = 2100;

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
    const loaded = await Promise.all(
      indicators.map((code) => loadSeries(context.env, context.request.url, code)),
    );
    const indicatorByCode: Record<string, unknown> = {};
    const data: Record<string, Record<string, SeriesPoint[]>> = {};
    loaded.forEach((series, i) => {
      if (!series) return;
      const code = indicators[i]!;
      indicatorByCode[code] = series.indicator;
      const byCountry = seriesForCountries(series, countries, {
        startYear,
        endYear,
        includeSourceVintage,
      });
      if (Object.keys(byCountry).length > 0) data[code] = byCountry;
    });

    return Response.json(
      { indicators: indicatorByCode, data },
      {
        headers: {
          "cache-control": STATIC_DATA_CACHE_CONTROL,
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
