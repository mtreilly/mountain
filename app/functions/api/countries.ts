interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const result = await DB.prepare(
    `SELECT iso_alpha3, iso_alpha2, name, region, income_group
     FROM countries
     ORDER BY name`
  ).all();

  return Response.json({ data: result.results });
};
