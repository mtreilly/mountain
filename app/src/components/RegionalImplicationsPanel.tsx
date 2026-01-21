import { useMemo } from "react";
import {
  ALL_TL2_REGIONS,
  getLatestRegionData,
  getRegionByCode,
  type OECDRegion,
} from "../lib/oecdRegions";
import { formatMetricValue } from "../lib/convergence";

interface ComparableRegion {
  region: OECDRegion;
  gdpPerCapita: number;
  difference: number; // percentage difference from chaser
}

interface RegionalImplicationsPanelProps {
  chaserCode: string;
  chaserName: string;
  gdpCurrent: number | null;
  chaserGrowthRate: number;
  baseYear: number;
  horizonYears: number;
  onHorizonYearsChange: (years: number) => void;
}

export function RegionalImplicationsPanel({
  chaserCode,
  chaserName,
  gdpCurrent,
  chaserGrowthRate,
  baseYear,
  horizonYears,
  onHorizonYearsChange,
}: RegionalImplicationsPanelProps) {
  const chaserRegion = getRegionByCode(chaserCode);
  const year = baseYear + horizonYears;
  const gdpFuture = gdpCurrent
    ? gdpCurrent * Math.pow(1 + chaserGrowthRate, horizonYears)
    : null;

  // Find regions with similar GDP per capita (within ±20%)
  const comparableRegions = useMemo((): ComparableRegion[] => {
    if (!gdpCurrent) return [];

    const comparable: ComparableRegion[] = [];
    const minGdp = gdpCurrent * 0.8;
    const maxGdp = gdpCurrent * 1.2;

    for (const region of ALL_TL2_REGIONS) {
      if (region.code === chaserCode) continue;
      const data = getLatestRegionData(region.code);
      if (!data) continue;

      if (data.gdpPerCapita >= minGdp && data.gdpPerCapita <= maxGdp) {
        comparable.push({
          region,
          gdpPerCapita: data.gdpPerCapita,
          difference: ((data.gdpPerCapita - gdpCurrent) / gdpCurrent) * 100,
        });
      }
    }

    // Sort by closest to chaser
    comparable.sort(
      (a, b) => Math.abs(a.difference) - Math.abs(b.difference)
    );

    return comparable.slice(0, 5);
  }, [chaserCode, gdpCurrent]);

  // Find regions at projected future GDP level
  const futureComparableRegions = useMemo((): ComparableRegion[] => {
    if (!gdpFuture) return [];

    const comparable: ComparableRegion[] = [];
    const minGdp = gdpFuture * 0.85;
    const maxGdp = gdpFuture * 1.15;

    for (const region of ALL_TL2_REGIONS) {
      if (region.code === chaserCode) continue;
      const data = getLatestRegionData(region.code);
      if (!data) continue;

      if (data.gdpPerCapita >= minGdp && data.gdpPerCapita <= maxGdp) {
        comparable.push({
          region,
          gdpPerCapita: data.gdpPerCapita,
          difference: ((data.gdpPerCapita - gdpFuture) / gdpFuture) * 100,
        });
      }
    }

    comparable.sort(
      (a, b) => Math.abs(a.difference) - Math.abs(b.difference)
    );

    return comparable.slice(0, 5);
  }, [chaserCode, gdpFuture]);

  // Get national average for comparison
  const nationalComparison = useMemo(() => {
    if (!chaserRegion || !gdpCurrent) return null;

    // Find all regions from the same country
    const sameCountryRegions = ALL_TL2_REGIONS.filter(
      (r) => r.countryCode === chaserRegion.countryCode
    );

    let totalGdp = 0;
    let count = 0;

    for (const region of sameCountryRegions) {
      const data = getLatestRegionData(region.code);
      if (data) {
        totalGdp += data.gdpPerCapita;
        count++;
      }
    }

    if (count === 0) return null;

    const nationalAverage = totalGdp / count;
    const percentOfNational = (gdpCurrent / nationalAverage) * 100;

    // Find highest and lowest in country
    let highest: { region: OECDRegion; value: number } | null = null;
    let lowest: { region: OECDRegion; value: number } | null = null;

    for (const region of sameCountryRegions) {
      const data = getLatestRegionData(region.code);
      if (!data) continue;

      if (!highest || data.gdpPerCapita > highest.value) {
        highest = { region, value: data.gdpPerCapita };
      }
      if (!lowest || data.gdpPerCapita < lowest.value) {
        lowest = { region, value: data.gdpPerCapita };
      }
    }

    return {
      nationalAverage,
      percentOfNational,
      highest,
      lowest,
      countryName: chaserRegion.countryName,
    };
  }, [chaserRegion, gdpCurrent]);

  if (!gdpCurrent || !chaserRegion) {
    return (
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          Regional Context
        </h3>
        <p className="mt-2 text-sm text-ink-muted">
          No data available for this region.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Regional Context
          </h3>
          <p className="text-[11px] text-ink-faint mt-1">
            Compare {chaserName} to similar regions across OECD countries.
          </p>
        </div>
      </div>

      {/* National comparison */}
      {nationalComparison && (
        <div className="mt-3 rounded-lg border border-surface bg-surface-raised px-3 py-2">
          <div className="text-xs font-medium text-ink">
            Position in {nationalComparison.countryName}
          </div>
          <div className="mt-1 text-[11px] text-ink-muted">
            {chaserName} is at{" "}
            <span className="font-medium text-ink">
              {nationalComparison.percentOfNational.toFixed(0)}%
            </span>{" "}
            of the national average (
            {formatMetricValue(nationalComparison.nationalAverage, "int$")})
          </div>
          {nationalComparison.highest && nationalComparison.lowest && (
            <div className="mt-1 text-[11px] text-ink-faint">
              Range: {nationalComparison.lowest.region.name} (
              {formatMetricValue(nationalComparison.lowest.value, "int$")}) →{" "}
              {nationalComparison.highest.region.name} (
              {formatMetricValue(nationalComparison.highest.value, "int$")})
            </div>
          )}
        </div>
      )}

      {/* Comparable regions now */}
      {comparableRegions.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-ink">
            Similar regions today
          </div>
          <p className="text-[11px] text-ink-faint">
            Regions with similar GDP per capita (±20%)
          </p>
          <div className="mt-2 space-y-1">
            {comparableRegions.map((item) => (
              <div
                key={item.region.code}
                className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-surface"
              >
                <span className="text-ink truncate">
                  {item.region.name}
                  <span className="text-ink-faint ml-1">
                    ({item.region.countryName})
                  </span>
                </span>
                <span className="text-ink-muted shrink-0 ml-2">
                  {formatMetricValue(item.gdpPerCapita, "int$")}
                  <span
                    className={`ml-1 ${item.difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    ({item.difference >= 0 ? "+" : ""}
                    {item.difference.toFixed(0)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Horizon year control */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-ink-muted">Projection horizon</div>
        <div className="flex items-center gap-2">
          <input
            id="reg-imp-years"
            type="number"
            min={1}
            max={150}
            step={1}
            value={horizonYears}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onHorizonYearsChange(Math.max(1, Math.min(150, Math.round(next))));
            }}
            className="w-16 px-2 py-1 rounded-md bg-surface border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <span className="text-[11px] text-ink-faint">years ({year})</span>
        </div>
      </div>

      {/* GDP projection */}
      {gdpFuture && (
        <div className="mt-2 text-[11px] text-ink-faint">
          {chaserName}: {formatMetricValue(gdpCurrent, "int$")} →{" "}
          {formatMetricValue(gdpFuture, "int$")} ({year})
        </div>
      )}

      {/* Comparable regions at future GDP */}
      {futureComparableRegions.length > 0 && gdpFuture && (
        <div className="mt-3">
          <div className="text-xs font-medium text-ink">
            Regions at projected level ({year})
          </div>
          <p className="text-[11px] text-ink-faint">
            Regions currently at ~{formatMetricValue(gdpFuture, "int$")} GDP/cap
          </p>
          <div className="mt-2 space-y-1">
            {futureComparableRegions.map((item) => (
              <div
                key={item.region.code}
                className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-surface"
              >
                <span className="text-ink truncate">
                  {item.region.name}
                  <span className="text-ink-faint ml-1">
                    ({item.region.countryName})
                  </span>
                </span>
                <span className="text-ink-muted shrink-0 ml-2">
                  {formatMetricValue(item.gdpPerCapita, "int$")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {futureComparableRegions.length === 0 && gdpFuture && (
        <div className="mt-3">
          <div className="text-xs font-medium text-ink">
            Regions at projected level ({year})
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            {gdpFuture > 80000
              ? "Projected GDP exceeds all regions in database."
              : "No comparable regions found at this GDP level."}
          </p>
        </div>
      )}

      <p className="mt-3 text-[11px] text-ink-faint">
        Data: OECD Regions and Cities at a Glance 2024. GDP per capita in USD
        PPP (constant 2015 prices).
      </p>
    </div>
  );
}
