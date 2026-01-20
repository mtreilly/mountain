interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  const result = await DB.prepare(
    `SELECT code, name, description, unit, source, category
     FROM indicators
     ORDER BY category, name`
  ).all();

  return Response.json({ data: result.results });
};
