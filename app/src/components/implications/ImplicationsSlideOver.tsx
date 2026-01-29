import { useState } from "react";
import type { TemplateId } from "../../lib/templatePaths";
import { TEMPLATE_PATHS } from "../../lib/templatePaths";
import { IMPLICATION_SCENARIOS, type ScenarioId } from "../../lib/implicationsScenarios";
import type { ImplicationCardType } from "../../lib/shareState";
import { formatMetricValue, formatNumber } from "../../lib/convergence";
import { SlideOver } from "../ui/SlideOver";
import { useImplicationsData } from "./useImplicationsData";
import {
  useImplicationsComputed,
  DEFAULT_ASSUMPTIONS,
  MIX_PRESETS,
  type ImplicationAssumptions,
} from "./useImplicationsComputed";

type PopAssumption = "trend" | "static";
type PowerMixKey = "solar" | "wind" | "nuclear" | "coal";

interface ImplicationsSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  chaserIso: string;
  chaserName: string;
  gdpCurrent: number;
  chaserGrowthRate: number;
  baseYear: number;
  horizonYears: number;
  onHorizonYearsChange: (years: number) => void;
  template: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  activeCard: ImplicationCardType;
  onActiveCardChange: (card: ImplicationCardType) => void;
}

function formatTWh(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 10 ? `${value.toFixed(0)} TWh` : `${value.toFixed(1)} TWh`;
}

function formatGW(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 10 ? `${value.toFixed(0)} GW` : `${value.toFixed(1)} GW`;
}

function formatMt(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 10 ? `${value.toFixed(0)} Mt` : `${value.toFixed(1)} Mt`;
}

function formatDollars(t: { unit: string; value: number } | null) {
  if (!t || !Number.isFinite(t.value)) return "—";
  if (t.unit === "int$") {
    if (t.value >= 1e12) return `$${(t.value / 1e12).toFixed(1)}T`;
    if (t.value >= 1e9) return `$${(t.value / 1e9).toFixed(0)}B`;
    return `$${formatNumber(t.value)}`;
  }
  return `${formatNumber(t.value)} ${t.unit}`;
}

function formatPeople(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return formatNumber(Math.round(value));
}

// Real-world equivalents for context
function nuclearPlantsEquivalent(twh: number) {
  // ~8 TWh per 1GW nuclear plant at 90% capacity factor
  const plants = twh / 8;
  return plants >= 1 ? Math.round(plants) : plants.toFixed(1);
}

function solarPanelsEquivalent(twh: number) {
  // ~1.5 MWh per residential panel per year (400W at 20% CF)
  const panels = (twh * 1e6) / 1.5; // millions of panels
  if (panels >= 1e3) return `${(panels / 1e3).toFixed(0)}B`;
  return `${panels.toFixed(0)}M`;
}

function windTurbinesEquivalent(twh: number) {
  // ~10 GWh per 3MW turbine at 35% CF
  const turbines = (twh * 1e3) / 10;
  if (turbines >= 1e6) return `${(turbines / 1e6).toFixed(1)}M`;
  if (turbines >= 1e3) return `${(turbines / 1e3).toFixed(0)}K`;
  return Math.round(turbines).toString();
}

function citiesEquivalent(people: number) {
  // Compare to well-known city sizes
  if (people >= 20e6) return `${(people / 20e6).toFixed(1)}× Mumbai`;
  if (people >= 8e6) return `${(people / 8e6).toFixed(1)}× NYC`;
  if (people >= 3e6) return `${(people / 3e6).toFixed(1)}× Chicago`;
  if (people >= 1e6) return `${(people / 1e6).toFixed(1)}× San Francisco`;
  return null;
}

function carsEquivalent(mtCo2: number) {
  // ~4.6 metric tons CO2 per car per year
  const cars = (mtCo2 * 1e6) / 4.6;
  if (cars >= 1e9) return `${(cars / 1e9).toFixed(1)}B`;
  if (cars >= 1e6) return `${(cars / 1e6).toFixed(0)}M`;
  return `${(cars / 1e3).toFixed(0)}K`;
}

export function ImplicationsSlideOver({
  isOpen,
  onClose,
  chaserIso,
  chaserName,
  gdpCurrent,
  chaserGrowthRate,
  baseYear,
  horizonYears,
  onHorizonYearsChange,
  template,
  onTemplateChange,
}: ImplicationsSlideOverProps) {
  const [popAssumption, setPopAssumption] = useState<PopAssumption>("trend");
  const [assumptions, setAssumptions] = useState<ImplicationAssumptions>(DEFAULT_ASSUMPTIONS);
  const [mix] = useState<Record<PowerMixKey, number>>(MIX_PRESETS[0].mix);
  const [scenario, setScenario] = useState<ScenarioId>("baseline");

  const {
    data,
    dataWithVintage,
    indicatorByCode,
    loading,
    error,
    getLatestValue,
    templateDef,
  } = useImplicationsData({
    chaserIso,
    template,
    enabled: isOpen,
  });

  const computed = useImplicationsComputed({
    chaserIso,
    gdpCurrent,
    chaserGrowthRate,
    horizonYears,
    baseYear,
    templateDef,
    data,
    dataWithVintage,
    indicatorByCode,
    getLatestValue,
    popAssumption,
    scenario,
    assumptions,
    mix,
  });

  const {
    gdpFuture,
    year,
    popCurrent,
    popFuture,
    popTrendRate,
    scenarioDef,
    hasAny,
    observedElectricity,
    macro,
  } = computed;

  const handleScenarioChange = (id: ScenarioId) => {
    setScenario(id);
    const s = IMPLICATION_SCENARIOS.find((x) => x.id === id);
    if (s?.presets?.horizonYears != null) onHorizonYearsChange(s.presets.horizonYears);
    if (s?.presets?.gridLossPct != null || s?.presets?.netImportsPct != null) {
      setAssumptions((a) => ({
        ...a,
        gridLossPct: s.presets?.gridLossPct ?? a.gridLossPct,
        netImportsPct: s.presets?.netImportsPct ?? a.netImportsPct,
      }));
    }
  };

  const electricityDelta = macro.electricity.buildoutDeltaTWh;
  const urbanDelta = macro.urban.deltaPersons;

  const templateFlags: Record<TemplateId, string> = {
    china: "🇨🇳",
    us: "🇺🇸",
    eu: "🇪🇺",
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Development Implications"
      subtitle={`What ${chaserName} might need at higher income levels`}
      width="2xl"
    >
      <div className="flex-1 overflow-y-auto">
        {/* Controls Section */}
        <div className="px-5 py-3 border-b border-surface bg-surface-sunken/50 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Horizon */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={150}
                value={horizonYears}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    onHorizonYearsChange(Math.max(1, Math.min(150, Math.round(next))));
                  }
                }}
                className="w-16 px-2 py-1.5 rounded-lg bg-surface border border-surface text-ink font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <span className="text-sm text-ink-muted">years → {year}</span>
            </div>

            <div className="w-px h-6 bg-surface" />

            {/* Template flags with labels */}
            <div className="flex gap-1">
              {TEMPLATE_PATHS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTemplateChange(t.id)}
                  title={`Model development path on ${t.label}`}
                  className={[
                    "px-2.5 py-1.5 rounded-lg text-sm transition-default flex items-center gap-1.5",
                    template === t.id
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-surface hover:bg-surface-raised text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  <span className="text-base">{templateFlags[t.id]}</span>
                  <span className="text-xs">{t.id === "china" ? "China" : t.id === "us" ? "US" : "EU"}-like</span>
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-surface" />

            {/* Scenario pills */}
            <div className="flex gap-1">
              {IMPLICATION_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleScenarioChange(s.id)}
                  title={s.blurb}
                  className={[
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-default",
                    scenario === s.id
                      ? "bg-ink text-surface"
                      : "bg-surface text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Population row - always visible */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">Population:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPopAssumption("trend")}
                className={[
                  "px-2 py-0.5 rounded text-xs transition-default",
                  popAssumption === "trend"
                    ? "bg-surface-raised text-ink font-medium"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                Trend
              </button>
              <button
                type="button"
                onClick={() => setPopAssumption("static")}
                className={[
                  "px-2 py-0.5 rounded text-xs transition-default",
                  popAssumption === "static"
                    ? "bg-surface-raised text-ink font-medium"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                Static
              </button>
            </div>
            {popAssumption === "trend" && popTrendRate !== 0 && (
              <span className="text-xs text-ink-faint">
                ({popTrendRate >= 0 ? "+" : ""}{(popTrendRate * 100).toFixed(1)}%/yr)
              </span>
            )}
            {scenario !== "baseline" && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="text-xs text-ink-muted">{scenarioDef.blurb}</span>
              </>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-ink-muted">
              <div className="w-5 h-5 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <span>Loading data...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="m-5 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">Could not load data: {error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !hasAny && (
          <div className="m-5 p-6 rounded-xl bg-surface border border-surface text-center">
            <p className="text-ink-muted">Not enough data available for these projections.</p>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && hasAny && (
          <div className="p-4 space-y-3">
            {/* Economic Output Card */}
            <section className="rounded-lg border border-surface bg-surface-raised overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface bg-surface/50 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Economic Output</h3>
                <span className="text-xs text-ink-muted">GDP per capita × population</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">GDP/capita</div>
                    <div className="font-semibold text-ink">{formatMetricValue(gdpCurrent, "int$")}</div>
                    <div className="text-lg font-bold text-[var(--color-accent)]">{formatMetricValue(gdpFuture, "int$")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Total GDP</div>
                    <div className="font-semibold text-ink">{formatDollars(macro.gdpTotalCurrent)}</div>
                    <div className="text-lg font-bold text-[var(--color-accent)]">{formatDollars(macro.gdpTotalFuture)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Population</div>
                    <div className="font-semibold text-ink">{formatPeople(popCurrent)}</div>
                    <div className="text-lg font-bold text-ink">{formatPeople(popFuture)}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Electricity Card */}
            <section className="rounded-lg border border-surface bg-surface-raised overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface bg-surface/50 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Electricity</h3>
                <span className="text-xs text-ink-muted">Annual generation at projected income</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Current demand</div>
                    <div className="text-xl font-bold text-ink">{formatTWh(macro.electricity.demandCurrentTWh)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Projected demand</div>
                    <div className="text-xl font-bold text-[var(--color-accent)]">{formatTWh(macro.electricity.demandFutureTWh)}</div>
                  </div>
                </div>

                {electricityDelta != null && electricityDelta > 0 && (
                  <div className="p-3 rounded-lg bg-surface space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-ink-muted">New generation needed</div>
                        <div className="text-lg font-bold text-ink">+{formatTWh(electricityDelta)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-ink-muted">Avg. power</div>
                        <div className="font-semibold text-ink">{formatGW(macro.electricity.buildoutDeltaAvgGW)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-ink-muted pt-2 border-t border-surface-sunken">
                      <span className="font-medium text-ink">That's equivalent to:</span>{" "}
                      {nuclearPlantsEquivalent(electricityDelta)} nuclear plants, or{" "}
                      {solarPanelsEquivalent(electricityDelta)} solar panels, or{" "}
                      {windTurbinesEquivalent(electricityDelta)} wind turbines
                    </div>
                  </div>
                )}

                {observedElectricity && (
                  <div className="flex items-center gap-3 pt-2 border-t border-surface">
                    <span className="text-xs text-ink-muted">Current mix ({observedElectricity.year})</span>
                    <div className="flex gap-2 flex-wrap">
                      {(["solar", "wind", "nuclear", "coal"] as const).map((source) => {
                        const share = observedElectricity.shares[source];
                        if (share == null || share < 1) return null;
                        return (
                          <span key={source} className="px-2 py-0.5 rounded bg-surface text-xs">
                            <span className="capitalize">{source}</span> {share.toFixed(0)}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Urbanization Card */}
            <section className="rounded-lg border border-surface bg-surface-raised overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface bg-surface/50 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Urbanization</h3>
                <span className="text-xs text-ink-muted">People moving to cities</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Urban now</div>
                    <div className="text-xl font-bold text-ink">{formatPeople(macro.urban.currentPersons)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Projected urban</div>
                    <div className="text-xl font-bold text-[var(--color-accent)]">{formatPeople(macro.urban.futurePersons)}</div>
                  </div>
                </div>

                {urbanDelta != null && urbanDelta > 0 && (
                  <div className="p-3 rounded-lg bg-surface space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-ink-muted">New urban residents</div>
                        <div className="text-lg font-bold text-ink">+{formatPeople(urbanDelta)}</div>
                      </div>
                      {macro.urban.homesNeeded != null && (
                        <div className="text-right">
                          <div className="text-xs text-ink-muted">Homes needed</div>
                          <div className="font-semibold text-ink">~{formatPeople(macro.urban.homesNeeded)}</div>
                        </div>
                      )}
                    </div>
                    {citiesEquivalent(urbanDelta) && (
                      <div className="text-xs text-ink-muted pt-2 border-t border-surface-sunken">
                        <span className="font-medium text-ink">Scale:</span>{" "}
                        Like adding {citiesEquivalent(urbanDelta)} to the urban population
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* CO2 Card */}
            <section className="rounded-lg border border-surface bg-surface-raised overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface bg-surface/50 flex items-center justify-between">
                <h3 className="font-semibold text-ink">CO₂ Emissions</h3>
                <span className="text-xs text-ink-muted">Territorial, if current patterns continue</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Current</div>
                    <div className="text-xl font-bold text-ink">{formatMt(macro.co2.currentMt)}</div>
                    <div className="text-xs text-ink-muted">Mt CO₂/year</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">Projected</div>
                    <div className="text-xl font-bold text-[var(--color-accent)]">{formatMt(macro.co2.futureMt)}</div>
                    <div className="text-xs text-ink-muted">Mt CO₂/year</div>
                  </div>
                </div>
                {macro.co2.futureMt != null && macro.co2.currentMt != null && (
                  <div className="text-xs text-ink-muted p-3 rounded-lg bg-surface">
                    <span className="font-medium text-ink">Context:</span>{" "}
                    The projected emissions equal ~{carsEquivalent(macro.co2.futureMt)} cars driving for a year.
                    Actual emissions depend heavily on energy mix and efficiency improvements.
                  </div>
                )}
              </div>
            </section>

            {/* Disclaimer */}
            <p className="text-xs text-ink-muted text-center pt-2">
              Illustrative projections based on historical patterns, not forecasts
            </p>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
