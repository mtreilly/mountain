import { useMemo } from "react";
import {
  type OECDRegion,
  ALL_TL2_REGIONS,
  COUNTRIES_WITH_REGIONS,
  getRegionsByCountry,
  getRegionByCode,
  getLatestRegionData,
  getRegionDataSeries,
} from "../lib/oecdRegions";
import type { Milestone } from "../lib/convergence";
import { calculateMilestones } from "../lib/convergence";

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

interface UseOECDRegionDataParams {
  regionCodes: string[];
}

interface DataPoint {
  year: number;
  value: number;
}

interface UseOECDRegionDataResult {
  /** GDP per capita data keyed by region code */
  data: Record<string, DataPoint[]>;
  /** Get the latest value for a region */
  getLatestValue: (code: string) => number | null;
  /** Loading state (always false for static data) */
  loading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Hook for fetching OECD regional GDP data
 * Currently uses static data; designed to support live API when available
 */
export function useOECDRegionData({
  regionCodes,
}: UseOECDRegionDataParams): UseOECDRegionDataResult {
  const data = useMemo(() => {
    const result: Record<string, DataPoint[]> = {};

    for (const code of regionCodes) {
      const regionData = getRegionDataSeries(code);
      if (regionData.length > 0) {
        result[code] = regionData.map((d) => ({
          year: d.year,
          value: d.gdpPerCapita,
        }));
      }
    }

    return result;
  }, [regionCodes]);

  const getLatestValue = useMemo(() => {
    return (code: string): number | null => {
      const latestData = getLatestRegionData(code);
      return latestData?.gdpPerCapita ?? null;
    };
  }, []);

  return {
    data,
    getLatestValue,
    loading: false,
    error: null,
  };
}

interface UseRegionalConvergenceParams {
  chaserCode: string;
  targetCode: string;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  baseYear?: number;
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
  baseYear = 2023,
}: UseRegionalConvergenceParams): UseRegionalConvergenceResult {
  return useMemo(() => {
    const chaserRegion = getRegionByCode(chaserCode);
    const targetRegion = getRegionByCode(targetCode);
    const chaserLatest = getLatestRegionData(chaserCode);
    const targetLatest = getLatestRegionData(targetCode);

    if (!chaserLatest || !targetLatest) {
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

    const chaserValue = chaserLatest.gdpPerCapita;
    const targetValue = targetLatest.gdpPerCapita;
    const gap = targetValue / chaserValue;

    // Calculate convergence
    let yearsToConvergence = Infinity;
    let convergenceYear: number | null = null;

    if (chaserValue >= targetValue) {
      yearsToConvergence = 0;
      convergenceYear = baseYear;
    } else if (chaserGrowthRate > targetGrowthRate) {
      const ratio = targetValue / chaserValue;
      const growthRatio = (1 + chaserGrowthRate) / (1 + targetGrowthRate);
      if (growthRatio > 1) {
        yearsToConvergence = Math.log(ratio) / Math.log(growthRatio);
        convergenceYear = Math.round(baseYear + yearsToConvergence);
      }
    }

    // Generate projection
    const maxYears = Math.min(
      Number.isFinite(yearsToConvergence) ? Math.ceil(yearsToConvergence) + 20 : 100,
      150
    );
    const projection: ProjectionPoint[] = [];

    for (let y = 0; y <= maxYears; y++) {
      const year = baseYear + y;
      const chaser = chaserValue * Math.pow(1 + chaserGrowthRate, y);
      const target = targetValue * Math.pow(1 + targetGrowthRate, y);
      projection.push({ year, chaser: Math.round(chaser), target: Math.round(target) });

      if (chaser >= target) break;
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
