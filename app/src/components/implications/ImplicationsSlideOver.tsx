import { formatMetricValue, formatNumber } from "../../lib/convergence";
import { IMPLICATION_SCENARIOS, type ScenarioId } from "../../lib/implicationsScenarios";
import type { ImplicationsControlsState, PopulationVariant } from "../../lib/implicationsSnapshot";
import type { ImplicationCardType } from "../../lib/shareState";
import type { TemplateId } from "../../lib/templatePaths";
import { TEMPLATE_PATHS } from "../../lib/templatePaths";
import { SlideOver } from "../ui/SlideOver";
import {
  DEFAULT_ASSUMPTIONS,
  type ImplicationAssumptions,
  useImplicationsComputed,
} from "./useImplicationsComputed";

interface ImplicationsSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  chaserName: string;
  gdpCurrent: number;
  chaserGrowthRate: number;
  horizonYears: number;
  onHorizonYearsChange: (years: number) => void;
  template: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  activeCard: ImplicationCardType;
  onActiveCardChange: (card: ImplicationCardType) => void;
  controls: ImplicationsControlsState;
  onControlsChange: (controls: ImplicationsControlsState) => void;
  computed: ReturnType<typeof useImplicationsComputed>;
  loading: boolean;
  error: string | null;
  templateLabel: string;
}

function formatTWh(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 10 ? `${value.toFixed(0)} TWh` : `${value.toFixed(1)} TWh`;
}

function formatGW(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 10 ? `${value.toFixed(0)} GW` : `${value.toFixed(1)} GW`;
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

function formatCountCompact(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs > 0 && abs < 1) return "<1";
  if (abs >= 1e12) return `${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(abs / 1e3).toFixed(1)}K`;
  return Math.round(abs).toString();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function AssumptionInput(props: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const { label, value, unit, min, max, step, onChange } = props;
  return (
    <label className="block">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(clamp(next, min, max));
          }}
          className="w-full px-2 py-1 rounded-md bg-surface-raised border border-surface text-ink text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <span className="text-[11px] text-ink-faint shrink-0">{unit}</span>
      </div>
    </label>
  );
}

export function ImplicationsSlideOver({
  isOpen,
  onClose,
  chaserName,
  gdpCurrent,
  chaserGrowthRate,
  horizonYears,
  onHorizonYearsChange,
  template,
  onTemplateChange,
  controls,
  onControlsChange,
  computed,
  loading,
  error,
  templateLabel,
}: ImplicationsSlideOverProps) {
  const { assumptions, populationVariant, scenario } = controls;
  const updateAssumptions = (next: ImplicationAssumptions) =>
    onControlsChange({ ...controls, customized: true, assumptions: next });

  const {
    gdpFuture,
    year,
    popCurrent,
    popFuture,
    scenarioDef,
    hasAny,
    observedElectricity,
    macro,
    snapshot,
  } = computed;

  const handleScenarioChange = (id: ScenarioId) => {
    const s = IMPLICATION_SCENARIOS.find((x) => x.id === id);
    onControlsChange({
      ...controls,
      scenario: id,
      customized: false,
      horizonYears: s?.presets?.horizonYears ?? controls.horizonYears,
      assumptions:
        id === "baseline"
          ? DEFAULT_ASSUMPTIONS
          : {
              ...assumptions,
              gridLossPct: s?.presets?.gridLossPct ?? assumptions.gridLossPct,
              netImportsPct: s?.presets?.netImportsPct ?? assumptions.netImportsPct,
            },
    });
  };

  const electricityDelta = macro.electricity.buildoutDeltaTWh;
  const solarCf = clamp(assumptions.solarCf, 0.05, 0.5);
  const windCf = clamp(assumptions.windCf, 0.05, 0.7);
  const nuclearCf = clamp(assumptions.nuclearCf, 0.05, 0.98);
  const panelWatts = clamp(assumptions.panelWatts, 100, 1000);
  const windTurbineMw = clamp(assumptions.windTurbineMw, 0.5, 20);
  const nuclearPlantGw = clamp(assumptions.nuclearPlantGw, 0.3, 2);
  const annualEnergyEquivalents = snapshot?.electricity.annualEnergyEquivalents ?? null;

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
                max={Math.max(1, 2100 - (year - horizonYears))}
                value={horizonYears}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    onHorizonYearsChange(
                      Math.max(1, Math.min(2100 - (year - horizonYears), Math.round(next))),
                    );
                  }
                }}
                className="w-16 px-2 py-1.5 rounded-lg bg-surface border border-surface text-ink font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <span className="text-sm text-ink-muted">years → {year}</span>
            </div>

            <div className="w-px h-6 bg-surface" />

            {/* Template flags with labels */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">Baseline:</span>
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
                    <span className="text-xs">
                      {t.id === "china" ? "China" : t.id === "us" ? "US" : "EU"}-like
                    </span>
                  </button>
                ))}
              </div>
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

          <div className="text-xs text-ink-muted rounded-lg border border-surface bg-surface px-3 py-2">
            Uses growth from the main calculator (
            <span className="font-medium text-ink">{(chaserGrowthRate * 100).toFixed(1)}%/yr</span>
            ), plus the selected baseline path and population assumption.
          </div>

          {/* Population row - always visible */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">Population:</span>
            <div className="flex gap-1">
              {(["medium", "low", "high"] as PopulationVariant[]).map((variant) => (
                <button
                  key={variant}
                  type="button"
                  onClick={() => onControlsChange({ ...controls, populationVariant: variant })}
                  className={[
                    "px-2 py-0.5 rounded text-xs capitalize transition-default",
                    populationVariant === variant
                      ? "bg-surface-raised text-ink font-medium"
                      : "text-ink-muted hover:text-ink",
                  ].join(" ")}
                >
                  UN {variant}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-ink-faint">
              WPP 2024 · low/high are scenarios, not confidence bounds
            </span>
            {scenario !== "baseline" && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="text-xs text-ink-muted">{scenarioDef.blurb}</span>
              </>
            )}
            {controls.customized && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                Custom assumptions
              </span>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-ink-muted">
              <div className="size-5 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <span>Loading data…</span>
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
        {!loading && !error && (!hasAny || !snapshot) && (
          <div className="m-5 p-6 rounded-xl bg-surface border border-surface text-center">
            <p className="text-ink-muted">Not enough data available for these projections.</p>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && hasAny && snapshot && (
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
                    <div className="text-xs text-ink-muted mb-0.5">
                      GDP/capita ({snapshot.gdp.perCapitaCurrent.year})
                    </div>
                    <div className="font-semibold text-ink">
                      {formatMetricValue(gdpCurrent, "int$")}
                    </div>
                    <div className="text-xs text-ink-faint mt-1">Projected ({year})</div>
                    <div className="text-lg font-bold text-[var(--color-accent)]">
                      {formatMetricValue(gdpFuture, "int$")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">
                      Total GDP ({snapshot.gdp.totalCurrent.year})
                    </div>
                    <div className="font-semibold text-ink">
                      {formatDollars(macro.gdpTotalCurrent)}
                    </div>
                    <div className="text-xs text-ink-faint mt-1">Projected ({year})</div>
                    <div className="text-lg font-bold text-[var(--color-accent)]">
                      {formatDollars(macro.gdpTotalFuture)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-muted mb-0.5">
                      Population ({snapshot.population.current.year})
                    </div>
                    <div className="font-semibold text-ink">{formatPeople(popCurrent)}</div>
                    <div className="text-xs text-ink-faint mt-1">
                      UN {populationVariant} ({year})
                    </div>
                    <div className="text-lg font-bold text-ink">{formatPeople(popFuture)}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Electricity Card */}
            <section className="rounded-lg border border-surface bg-surface-raised overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface bg-surface/50 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Electricity</h3>
                <span className="text-xs text-ink-muted">
                  Annual generation at projected income
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-lg border border-surface bg-surface overflow-hidden">
                  {[
                    {
                      label: "End-use demand",
                      value: `${formatTWh(macro.electricity.demandCurrentTWh)} (${snapshot.electricity.endUseDemandCurrentTWh?.year ?? "—"}) → ${formatTWh(macro.electricity.demandFutureTWh)} (${year})`,
                      note: "Electricity consumed after system losses",
                    },
                    {
                      label: "Gross supply required",
                      value: formatTWh(macro.electricity.grossSupplyRequiredFutureTWh),
                      note: `${assumptions.gridLossPct}% grid-loss assumption`,
                    },
                    {
                      label: "Assumed net imports",
                      value: formatTWh(macro.electricity.importsFutureTWh),
                      note: `${assumptions.netImportsPct}% of gross supply`,
                    },
                    {
                      label: "Domestic generation required",
                      value: formatTWh(macro.electricity.requiredDomesticGenerationFutureTWh),
                      note: `Scenario for ${year}`,
                    },
                    {
                      label: "Observed domestic generation",
                      value: formatTWh(
                        snapshot.electricity.domesticGenerationObservedCurrentTWh?.value ?? null,
                      ),
                      note: `${snapshot.electricity.domesticGenerationObservedCurrentTWh?.year ?? "year unavailable"}`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4 px-3 py-2 border-b border-surface-sunken last:border-b-0"
                    >
                      <div>
                        <div className="text-xs font-medium text-ink">{item.label}</div>
                        <div className="text-[11px] text-ink-faint">{item.note}</div>
                      </div>
                      <div className="text-sm font-semibold text-ink text-right">{item.value}</div>
                    </div>
                  ))}
                </div>

                {electricityDelta != null && (
                  <div className="p-3 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-ink-muted">New domestic generation</div>
                      <div className="text-xl font-bold text-ink">
                        {formatTWh(electricityDelta)}
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        Above observed{" "}
                        {snapshot.electricity.domesticGenerationObservedCurrentTWh?.year ??
                          "baseline"}{" "}
                        generation
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-ink-muted">Average output</div>
                      <div className="font-semibold text-ink">
                        {formatGW(macro.electricity.buildoutDeltaAvgGW)} average
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-surface bg-surface px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink">Equivalent assumptions</span>
                    <span className="text-[11px] text-ink-faint">Editable</span>
                  </div>
                  <div className="text-[11px] text-ink-faint">
                    Capacity factor means average annual output as a percent of max rated output.
                    Unit size means rated capacity per panel, turbine, or nuclear plant.
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <AssumptionInput
                      label="Grid losses"
                      value={assumptions.gridLossPct}
                      unit="%"
                      min={0}
                      max={50}
                      step={1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, gridLossPct: value })
                      }
                    />
                    <AssumptionInput
                      label="Net imports (gross supply share)"
                      value={assumptions.netImportsPct}
                      unit="%"
                      min={-50}
                      max={50}
                      step={1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, netImportsPct: value })
                      }
                    />
                    <AssumptionInput
                      label="Panel size"
                      value={assumptions.panelWatts}
                      unit="W"
                      min={100}
                      max={1000}
                      step={10}
                      onChange={(value) => updateAssumptions({ ...assumptions, panelWatts: value })}
                    />
                    <AssumptionInput
                      label="Solar capacity factor"
                      value={assumptions.solarCf * 100}
                      unit="%"
                      min={5}
                      max={50}
                      step={1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, solarCf: value / 100 })
                      }
                    />
                    <AssumptionInput
                      label="Wind turbine size"
                      value={assumptions.windTurbineMw}
                      unit="MW"
                      min={0.5}
                      max={20}
                      step={0.1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, windTurbineMw: value })
                      }
                    />
                    <AssumptionInput
                      label="Wind capacity factor"
                      value={assumptions.windCf * 100}
                      unit="%"
                      min={5}
                      max={70}
                      step={1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, windCf: value / 100 })
                      }
                    />
                    <AssumptionInput
                      label="Nuclear plant size"
                      value={assumptions.nuclearPlantGw}
                      unit="GW"
                      min={0.3}
                      max={2}
                      step={0.1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, nuclearPlantGw: value })
                      }
                    />
                    <AssumptionInput
                      label="Nuclear capacity factor"
                      value={assumptions.nuclearCf * 100}
                      unit="%"
                      min={5}
                      max={98}
                      step={1}
                      onChange={(value) =>
                        updateAssumptions({ ...assumptions, nuclearCf: value / 100 })
                      }
                    />
                  </div>
                  <div className="text-[11px] text-ink-faint border-t border-surface-sunken pt-2">
                    Positive net imports reduce domestic generation; negative values represent net
                    exports. All technology comparisons below use the same annual buildout value.
                  </div>
                </div>

                <div className="rounded-lg border border-surface bg-surface px-3 py-2 space-y-2">
                  <div className="text-xs font-medium text-ink">
                    Annual-energy equivalents for the same buildout
                  </div>
                  <div className="text-[11px] text-ink-faint">
                    Each row produces the same {formatTWh(electricityDelta)} of additional annual
                    domestic generation. These are comparisons, not a system plan.
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    Shared buildout used for every row: {formatTWh(electricityDelta)}
                  </div>
                  {(electricityDelta ?? 0) <= 0 ? (
                    <div className="rounded-md border border-surface-sunken bg-surface-raised px-3 py-2 text-[11px] text-ink-muted">
                      Projected demand does not exceed current demand in this scenario, so no
                      additional annual generation is required in this scenario.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-md border border-surface-sunken bg-surface-raised px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-ink">
                            Solar annual-energy equivalent
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            {panelWatts.toFixed(0)}W panels at {(solarCf * 100).toFixed(0)}%
                            capacity factor
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-ink-faint">
                            {formatGW(annualEnergyEquivalents?.solar.installedGW ?? null)} installed
                          </div>
                          <div className="text-sm font-semibold text-ink">
                            {formatCountCompact(
                              annualEnergyEquivalents?.solar.referenceUnits ?? null,
                            )}{" "}
                            panels
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-surface-sunken bg-surface-raised px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-ink">
                            Wind annual-energy equivalent
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            {windTurbineMw.toFixed(1)}MW turbines at {(windCf * 100).toFixed(0)}%
                            capacity factor
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-ink-faint">
                            {formatGW(annualEnergyEquivalents?.wind.installedGW ?? null)} installed
                          </div>
                          <div className="text-sm font-semibold text-ink">
                            {formatCountCompact(
                              annualEnergyEquivalents?.wind.referenceUnits ?? null,
                            )}{" "}
                            turbines
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-surface-sunken bg-surface-raised px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-ink">
                            Nuclear annual-energy equivalent
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            {nuclearPlantGw.toFixed(1)}GW plants at {(nuclearCf * 100).toFixed(0)}%
                            capacity factor
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] text-ink-faint">
                            {formatGW(annualEnergyEquivalents?.nuclear.installedGW ?? null)}{" "}
                            installed
                          </div>
                          <div className="text-sm font-semibold text-ink">
                            {formatCountCompact(
                              annualEnergyEquivalents?.nuclear.referenceUnits ?? null,
                            )}{" "}
                            reference units
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {observedElectricity && (
                  <div className="flex items-center gap-3 pt-2 border-t border-surface">
                    <span className="text-xs text-ink-muted">
                      Current mix ({observedElectricity.year})
                    </span>
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

            <details className="rounded-lg border border-surface bg-surface-raised px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink">
                Sources and assumptions
              </summary>
              <div className="mt-2 space-y-1 text-[11px] text-ink-muted">
                {snapshot.provenance.map((source) => (
                  <div key={`${source.indicator}:${source.observedYear}:${source.source}`}>
                    {source.indicator}: {source.source}
                    {source.observedYear != null ? ` (${source.observedYear})` : ""}
                    {source.sourceVintage ? ` · ${source.sourceVintage}` : ""}
                  </div>
                ))}
                <div>
                  Template: {templateLabel} · UN {populationVariant} population ·{" "}
                  {assumptions.gridLossPct}% losses · {assumptions.netImportsPct}% net imports
                </div>
              </div>
            </details>

            {/* Disclaimer */}
            <p className="text-xs text-ink-muted text-center pt-2">
              Illustrative scenario, not a forecast or complete power-system plan. Peak demand,
              storage, reliability, reserves, networks, curtailment, and construction constraints
              are outside this annual-energy comparison.
            </p>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
