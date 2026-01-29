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
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Development Implications"
      subtitle={`What ${chaserName} might need at higher income levels`}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Controls Section */}
        <div className="p-5 border-b border-surface bg-surface-sunken/50">
          {/* Main projection info */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="text-sm text-ink-muted mb-1">Projecting over</div>
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
                  className="w-20 px-3 py-2 rounded-lg bg-surface border border-surface text-ink text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <span className="text-ink">years</span>
                <span className="text-ink-muted">(to {year})</span>
              </div>
            </div>
          </div>

          {/* Template selection */}
          <div className="mb-4">
            <div className="text-sm text-ink-muted mb-2">Development path template</div>
            <div className="flex gap-2">
              {TEMPLATE_PATHS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTemplateChange(t.id)}
                  className={[
                    "px-4 py-2 rounded-lg text-sm font-medium transition-default",
                    template === t.id
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-surface border border-surface text-ink hover:bg-surface-raised",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario selection */}
          <div className="mb-4">
            <div className="text-sm text-ink-muted mb-2">Scenario</div>
            <div className="flex flex-wrap gap-2">
              {IMPLICATION_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleScenarioChange(s.id)}
                  className={[
                    "px-3 py-1.5 rounded-full text-sm transition-default",
                    scenario === s.id
                      ? "bg-ink text-surface font-medium"
                      : "bg-surface text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {scenario !== "baseline" && (
              <p className="mt-2 text-sm text-ink-muted">{scenarioDef.blurb}</p>
            )}
          </div>

          {/* More options toggle */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-default"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showSettings ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Population & assumptions
          </button>

          {showSettings && (
            <div className="mt-3 pt-3 border-t border-surface space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">Population projection</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPopAssumption("trend")}
                    className={[
                      "px-3 py-1.5 rounded-lg text-sm transition-default",
                      popAssumption === "trend"
                        ? "bg-surface-raised text-ink font-medium"
                        : "text-ink-muted hover:text-ink",
                    ].join(" ")}
                  >
                    10yr trend
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopAssumption("static")}
                    className={[
                      "px-3 py-1.5 rounded-lg text-sm transition-default",
                      popAssumption === "static"
                        ? "bg-surface-raised text-ink font-medium"
                        : "text-ink-muted hover:text-ink",
                    ].join(" ")}
                  >
                    Static
                  </button>
                </div>
              </div>
              {popAssumption === "trend" && popTrendRate !== 0 && (
                <p className="text-sm text-ink-muted">
                  Growing at {popTrendRate >= 0 ? "+" : ""}{(popTrendRate * 100).toFixed(2)}% per year
                </p>
              )}
            </div>
          )}
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
          <div className="p-5 space-y-4">
            {/* Economic Output Card */}
            <section className="rounded-xl border border-surface bg-surface-raised overflow-hidden">
              <div className="p-4 border-b border-surface bg-surface/50">
                <h3 className="text-base font-semibold text-ink">Economic Output</h3>
                <p className="text-sm text-ink-muted mt-1">
                  Total economic output based on GDP per capita and population growth
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-ink-muted mb-1">GDP per capita</div>
                    <div className="text-lg font-semibold text-ink">
                      {formatMetricValue(gdpCurrent, "int$")}
                    </div>
                    <div className="text-sm text-ink-muted">today</div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted mb-1">&nbsp;</div>
                    <div className="text-lg font-semibold text-[var(--color-accent)]">
                      {formatMetricValue(gdpFuture, "int$")}
                    </div>
                    <div className="text-sm text-ink-muted">projected</div>
                  </div>
                </div>
                <div className="pt-3 border-t border-surface grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Total GDP</div>
                    <div className="text-xl font-semibold text-ink">
                      {formatDollars(macro.gdpTotalCurrent)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted mb-1">&nbsp;</div>
                    <div className="text-xl font-semibold text-[var(--color-accent)]">
                      {formatDollars(macro.gdpTotalFuture)}
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-surface grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Population</div>
                    <div className="text-lg font-medium text-ink">
                      {formatPeople(popCurrent)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted mb-1">&nbsp;</div>
                    <div className="text-lg font-medium text-ink">
                      {formatPeople(popFuture)}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Electricity Card */}
            <section className="rounded-xl border border-surface bg-surface-raised overflow-hidden">
              <div className="p-4 border-b border-surface bg-surface/50">
                <h3 className="text-base font-semibold text-ink">Electricity</h3>
                <p className="text-sm text-ink-muted mt-1">
                  How much electricity the country would consume at projected income levels
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Current demand</div>
                    <div className="text-xl font-semibold text-ink">
                      {formatTWh(macro.electricity.demandCurrentTWh)}
                    </div>
                    <div className="text-sm text-ink-muted">per year</div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Projected demand</div>
                    <div className="text-xl font-semibold text-[var(--color-accent)]">
                      {formatTWh(macro.electricity.demandFutureTWh)}
                    </div>
                    <div className="text-sm text-ink-muted">per year</div>
                  </div>
                </div>

                {electricityDelta != null && electricityDelta > 0 && (
                  <div className="p-4 rounded-lg bg-surface">
                    <div className="text-sm text-ink-muted mb-1">New generation capacity needed</div>
                    <div className="text-2xl font-bold text-ink">
                      +{formatTWh(electricityDelta)}
                    </div>
                    <p className="text-sm text-ink-muted mt-2">
                      This is roughly equivalent to{" "}
                      <span className="font-medium text-ink">
                        {formatGW(macro.electricity.buildoutDeltaAvgGW)}
                      </span>{" "}
                      of average continuous power output
                    </p>
                  </div>
                )}

                {observedElectricity && (
                  <div className="pt-3 border-t border-surface">
                    <div className="text-sm text-ink-muted mb-2">
                      Current generation mix ({observedElectricity.year})
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {(["solar", "wind", "nuclear", "coal"] as const).map((source) => {
                        const share = observedElectricity.shares[source];
                        return (
                          <div key={source} className="p-2 rounded-lg bg-surface">
                            <div className="text-xs text-ink-muted capitalize">{source}</div>
                            <div className="text-sm font-medium text-ink">
                              {share != null ? `${share.toFixed(0)}%` : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Urbanization Card */}
            <section className="rounded-xl border border-surface bg-surface-raised overflow-hidden">
              <div className="p-4 border-b border-surface bg-surface/50">
                <h3 className="text-base font-semibold text-ink">Urbanization</h3>
                <p className="text-sm text-ink-muted mt-1">
                  How many people are likely to move to cities as the economy develops
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Urban population now</div>
                    <div className="text-xl font-semibold text-ink">
                      {formatPeople(macro.urban.currentPersons)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Projected urban</div>
                    <div className="text-xl font-semibold text-[var(--color-accent)]">
                      {formatPeople(macro.urban.futurePersons)}
                    </div>
                  </div>
                </div>

                {urbanDelta != null && urbanDelta > 0 && (
                  <div className="p-4 rounded-lg bg-surface">
                    <div className="text-sm text-ink-muted mb-1">New urban residents</div>
                    <div className="text-2xl font-bold text-ink">
                      +{formatPeople(urbanDelta)}
                    </div>
                    {macro.urban.homesNeeded != null && (
                      <p className="text-sm text-ink-muted mt-2">
                        Requiring approximately{" "}
                        <span className="font-medium text-ink">
                          {formatPeople(macro.urban.homesNeeded)}
                        </span>{" "}
                        new homes over {horizonYears} years
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* CO2 Card */}
            <section className="rounded-xl border border-surface bg-surface-raised overflow-hidden">
              <div className="p-4 border-b border-surface bg-surface/50">
                <h3 className="text-base font-semibold text-ink">CO₂ Emissions</h3>
                <p className="text-sm text-ink-muted mt-1">
                  Territorial carbon emissions if current patterns continue
                </p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Current emissions</div>
                    <div className="text-xl font-semibold text-ink">
                      {formatMt(macro.co2.currentMt)} CO₂
                    </div>
                    <div className="text-sm text-ink-muted">per year</div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-muted mb-1">Projected emissions</div>
                    <div className="text-xl font-semibold text-[var(--color-accent)]">
                      {formatMt(macro.co2.futureMt)} CO₂
                    </div>
                    <div className="text-sm text-ink-muted">per year</div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-ink-muted">
                  Note: Actual emissions depend heavily on energy mix choices and technology adoption
                </p>
              </div>
            </section>

            {/* Disclaimer */}
            <div className="pt-4 text-center">
              <p className="text-sm text-ink-muted">
                These are illustrative projections based on historical development patterns, not forecasts.
                Actual outcomes depend on policy choices, technology, and economic structure.
              </p>
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
