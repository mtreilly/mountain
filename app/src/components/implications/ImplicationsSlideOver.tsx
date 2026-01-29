import { useState } from "react";
import type { TemplateId } from "../../lib/templatePaths";
import { TEMPLATE_PATHS } from "../../lib/templatePaths";
import { IMPLICATION_SCENARIOS, type ScenarioId } from "../../lib/implicationsScenarios";
import type { ImplicationCardType } from "../../lib/shareState";
import { formatMetricValue, formatNumber } from "../../lib/convergence";
import { SlideOver } from "../ui/SlideOver";
import { ImplicationsTabs } from "./ImplicationsTabs";
import { GdpTotalsCard } from "./GdpTotalsCard";
import { ElectricityDemandCard } from "./ElectricityDemandCard";
import { ElectricityMixCard } from "./ElectricityMixCard";
import { ElectricityAssumptionsCard } from "./ElectricityAssumptionsCard";
import { UrbanizationCard } from "./UrbanizationCard";
import { Co2EmissionsCard } from "./Co2EmissionsCard";
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
  activeCard,
  onActiveCardChange,
}: ImplicationsSlideOverProps) {
  const [popAssumption, setPopAssumption] = useState<PopAssumption>("trend");
  const [assumptions, setAssumptions] = useState<ImplicationAssumptions>(DEFAULT_ASSUMPTIONS);
  const [mixMode, setMixMode] = useState(false);
  const [mix, setMix] = useState<Record<PowerMixKey, number>>(MIX_PRESETS[0].mix);
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
    baselineMultipliers,
    mixBuildout,
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

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Development Implications"
      subtitle={chaserName}
    >
      {/* Summary bar */}
      <div className="px-5 py-3 bg-surface-sunken border-b border-surface">
        <div className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-ink-muted">GDP/cap:</span>
            <span className="font-mono font-medium text-ink">
              {formatMetricValue(gdpCurrent, "int$")}
            </span>
            <span className="text-ink-faint">→</span>
            <span className="font-mono font-medium text-ink">
              {formatMetricValue(gdpFuture, "int$")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-ink-muted">
            <span>{horizonYears}y</span>
            <span className="text-ink-faint">•</span>
            <span>{year}</span>
          </div>
        </div>
      </div>

      {/* Quick controls row */}
      <div className="px-5 py-4 border-b border-surface space-y-4">
        {/* Template + Horizon row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
            {TEMPLATE_PATHS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTemplateChange(t.id)}
                className={[
                  "px-3 py-1.5 text-sm font-medium transition-default",
                  template === t.id
                    ? "bg-surface-raised text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

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
              className="w-16 px-2 py-1.5 rounded-lg bg-surface border border-surface text-ink text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <span className="text-sm text-ink-muted">years</span>
          </div>
        </div>

        {/* Scenario row */}
        <div className="flex flex-wrap items-center gap-2">
          {IMPLICATION_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleScenarioChange(s.id)}
              className={[
                "px-3 py-1.5 rounded-full text-sm font-medium transition-default",
                scenario === s.id
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-surface text-ink-muted hover:text-ink hover:bg-surface-raised",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Settings toggle */}
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
          <span>More options</span>
          {popAssumption !== "trend" && (
            <span className="px-1.5 py-0.5 rounded bg-surface text-xs">Pop: static</span>
          )}
        </button>

        {/* Expanded settings */}
        {showSettings && (
          <div className="pt-3 space-y-3 border-t border-surface">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Population</span>
              <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPopAssumption("trend")}
                  className={[
                    "px-3 py-1.5 text-sm transition-default",
                    popAssumption === "trend"
                      ? "bg-surface-raised text-ink"
                      : "text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  Trend
                </button>
                <button
                  type="button"
                  onClick={() => setPopAssumption("static")}
                  className={[
                    "px-3 py-1.5 text-sm transition-default",
                    popAssumption === "static"
                      ? "bg-surface-raised text-ink"
                      : "text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  Static
                </button>
              </div>
            </div>
            {popAssumption === "trend" && (
              <p className="text-xs text-ink-faint">
                Population growing at {popTrendRate >= 0 ? "+" : ""}
                {(popTrendRate * 100).toFixed(2)}%/yr (10-year trend)
              </p>
            )}
            <p className="text-xs text-ink-faint">
              {popCurrent != null && (
                <>
                  {formatNumber(Math.round(popCurrent))} →{" "}
                  {popFuture != null ? formatNumber(Math.round(popFuture)) : "—"} people
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Scenario description */}
      {scenario !== "baseline" && (
        <div className="px-5 py-2 bg-[var(--color-accent)]/5 border-b border-surface">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-[var(--color-accent)]">{scenarioDef.label}:</span>{" "}
            {scenarioDef.blurb}
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
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
          <div className="m-5 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Could not load data: {error}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !hasAny && (
          <div className="m-5 p-4 rounded-xl border border-surface bg-surface">
            <p className="text-sm text-ink-muted">
              Not enough data available for these metrics.
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && hasAny && (
          <>
            {/* Tabs */}
            <div className="sticky top-0 z-10 bg-surface-raised border-b border-surface">
              <div className="px-5">
                <ImplicationsTabs activeCard={activeCard} onCardChange={onActiveCardChange} />
              </div>
            </div>

            {/* Card content */}
            <div className="p-5">
              {activeCard === "gdp" && (
                <GdpTotalsCard
                  data={{
                    gdpTotalCurrent: macro.gdpTotalCurrent,
                    gdpTotalFuture: macro.gdpTotalFuture,
                    popCurrent,
                    popFuture,
                  }}
                />
              )}

              {activeCard === "elec-demand" && (
                <ElectricityDemandCard
                  data={{
                    demandCurrentTWh: macro.electricity.demandCurrentTWh,
                    demandFutureTWh: macro.electricity.demandFutureTWh,
                    demandDeltaTWh: macro.electricity.demandDeltaTWh,
                    requiredDomesticGenerationFutureTWh:
                      macro.electricity.requiredDomesticGenerationFutureTWh,
                    buildoutDeltaTWh: macro.electricity.buildoutDeltaTWh,
                    demandDeltaAvgGW: macro.electricity.demandDeltaAvgGW,
                    buildoutDeltaAvgGW: macro.electricity.buildoutDeltaAvgGW,
                    assumptions: macro.electricity.assumptions,
                  }}
                />
              )}

              {activeCard === "elec-mix" && (
                <ElectricityMixCard
                  observedMix={observedElectricity}
                  techEquivalents={macro.electricity.equivalents}
                  baselineMultipliers={baselineMultipliers}
                  mixMode={mixMode}
                  onMixModeChange={setMixMode}
                  mixBuildout={mixBuildout}
                  mix={mix}
                  onMixChange={setMix}
                  mixPresets={MIX_PRESETS}
                  horizonYears={horizonYears}
                />
              )}

              {activeCard === "elec-assumptions" && (
                <ElectricityAssumptionsCard
                  assumptions={assumptions}
                  onAssumptionsChange={setAssumptions}
                  onReset={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
                />
              )}

              {activeCard === "urban" && (
                <UrbanizationCard
                  data={{
                    currentPersons: macro.urban.currentPersons,
                    futurePersons: macro.urban.futurePersons,
                    deltaPersons: macro.urban.deltaPersons,
                    homesNeeded: macro.urban.homesNeeded,
                    householdSize: assumptions.householdSize,
                    yearsToProject: horizonYears,
                  }}
                />
              )}

              {activeCard === "co2" && (
                <Co2EmissionsCard
                  data={{
                    currentMt: macro.co2.currentMt,
                    futureMt: macro.co2.futureMt,
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="px-5 py-3 border-t border-surface bg-surface-sunken">
        <p className="text-xs text-ink-faint text-center">
          Estimates are illustrative "what-if" projections, not forecasts
        </p>
      </div>
    </SlideOver>
  );
}
