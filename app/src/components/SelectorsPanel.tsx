import type { Country, Indicator } from "../types";
import { CountrySelector } from "./CountrySelector";
import { MetricSelector } from "./MetricSelector";
import { RegionSelector } from "./RegionSelector";

export function SelectorsPanel({
  comparisonMode,
  onComparisonModeChange,
  countries,
  indicators,
  indicatorsLoading,
  chaserIso,
  targetIso,
  onChaserIsoChange,
  onTargetIsoChange,
  onSwapCountries,
  indicatorCode,
  onIndicatorCodeChange,
  chaserRegionCode,
  targetRegionCode,
  onChaserRegionCodeChange,
  onTargetRegionCodeChange,
  onSwapRegions,
}: {
  comparisonMode: "countries" | "regions";
  onComparisonModeChange: (mode: "countries" | "regions") => void;
  countries: Country[];
  indicators: Indicator[];
  indicatorsLoading: boolean;
  chaserIso: string;
  targetIso: string;
  onChaserIsoChange: (iso: string) => void;
  onTargetIsoChange: (iso: string) => void;
  onSwapCountries: () => void;
  indicatorCode: string;
  onIndicatorCodeChange: (code: string) => void;
  chaserRegionCode: string;
  targetRegionCode: string;
  onChaserRegionCodeChange: (code: string) => void;
  onTargetRegionCodeChange: (code: string) => void;
  onSwapRegions: () => void;
}) {
  return (
    <div className="animate-fade-in-up stagger-1 no-print space-y-2">
      <div className="flex items-center justify-between lg:hidden">
        <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => onComparisonModeChange("countries")}
            aria-pressed={comparisonMode === "countries"}
            className={[
              "px-3 py-1.5 text-xs font-medium transition-default focus-ring",
              comparisonMode === "countries"
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-raised/60",
            ].join(" ")}
          >
            Countries
          </button>
          <button
            type="button"
            onClick={() => onComparisonModeChange("regions")}
            aria-pressed={comparisonMode === "regions"}
            className={[
              "px-3 py-1.5 text-xs font-medium transition-default focus-ring",
              comparisonMode === "regions"
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-raised/60",
            ].join(" ")}
          >
            Regions
          </button>
        </div>
        {comparisonMode === "regions" && (
          <span className="text-xs text-ink-faint">
            GDP per capita (USD PPP) · OECD Data
          </span>
        )}
      </div>

      {comparisonMode === "countries" && (
        <div className="card p-3 sm:p-4">
          {/* Desktop: single row with all 4 items */}
	          <div className="hidden lg:flex lg:items-center lg:gap-3">
	            <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden shrink-0">
	              <button
	                type="button"
	                onClick={() => onComparisonModeChange("countries")}
	                aria-pressed
	                className={[
	                  "px-3 py-2 text-xs font-medium transition-default focus-ring",
	                  "bg-surface-raised text-ink shadow-sm",
	                ].join(" ")}
	              >
	                Countries
	              </button>
	              <button
	                type="button"
	                onClick={() => onComparisonModeChange("regions")}
	                aria-pressed={false}
	                className={[
	                  "px-3 py-2 text-xs font-medium transition-default focus-ring",
	                  "text-ink-muted hover:bg-surface-raised/60",
	                ].join(" ")}
	              >
	                Regions
	              </button>
	            </div>

            <div className="min-w-[240px] flex-1">
              <CountrySelector
                dense
                label="Chaser"
                value={chaserIso}
                onChange={onChaserIsoChange}
                countries={countries}
                excludeIso={targetIso}
                color="chaser"
              />
            </div>
            <button
              type="button"
              onClick={onSwapCountries}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-sunken transition-default focus-ring shrink-0"
              title="Swap chaser and target"
              aria-label="Swap chaser and target countries"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <div className="min-w-[240px] flex-1">
              <CountrySelector
                dense
                label="Target"
                value={targetIso}
                onChange={onTargetIsoChange}
                countries={countries}
                excludeIso={chaserIso}
                color="target"
              />
            </div>
            <div className="w-[360px] shrink-0">
              <MetricSelector
                dense
                value={indicatorCode}
                onChange={onIndicatorCodeChange}
                indicators={indicators}
                disabled={indicatorsLoading}
              />
            </div>
          </div>

          {/* Tablet: 2x2 grid */}
          <div className="hidden sm:grid lg:hidden sm:grid-cols-[1fr,auto,1fr] sm:gap-3 sm:items-end">
            <CountrySelector
              label="Chaser"
              value={chaserIso}
              onChange={onChaserIsoChange}
              countries={countries}
              excludeIso={targetIso}
              color="chaser"
            />
            <button
              type="button"
              onClick={onSwapCountries}
              className="hidden sm:flex items-center justify-center w-8 h-10 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-raised border border-transparent hover:border-surface transition-default focus-ring"
              title="Swap chaser and target"
              aria-label="Swap chaser and target countries"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <CountrySelector
              label="Target"
              value={targetIso}
              onChange={onTargetIsoChange}
              countries={countries}
              excludeIso={chaserIso}
              color="target"
            />
            <div className="sm:col-span-3">
              <MetricSelector
                value={indicatorCode}
                onChange={onIndicatorCodeChange}
                indicators={indicators}
                disabled={indicatorsLoading}
              />
            </div>
          </div>

          {/* Mobile: vertical stack */}
          <div className="sm:hidden space-y-3">
            <CountrySelector
              label="Chaser"
              value={chaserIso}
              onChange={onChaserIsoChange}
              countries={countries}
              excludeIso={targetIso}
              color="chaser"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-faint">vs</span>
              <button
                type="button"
                onClick={onSwapCountries}
                className="flex items-center gap-1.5 px-3 py-1 text-xs text-ink-muted hover:text-ink transition-default focus-ring rounded-lg"
                aria-label="Swap chaser and target countries"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Swap
              </button>
            </div>
            <CountrySelector
              label="Target"
              value={targetIso}
              onChange={onTargetIsoChange}
              countries={countries}
              excludeIso={chaserIso}
              color="target"
            />
            <MetricSelector
              value={indicatorCode}
              onChange={onIndicatorCodeChange}
              indicators={indicators}
              disabled={indicatorsLoading}
            />
          </div>
        </div>
      )}

      {comparisonMode === "regions" && (
        <div className="card p-3 sm:p-4">
	          <div className="hidden lg:flex lg:items-center lg:gap-3">
	            <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden shrink-0">
	              <button
	                type="button"
	                onClick={() => onComparisonModeChange("countries")}
	                aria-pressed={false}
	                className={[
	                  "px-3 py-2 text-xs font-medium transition-default focus-ring",
	                  "text-ink-muted hover:bg-surface-raised/60",
	                ].join(" ")}
	              >
	                Countries
	              </button>
	              <button
	                type="button"
	                onClick={() => onComparisonModeChange("regions")}
	                aria-pressed
	                className={[
	                  "px-3 py-2 text-xs font-medium transition-default focus-ring",
	                  "bg-surface-raised text-ink shadow-sm",
	                ].join(" ")}
	              >
	                Regions
	              </button>
	            </div>

            <div className="min-w-[260px] flex-1">
              <RegionSelector
                dense
                label="Chaser"
                value={chaserRegionCode}
                onChange={onChaserRegionCodeChange}
                excludeCode={targetRegionCode}
                color="chaser"
              />
            </div>
            <button
              type="button"
              onClick={onSwapRegions}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-sunken transition-default focus-ring shrink-0"
              title="Swap chaser and target"
              aria-label="Swap chaser and target regions"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <div className="min-w-[260px] flex-1">
              <RegionSelector
                dense
                label="Target"
                value={targetRegionCode}
                onChange={onTargetRegionCodeChange}
                excludeCode={chaserRegionCode}
                color="target"
              />
            </div>
            <div className="shrink-0 text-xs text-ink-faint whitespace-nowrap px-2 pb-1.5">
              GDP per capita (USD PPP) · OECD Data
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-3 sm:gap-2 items-end lg:hidden">
            <RegionSelector
              label="Chaser Region"
              value={chaserRegionCode}
              onChange={onChaserRegionCodeChange}
              excludeCode={targetRegionCode}
              color="chaser"
            />
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={onSwapRegions}
                className="flex items-center gap-1.5 px-3 py-1 text-xs text-ink-muted hover:text-ink transition-default focus-ring rounded-lg"
                aria-label="Swap chaser and target regions"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Swap
              </button>
            </div>
            <RegionSelector
              label="Target Region"
              value={targetRegionCode}
              onChange={onTargetRegionCodeChange}
              excludeCode={chaserRegionCode}
              color="target"
            />
            <div className="sm:col-span-3 px-3 py-2 rounded-lg bg-surface-sunken border border-surface text-center">
              <span className="text-xs text-ink-muted">GDP per capita</span>
              <span className="mx-2 text-ink-faint">·</span>
              <span className="text-xs text-ink-faint">USD PPP · OECD Data</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
