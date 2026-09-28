import {
  type ConvergenceOutcome,
  convergenceOutcome,
  latestCommonPoint,
  type PairPoint,
} from "../../src/lib/convergenceModel";
import { adjustmentFactor } from "../../src/lib/countryAdjustments";
import { getRegionByCode, getRegionDataSeries } from "../../src/lib/oecdRegions";
import type { ShareState } from "../../src/lib/shareState";
import { seriesPoints } from "../../src/lib/staticDataFormat";
import { loadCountries, loadSeries, type StaticDataEnv } from "./staticData";

export interface PairOutcome {
  chaserName: string;
  targetName: string;
  metricName: string;
  metricUnit: string | null;
  source: string;
  /** Latest year both sides have data, or null when they don't overlap. */
  handoff: PairPoint | null;
  /** Same model and start-year rule as the app, or null without shared data. */
  outcome: ConvergenceOutcome | null;
}

/**
 * Everything a share page or OG image says about a comparison, from the build-time
 * snapshot (countries) or static OECD data (regions), through the shared model.
 */
export async function loadPairOutcome(
  env: StaticDataEnv,
  requestUrl: string,
  state: ShareState,
): Promise<PairOutcome> {
  const rates = { chaserRate: state.cg, targetRate: state.tmode === "static" ? 0 : state.tg };
  const withOutcome = (base: Omit<PairOutcome, "outcome">): PairOutcome => ({
    ...base,
    outcome: base.handoff
      ? convergenceOutcome({ handoff: base.handoff, baseYear: state.baseYear, rates })
      : null,
  });

  if (state.mode === "regions") {
    const chaserCode = state.cr ?? "UKC";
    const targetCode = state.tr ?? "UKI";
    const series = (code: string) =>
      getRegionDataSeries(code).map((p) => ({ year: p.year, value: p.gdpPerCapita }));
    return withOutcome({
      chaserName: getRegionByCode(chaserCode)?.name ?? chaserCode,
      targetName: getRegionByCode(targetCode)?.name ?? targetCode,
      metricName: "GDP per capita (USD PPP)",
      metricUnit: "USD PPP",
      source: "OECD",
      handoff: latestCommonPoint(series(chaserCode), series(targetCode)),
    });
  }

  const [countries, series] = await Promise.all([
    loadCountries(env, requestUrl),
    loadSeries(env, requestUrl, state.indicator),
  ]);
  const name = (iso: string) => countries.find((c) => c.iso_alpha3 === iso)?.name || iso;
  // Observed points only (projections never seed another projection), with the same
  // country adjustments the app applies (e.g. Ireland's GDP), as saved in the link.
  const observed = (iso: string, useAdjusted: boolean) => {
    if (!series) return [];
    const factor = adjustmentFactor(iso, state.indicator, useAdjusted);
    return seriesPoints(series, iso, {
      endYear: series.projectedFrom == null ? undefined : series.projectedFrom - 1,
    }).map((p) => ({ year: p.year, value: p.value * factor }));
  };

  return withOutcome({
    chaserName: name(state.chaser),
    targetName: name(state.target),
    metricName: series?.indicator.name || state.indicator,
    metricUnit: series?.indicator.unit ?? null,
    source: series?.indicator.source || "World Bank",
    handoff: latestCommonPoint(
      observed(state.chaser, state.adjC ?? true),
      observed(state.target, state.adjT ?? true),
    ),
  });
}
