interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const indicatorCode = context.params.indicator as string;
  const url = new URL(context.request.url);

  const countries = url.searchParams.get("countries")?.split(",") || [];
  const startYear = parseInt(url.searchParams.get("start_year") || "1960");
  const endYear = parseInt(
    url.searchParams.get("end_year") || new Date().getFullYear().toString()
  );

  if (countries.length === 0) {
    return Response.json(
      { error: { code: "MISSING_COUNTRIES", message: "countries parameter is required" } },
      { status: 400 }
    );
  }

  // Get indicator info
  const indicator = await DB.prepare(
    `SELECT code, name, unit FROM indicators WHERE code = ?`
  )
    .bind(indicatorCode)
    .first();

  if (!indicator) {
    return Response.json(
      { error: { code: "INDICATOR_NOT_FOUND", message: `Indicator ${indicatorCode} not found` } },
      { status: 404 }
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
     ORDER BY c.iso_alpha3, d.year`
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

  return Response.json({ indicator, data });
};
