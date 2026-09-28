import { useMemo } from "react";
import type { Milestone } from "../lib/convergence";
import { calculateMilestones } from "../lib/convergence";
import { convergenceOutcome, latestCommonPoint } from "../lib/convergenceModel";
import {
  ALL_TL2_REGIONS,
  COUNTRIES_WITH_REGIONS,
  getRegionByCode,
  getRegionDataSeries,
  getRegionsByCountry,
  type OECDRegion,
} from "../lib/oecdRegions";

interface UseOECDRegionsResult {
  /** All available TL2 regions */
  regions: OECDRegion[];
  /** Countries that have regional data */
  countriesWithRegions: typeof COUNTRIES_WITH_REGIONS;
  /** Get regions for a specific country */
  getRegionsByCountry: (countryCode: string) => OECDRegion[];
  /** Get a region by its code */
  getRegionByCode: (code: string) => OECDRegion | undefined;
  /** Check if a country has regional data */
  hasRegionalData: (countryCode: string) => boolean;
}

/**
 * Hook for accessing OECD regional metadata
 */
export function useOECDRegions(): UseOECDRegionsResult {
  const hasRegionalData = useMemo(() => {
    const countryCodes = new Set<string>(COUNTRIES_WITH_REGIONS.map((c) => c.code));
    return (countryCode: string) => countryCodes.has(countryCode);
  }, []);

  return {
    regions: ALL_TL2_REGIONS,
    countriesWithRegions: COUNTRIES_WITH_REGIONS,
    getRegionsByCountry,
    getRegionByCode,
    hasRegionalData,
  };
}

interface UseRegionalConvergenceParams {
  chaserCode: string;
  targetCode: string;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  baseYear: number;
}

interface ProjectionPoint {
  year: number;
  chaser: number;
  target: number;
}

interface UseRegionalConvergenceResult {
  /** Chaser region info */
  chaserRegion: OECDRegion | undefined;
  /** Target region info */
  targetRegion: OECDRegion | undefined;
  /** Current GDP per capita of chaser */
  chaserValue: number | null;
  /** Current GDP per capita of target */
  targetValue: number | null;
  /** Gap as ratio (target/chaser) */
  gap: number | null;
  /** Years until convergence */
  yearsToConvergence: number;
  /** Year of convergence */
  convergenceYear: number | null;
  /** Projection data for charting */
  projection: ProjectionPoint[];
  /** Milestone points (25%, 50%, 75%) */
  milestones: Milestone[];
  /** Whether we have valid data */
  hasData: boolean;
}

/**
 * Hook for calculating regional convergence
 */
export function useRegionalConvergence({
  chaserCode,
  targetCode,
  chaserGrowthRate,
  targetGrowthRate,
  baseYear,
}: UseRegionalConvergenceParams): UseRegionalConvergenceResult {
  return useMemo(() => {
    const chaserRegion = getRegionByCode(chaserCode);
    const targetRegion = getRegionByCode(targetCode);
    const chaserSeries = getRegionDataSeries(chaserCode);
    const targetSeries = getRegionDataSeries(targetCode);

    if (chaserSeries.length === 0 || targetSeries.length === 0) {
      return {
        chaserRegion,
        targetRegion,
        chaserValue: null,
        targetValue: null,
        gap: null,
        yearsToConvergence: Infinity,
        convergenceYear: null,
        projection: [],
        milestones: [],
        hasData: false,
      };
    }

    const handoff = latestCommonPoint(
      chaserSeries.map((p) => ({ year: p.year, value: p.gdpPerCapita })),
      targetSeries.map((p) => ({ year: p.year, value: p.gdpPerCapita })),
    );

    if (!handoff) {
      return {
        chaserRegion,
        targetRegion,
        chaserValue: null,
        targetValue: null,
        gap: null,
        yearsToConvergence: Infinity,
        convergenceYear: null,
        projection: [],
        milestones: [],
        hasData: false,
      };
    }

    const outcome = convergenceOutcome({
      handoff,
      baseYear,
      rates: { chaserRate: chaserGrowthRate, targetRate: targetGrowthRate },
    });
    const projectionStartYear = outcome.start.year;
    const chaserValue = outcome.start.chaser;
    const targetValue = outcome.start.target;
    const gap = targetValue / chaserValue;
    const { yearsToConvergence, convergenceYear } = outcome;

    // Generate projection
    const maxYears = Math.min(
      Number.isFinite(yearsToConvergence) ? Math.ceil(yearsToConvergence) + 20 : 100,
      150,
    );
    const projection: ProjectionPoint[] = [];

    for (let y = 0; y <= maxYears; y++) {
      const year = projectionStartYear + y;
      const chaser = chaserValue * Math.pow(1 + chaserGrowthRate, y);
      const target = targetValue * Math.pow(1 + targetGrowthRate, y);
      projection.push({ year, chaser: Math.round(chaser), target: Math.round(target) });

      if (y > 0 && chaser >= target) break;
    }

    const milestones = calculateMilestones(projection);

    return {
      chaserRegion,
      targetRegion,
      chaserValue,
      targetValue,
      gap,
      yearsToConvergence,
      convergenceYear,
      projection,
      milestones,
      hasData: true,
    };
  }, [chaserCode, targetCode, chaserGrowthRate, targetGrowthRate, baseYear]);
}
