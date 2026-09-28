import { yearsToConverge } from "../../src/lib/convergenceModel";
import { latestObserved, seriesPoints } from "../../src/lib/staticDataFormat";
import { enforceRateLimit } from "../_lib/requestGuards";
import {
  loadCountries,
  loadSeries,
  STATIC_DATA_CACHE_CONTROL,
  type StaticDataEnv,
} from "../_lib/staticData";

type Env = StaticDataEnv;

interface LatestValue {
  name: string;
  value: number;
  year: number;
}

const ISO3_RE = /^[A-Z]{3}$/;
const INDICATOR_RE = /^[A-Z0-9_]{2,64}$/;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const limited = enforceRateLimit(context.request, {
    keyPrefix: "api:convergence",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(context.request.url);

  const chaser = url.searchParams.get("chaser")?.trim().toUpperCase();
  const target = url.searchParams.get("target")?.trim().toUpperCase();
  const indicator = url.searchParams.get("indicator")?.trim().toUpperCase();
  const customGrowthRateRaw = url.searchParams.get("growth_rate");

  if (!chaser || !target || !indicator) {
    return Response.json(
      {
        error: {
          code: "MISSING_PARAMS",
          message: "chaser, target, and indicator parameters are required",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (!ISO3_RE.test(chaser) || !ISO3_RE.test(target)) {
    return Response.json(
      {
        error: {
          code: "INVALID_COUNTRY",
          message: "chaser and target must be valid ISO3 country codes",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (!INDICATOR_RE.test(indicator)) {
    return Response.json(
      { error: { code: "INVALID_INDICATOR", message: "indicator must be a valid code" } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const parsedCustomGrowthRate =
    customGrowthRateRaw == null ? null : Number.parseFloat(customGrowthRateRaw);
  if (
    parsedCustomGrowthRate != null &&
    (!Number.isFinite(parsedCustomGrowthRate) ||
      parsedCustomGrowthRate <= -0.99 ||
      parsedCustomGrowthRate > 1)
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_GROWTH_RATE",
          message: "growth_rate must be finite and in the range (-0.99, 1]",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const [countries, series] = await Promise.all([
      loadCountries(context.env, context.request.url),
      loadSeries(context.env, context.request.url, indicator),
    ]);

    // Latest observed value for a country, with its name
    const getLatestValue = (countryCode: string): LatestValue | null => {
      const name = countries.find((c) => c.iso_alpha3 === countryCode)?.name;
      const latest = series ? latestObserved(series, countryCode) : null;
      return name && latest ? { name, value: latest.value, year: latest.year } : null;
    };

    const chaserData = getLatestValue(chaser);
    const targetData = getLatestValue(target);

    if (!chaserData || !targetData) {
      return Response.json(
        {
          error: {
            code: "DATA_NOT_FOUND",
            message: "Could not find data for one or both countries",
          },
        },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    // Calculate historical growth rate if not provided
    let growthRate = parsedCustomGrowthRate;

    if (growthRate == null) {
      // Calculate CAGR from available data
      const rows = series
        ? seriesPoints(series, chaser, {
            endYear: series.projectedFrom == null ? undefined : series.projectedFrom - 1,
          })
        : [];
      if (rows.length >= 2) {
        const first = rows[0];
        const last = rows[rows.length - 1];
        const years = last.year - first.year;
        if (years > 0 && first.value > 0 && last.value > 0) {
          growthRate = Math.pow(last.value / first.value, 1 / years) - 1;
        } else {
          growthRate = 0.02;
        }
      } else {
        growthRate = 0.02; // Default 2% if not enough data
      }
    }

    // Calculate years to convergence
    // Formula: years = ln(target/chaser) / ln(1 + growth_rate)
    const ratio = targetData.value / chaserData.value;
    // This endpoint's model holds the target constant.
    const yearsToConvergenceRaw =
      Number.isFinite(ratio) && ratio > 0
        ? yearsToConverge(chaserData.value, targetData.value, {
            chaserRate: growthRate,
            targetRate: 0,
          })
        : Infinity;

    const yearsToConvergence = Number.isFinite(yearsToConvergenceRaw)
      ? Math.max(0, yearsToConvergenceRaw)
      : null;

    const convergenceYear =
      yearsToConvergence != null ? Math.round(chaserData.year + yearsToConvergence) : null;

    // Generate projection data
    const projection: Array<{ year: number; chaser: number; target: number }> = [];
    const baseYear = chaserData.year;
    const maxYears =
      yearsToConvergence == null ? 150 : Math.min(Math.ceil(yearsToConvergence) + 10, 150);

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

    return Response.json(
      {
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
        years_to_convergence:
          yearsToConvergence == null ? null : Math.round(yearsToConvergence * 10) / 10,
        convergence_year: convergenceYear,
        projection,
      },
      {
        headers: {
          "cache-control": STATIC_DATA_CACHE_CONTROL,
        },
      },
    );
  } catch {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to calculate convergence" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
};
