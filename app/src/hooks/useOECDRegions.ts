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

interface Milestone {
  year: number;
  percent: number;
  chaserValue: number;
  targetValue: number;
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
  /** Gap as percentage */
  gap: number | null;
  /** Years until convergence */
  yearsToConvergence: number | null;
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
        yearsToConvergence: null,
        convergenceYear: null,
        projection: [],
        milestones: [],
        hasData: false,
      };
    }

    const chaserValue = chaserLatest.gdpPerCapita;
    const targetValue = targetLatest.gdpPerCapita;
    const gap = ((targetValue - chaserValue) / chaserValue) * 100;

    // Calculate convergence
    const growthDiff = chaserGrowthRate - targetGrowthRate;
    let yearsToConvergence: number | null = null;
    let convergenceYear: number | null = null;

    if (growthDiff > 0 && chaserValue < targetValue) {
      const ratio = targetValue / chaserValue;
      yearsToConvergence = Math.ceil(
        Math.log(ratio) / Math.log(1 + growthDiff / 100)
      );
      convergenceYear = baseYear + yearsToConvergence;
    }

    // Generate projection
    const maxYears = yearsToConvergence
      ? Math.min(yearsToConvergence + 10, 100)
      : 50;
    const projection: ProjectionPoint[] = [];

    for (let y = 0; y <= maxYears; y++) {
      const year = baseYear + y;
      const chaser = chaserValue * (1 + chaserGrowthRate / 100) ** y;
      const target = targetValue * (1 + targetGrowthRate / 100) ** y;
      projection.push({ year, chaser, target });

      // Stop if chaser has significantly passed target
      if (chaser > target * 1.2) break;
    }

    // Calculate milestones (25%, 50%, 75% of gap closed)
    const milestones: Milestone[] = [];
    const initialGap = targetValue - chaserValue;

    if (initialGap > 0 && growthDiff > 0) {
      for (const percent of [25, 50, 75]) {
        const targetGapClosed = (percent / 100) * initialGap;
        const targetChaserValue = chaserValue + targetGapClosed;

        // Find year when chaser reaches this value
        // chaserValue * (1 + rate)^y = targetChaserValue
        // y = log(targetChaserValue / chaserValue) / log(1 + rate)
        const yearsToMilestone = Math.ceil(
          Math.log(targetChaserValue / chaserValue) /
            Math.log(1 + chaserGrowthRate / 100)
        );

        const milestoneYear = baseYear + yearsToMilestone;
        const chaserAtMilestone =
          chaserValue * (1 + chaserGrowthRate / 100) ** yearsToMilestone;
        const targetAtMilestone =
          targetValue * (1 + targetGrowthRate / 100) ** yearsToMilestone;

        if (yearsToMilestone <= maxYears) {
          milestones.push({
            year: milestoneYear,
            percent,
            chaserValue: chaserAtMilestone,
            targetValue: targetAtMilestone,
          });
        }
      }
    }

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
