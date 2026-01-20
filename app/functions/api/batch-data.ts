interface Env {
  DB: D1Database;
}

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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);

  const countries = uniqueClean(url.searchParams.get("countries")?.split(",") || []);
  const indicators = uniqueClean(url.searchParams.get("indicators")?.split(",") || []);

  const startYear = parseInt(url.searchParams.get("start_year") || "1990");
  const endYear = parseInt(url.searchParams.get("end_year") || new Date().getFullYear().toString());

  if (countries.length === 0) {
    return Response.json(
      { error: { code: "MISSING_COUNTRIES", message: "countries parameter is required" } },
      { status: 400 }
    );
  }
  if (indicators.length === 0) {
    return Response.json(
      { error: { code: "MISSING_INDICATORS", message: "indicators parameter is required" } },
      { status: 400 }
    );
  }

  const countryPlaceholders = countries.map(() => "?").join(",");
  const indicatorPlaceholders = indicators.map(() => "?").join(",");

  const indicatorRows = await DB.prepare(
    `SELECT code, name, description, unit, source, category
     FROM indicators
     WHERE code IN (${indicatorPlaceholders})`
  )
    .bind(...indicators)
    .all<{
      code: string;
      name: string;
      description: string | null;
      unit: string | null;
      source: string | null;
      category: string | null;
    }>();

  const indicatorByCode: Record<
    string,
    { code: string; name: string; description: string | null; unit: string | null; source: string | null; category: string | null }
  > =
    {};
  for (const row of indicatorRows.results || []) indicatorByCode[row.code] = row;

  const points = await DB.prepare(
    `SELECT i.code AS indicator, c.iso_alpha3 AS iso, d.year AS year, d.value AS value
     FROM data_points d
     JOIN countries c ON d.country_id = c.id
     JOIN indicators i ON d.indicator_id = i.id
     WHERE i.code IN (${indicatorPlaceholders})
       AND c.iso_alpha3 IN (${countryPlaceholders})
       AND d.year BETWEEN ? AND ?
     ORDER BY i.code, c.iso_alpha3, d.year`
  )
    .bind(...indicators, ...countries, startYear, endYear)
    .all<{ indicator: string; iso: string; year: number; value: number }>();

  const data: Record<string, Record<string, Array<{ year: number; value: number }>>> = {};
  for (const row of points.results || []) {
    if (!data[row.indicator]) data[row.indicator] = {};
    if (!data[row.indicator][row.iso]) data[row.indicator][row.iso] = [];
    data[row.indicator][row.iso].push({ year: row.year, value: row.value });
  }

  return Response.json({ indicators: indicatorByCode, data });
};
