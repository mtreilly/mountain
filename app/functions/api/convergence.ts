interface Env {
  DB: D1Database;
}

interface LatestValue {
  name: string;
  value: number;
  year: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);

  const chaser = url.searchParams.get("chaser");
  const target = url.searchParams.get("target");
  const indicator = url.searchParams.get("indicator");
  const customGrowthRate = url.searchParams.get("growth_rate");

  if (!chaser || !target || !indicator) {
    return Response.json(
      {
        error: {
          code: "MISSING_PARAMS",
          message: "chaser, target, and indicator parameters are required",
        },
      },
      { status: 400 }
    );
  }

  // Get latest values for both countries
  const getLatestValue = async (countryCode: string): Promise<LatestValue | null> => {
    const result = await DB.prepare(
      `SELECT c.name, d.value, d.year
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE c.iso_alpha3 = ? AND i.code = ? AND d.is_projection = 0
       ORDER BY d.year DESC
       LIMIT 1`
    )
      .bind(countryCode, indicator)
      .first();

    return result as LatestValue | null;
  };

  const [chaserData, targetData] = await Promise.all([
    getLatestValue(chaser),
    getLatestValue(target),
  ]);

  if (!chaserData || !targetData) {
    return Response.json(
      {
        error: {
          code: "DATA_NOT_FOUND",
          message: "Could not find data for one or both countries",
        },
      },
      { status: 404 }
    );
  }

  // Calculate historical growth rate if not provided
  let growthRate = customGrowthRate ? parseFloat(customGrowthRate) : null;

  if (!growthRate) {
    // Calculate CAGR from available data
    const historicalData = await DB.prepare(
      `SELECT d.year, d.value
       FROM data_points d
       JOIN countries c ON d.country_id = c.id
       JOIN indicators i ON d.indicator_id = i.id
       WHERE c.iso_alpha3 = ? AND i.code = ? AND d.is_projection = 0
       ORDER BY d.year ASC`
    )
      .bind(chaser, indicator)
      .all();

    const rows = historicalData.results as Array<{ year: number; value: number }>;
    if (rows.length >= 2) {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const years = last.year - first.year;
      growthRate = Math.pow(last.value / first.value, 1 / years) - 1;
    } else {
      growthRate = 0.02; // Default 2% if not enough data
    }
  }

  // Calculate years to convergence
  // Formula: years = ln(target/chaser) / ln(1 + growth_rate)
  const ratio = targetData.value / chaserData.value;
  const yearsToConvergence =
    growthRate > 0 ? Math.log(ratio) / Math.log(1 + growthRate) : Infinity;

  const convergenceYear =
    yearsToConvergence !== Infinity
      ? Math.round(chaserData.year + yearsToConvergence)
      : null;

  // Generate projection data
  const projection: Array<{ year: number; chaser: number; target: number }> = [];
  const baseYear = chaserData.year;
  const maxYears = Math.min(Math.ceil(yearsToConvergence) + 10, 150);

  for (let i = 0; i <= maxYears; i += 5) {
    const year = baseYear + i;
    const projectedChaser = chaserData.value * Math.pow(1 + growthRate, i);
    projection.push({
      year,
      chaser: Math.round(projectedChaser),
      target: Math.round(targetData.value), // Assuming target stays constant
    });

    if (projectedChaser >= targetData.value) break;
  }

  return Response.json({
    chaser: {
      country: chaserData.name,
      iso: chaser,
      current_value: chaserData.value,
      current_year: chaserData.year,
    },
    target: {
      country: targetData.name,
      iso: target,
      current_value: targetData.value,
      current_year: targetData.year,
    },
    indicator,
    growth_rate: growthRate,
    years_to_convergence: Math.round(yearsToConvergence * 10) / 10,
    convergence_year: convergenceYear,
    projection,
  });
};
