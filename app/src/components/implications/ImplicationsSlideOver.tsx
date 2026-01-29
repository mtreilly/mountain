import { useState } from "react";
import type { TemplateId } from "../../lib/templatePaths";
import type { ScenarioId } from "../../lib/implicationsScenarios";
import type { ImplicationCardType } from "../../lib/shareState";
import { formatMetricValue, formatNumber } from "../../lib/convergence";
import { SlideOver } from "../ui/SlideOver";
import { ImplicationsControls } from "./ImplicationsControls";
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
    popLabel,
    scenarioDef,
    hasAny,
    observedElectricity,
    macro,
    baselineMultipliers,
    mixBuildout,
  } = computed;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Development Implications"
      subtitle={chaserName}
    >
      <div className="p-5 space-y-6">
        {/* Controls Section */}
        <ImplicationsControls
          template={template}
          onTemplateChange={onTemplateChange}
          horizonYears={horizonYears}
          onHorizonYearsChange={onHorizonYearsChange}
          year={year}
          popAssumption={popAssumption}
          onPopAssumptionChange={setPopAssumption}
          popTrendRate={popTrendRate}
          scenario={scenario}
          onScenarioChange={setScenario}
          onAssumptionsChange={setAssumptions}
          scenarioDef={scenarioDef}
        />

        {/* Context Summary */}
        <div className="p-4 rounded-xl border border-surface bg-surface space-y-2">
          <p className="text-sm text-ink">
            <span className="font-medium">{chaserName}</span> GDP/capita path:{" "}
            <span className="font-mono">{formatMetricValue(gdpCurrent, "int$")}</span>
            {" → "}
            <span className="font-mono">{formatMetricValue(gdpFuture, "int$")}</span>
          </p>
          <p className="text-sm text-ink-muted">
            Totals assume {popLabel}
            {popCurrent != null && (
              <>
                {" · "}
                <span className="font-mono">{formatNumber(Math.round(popCurrent))}</span>
                {" → "}
                <span className="font-mono">
                  {popFuture != null ? formatNumber(Math.round(popFuture)) : "—"}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Loading / Error / Empty states */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-ink-muted">
              <div className="w-5 h-5 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <span>Loading implications data...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Could not load implications data ({error})
            </p>
          </div>
        )}

        {!loading && !error && !hasAny && (
          <div className="p-4 rounded-xl border border-surface bg-surface">
            <p className="text-sm text-ink-muted">
              Not enough data for these metrics yet. Import more World Bank series to enable estimates.
            </p>
          </div>
        )}

        {/* Tabs and Content */}
        {!loading && !error && hasAny && (
          <>
            <div className="border-t border-surface -mx-5 px-5 pt-4">
              <ImplicationsTabs activeCard={activeCard} onCardChange={onActiveCardChange} />
            </div>

            <div>
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

        {/* Disclaimer */}
        <p className="text-xs text-ink-faint text-center pt-2 border-t border-surface">
          Estimates vary widely by policy, technology, and economic structure; treat as "what-if" context, not a forecast.
        </p>
      </div>
    </SlideOver>
  );
}
