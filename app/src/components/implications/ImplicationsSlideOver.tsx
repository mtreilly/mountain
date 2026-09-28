import { useTranslation } from "react-i18next";
import { formatMetricValue, formatNumber } from "../../lib/convergence";
import { IMPLICATION_SCENARIOS, type ScenarioId } from "../../lib/implicationsScenarios";
import type {
  ImplicationsControlsState,
  ImplicationsSnapshot,
  PopulationVariant,
} from "../../lib/implicationsSnapshot";
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

type ComputedImplications = ReturnType<typeof useImplicationsComputed>;

const FERNANDEZ_VILLAVERDE_LECTURE = "https://www.youtube.com/watch?v=QziqIoKS-uA";
const FERNANDEZ_VILLAVERDE_RESEARCH = "https://www.sas.upenn.edu/~jesusfv/research.html";

const PATH_LABEL_KEYS: Record<TemplateId, string> = {
  china: "implications.pathChina",
  us: "implications.pathUs",
  eu: "implications.pathEu",
};

// Mid-sentence names ("in the US")
const PATH_SENTENCE_KEYS: Record<TemplateId, string> = {
  china: "implications.pathChinaInSentence",
  us: "implications.pathUsInSentence",
  eu: "implications.pathEuInSentence",
};

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={[
              "pressable focus-ring rounded-lg px-3 py-1.5 text-sm font-medium",
              option.value === value
                ? "bg-[var(--color-accent)] text-white"
                : "bg-surface text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Stat(props: { label: string; from: string; to: string; note?: string | null }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2.5">
      <div className="text-xs text-ink-muted">{props.label}</div>
      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm text-ink-muted tabular-nums">{props.from}</span>
        <span className="text-ink-faint" aria-hidden="true">
          →
        </span>
        <span className="text-lg font-display font-bold text-ink tabular-nums">{props.to}</span>
      </div>
      {props.note && <div className="text-[11px] text-ink-faint mt-0.5">{props.note}</div>}
    </div>
  );
}

function PowerToBuild(props: {
  snapshot: ImplicationsSnapshot;
  chaserName: string;
  coalShare: number | null;
}) {
  const { t } = useTranslation();
  const { snapshot, chaserName, coalShare } = props;
  const e = snapshot.electricity;
  const today = e.domesticGenerationObservedCurrentTWh;
  const future = e.domesticGenerationRequiredFutureTWh?.value ?? null;
  const gap = e.domesticGenerationGapTWh?.value ?? null;
  const year = snapshot.horizon.targetYear;
  const a = snapshot.assumptions.assumptions;
  const eq = e.annualEnergyEquivalents;

  if (gap == null || today == null || future == null) return null;

  const rows = eq
    ? ([
        ["nuclear", eq.nuclear.referenceUnits, `${a.nuclearPlantGw} GW`, a.nuclearCf],
        ["wind", eq.wind.referenceUnits, `${a.windTurbineMw} MW`, a.windCf],
        ["solar", eq.solar.referenceUnits, `${a.panelWatts} W`, a.solarCf],
        ["coal", eq.coal.referenceUnits, `${a.coalPlantGw} GW`, a.coalCf],
      ] as const)
    : [];

  return (
    <section className="card p-4 space-y-3" aria-labelledby="power-heading">
      <h3 id="power-heading" className="text-sm font-semibold text-ink">
        {t("implications.powerHeading")}
      </h3>
      {gap > 0 ? (
        <>
          <div>
            <p className="text-2xl font-display font-bold text-ink tabular-nums">
              {t("implications.needsMore", { amount: formatTWh(gap) })}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              {t("implications.needsMoreDetail", {
                country: chaserName,
                today: formatTWh(today.value),
                todayYear: today.year,
                year,
                future: formatTWh(future),
              })}
            </p>
          </div>
          {rows.length > 0 && (
            <div>
              <p className="text-xs text-ink-muted mb-1.5">{t("implications.equivalentsIntro")}</p>
              <ul className="grid grid-cols-2 gap-2">
                {rows.map(([key, count, size, cf]) => (
                  <li key={key} className="rounded-lg bg-surface px-3 py-2">
                    <div className="text-base font-semibold text-ink tabular-nums">
                      {formatCountCompact(count)}{" "}
                      <span className="text-sm font-normal text-ink-muted">
                        {t(`implications.${key}`)}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      {t("implications.unitNote", { size, cf: Math.round(cf * 100) })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div>
          <p className="text-lg font-semibold text-ink">{t("implications.noNewPower")}</p>
          <p className="text-xs text-ink-muted mt-1">
            {t("implications.noNewPowerDetail", {
              year,
              future: formatTWh(future),
              amount: formatTWh(-gap),
              country: chaserName,
              today: formatTWh(today.value),
            })}
          </p>
        </div>
      )}
      {coalShare != null && coalShare >= 5 && (
        <p className="text-[11px] text-ink-faint border-t border-surface pt-2">
          {t("implications.replacementNote", { coal: Math.round(coalShare) })}
        </p>
      )}
    </section>
  );
}

function PathExplainer(props: {
  pathFit: ComputedImplications["pathFit"];
  chaserName: string;
  year: number;
  onTemplateChange: (id: TemplateId) => void;
}) {
  const { t } = useTranslation();
  const { pathFit, chaserName, year, onTemplateChange } = props;
  const selected = pathFit.selected;
  if (!selected || selected.gdpMax == null) return null;
  const path = t(PATH_SENTENCE_KEYS[selected.id]);
  const trendKey =
    selected.elasticity < 0.15
      ? "implications.pathFlat"
      : selected.elasticity < 0.6
        ? "implications.pathSlower"
        : "implications.pathMatch";
  const max = formatMetricValue(selected.gdpMax, "int$");
  return (
    <div className="space-y-1.5 text-xs text-ink-muted">
      <p>{t(trendKey, { path })}</p>
      {!selected.coversCurrent ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
          {t("implications.pathBeyondNow", { country: chaserName, pathSubject: path, max })}{" "}
          {pathFit.alternatives.map((alt, i) => (
            <span key={alt.id}>
              {i > 0 && " · "}
              <button
                type="button"
                onClick={() => onTemplateChange(alt.id)}
                className="focus-ring rounded-sm font-semibold underline underline-offset-2"
              >
                {t(PATH_LABEL_KEYS[alt.id])}
              </button>
            </span>
          ))}
        </p>
      ) : !selected.coversFuture ? (
        <p>
          {t("implications.pathBeyondLater", { country: chaserName, pathSubject: path, max, year })}
        </p>
      ) : null}
    </div>
  );
}

function ElectricityWaterfall(props: { snapshot: ImplicationsSnapshot }) {
  const { snapshot } = props;
  const e = snapshot.electricity;
  const a = snapshot.assumptions.assumptions;
  const rows = [
    [
      "End-use demand",
      `${formatTWh(e.endUseDemandCurrentTWh?.value ?? null)} (${e.endUseDemandCurrentTWh?.year ?? "—"}) → ${formatTWh(e.endUseDemandFutureTWh?.value ?? null)} (${snapshot.horizon.targetYear})`,
      "Electricity consumed after system losses",
    ],
    [
      "Gross supply required",
      formatTWh(e.grossSupplyRequiredFutureTWh?.value ?? null),
      `${a.gridLossPct}% grid losses`,
    ],
    [
      "Assumed net imports",
      formatTWh(e.importsFutureTWh?.value ?? null),
      `${a.netImportsPct}% of gross supply`,
    ],
    [
      "Domestic generation required",
      formatTWh(e.domesticGenerationRequiredFutureTWh?.value ?? null),
      `${snapshot.horizon.targetYear}`,
    ],
    [
      "Observed domestic generation",
      formatTWh(e.domesticGenerationObservedCurrentTWh?.value ?? null),
      `${e.domesticGenerationObservedCurrentTWh?.year ?? "year unavailable"}`,
    ],
  ] as const;
  return (
    <div className="rounded-lg bg-surface divide-y divide-[var(--color-border)]">
      {rows.map(([label, value, note]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-3 py-2">
          <div>
            <div className="text-xs font-medium text-ink">{label}</div>
            <div className="text-[11px] text-ink-faint">{note}</div>
          </div>
          <div className="text-sm font-semibold text-ink text-right tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ElectricityAssumptionsEditor(props: {
  assumptions: ImplicationAssumptions;
  onChange: (assumptions: ImplicationAssumptions) => void;
}) {
  const { assumptions, onChange } = props;
  const fields = [
    ["Grid losses", "gridLossPct", assumptions.gridLossPct, "%", 0, 50, 1, 1],
    [
      "Net imports (gross supply share)",
      "netImportsPct",
      assumptions.netImportsPct,
      "%",
      -50,
      50,
      1,
      1,
    ],
    ["Panel size", "panelWatts", assumptions.panelWatts, "W", 100, 1000, 10, 1],
    ["Solar capacity factor", "solarCf", assumptions.solarCf * 100, "%", 5, 50, 1, 0.01],
    ["Wind turbine size", "windTurbineMw", assumptions.windTurbineMw, "MW", 0.5, 20, 0.1, 1],
    ["Wind capacity factor", "windCf", assumptions.windCf * 100, "%", 5, 70, 1, 0.01],
    ["Nuclear unit size", "nuclearPlantGw", assumptions.nuclearPlantGw, "GW", 0.3, 2, 0.1, 1],
    ["Nuclear capacity factor", "nuclearCf", assumptions.nuclearCf * 100, "%", 5, 98, 1, 0.01],
    ["Coal unit size", "coalPlantGw", assumptions.coalPlantGw, "GW", 0.3, 2, 0.1, 1],
    ["Coal capacity factor", "coalCf", assumptions.coalCf * 100, "%", 5, 95, 1, 0.01],
  ] as const;
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-faint">
        Capacity factor is average output as a share of full output. Positive net imports reduce
        domestic generation; negative values mean net exports.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {fields.map(([label, key, value, unit, min, max, step, scale]) => (
          <AssumptionInput
            key={key}
            label={label}
            value={value}
            unit={unit}
            min={min}
            max={max}
            step={step}
            onChange={(next) => onChange({ ...assumptions, [key]: next * scale })}
          />
        ))}
      </div>
    </div>
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
  const { t } = useTranslation();
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
    pathFit,
    snapshot,
    snapshotUnavailable,
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

  const baseYear = year - horizonYears;
  const maxHorizon = Math.max(1, 2100 - baseYear);
  const demandNow = macro.electricity.demandCurrentTWh;
  const demandThen = macro.electricity.demandFutureTWh;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t("implications.title")}
      subtitle={t("implications.subtitle", { country: chaserName })}
      width="xl"
    >
      <div className="p-4 space-y-3">
        {/* The question, in one sentence */}
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink">
          <span>
            {t("implications.intro", {
              country: chaserName,
              rate: `${(chaserGrowthRate * 100).toFixed(1)}%`,
            })}
          </span>
          <input
            type="number"
            min={1}
            max={maxHorizon}
            value={horizonYears}
            aria-label={t("implications.horizonLabel")}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) {
                onHorizonYearsChange(Math.max(1, Math.min(maxHorizon, Math.round(next))));
              }
            }}
            className="no-spinner w-14 rounded-md bg-surface px-2 py-1 text-center font-semibold text-ink tabular-nums shadow-[inset_0_0_0_1px_var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <span>
            {t("implications.introYears")} {t("implications.introUntil", { year })}
          </span>
        </p>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-ink-muted">
            <div className="size-5 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <span>{t("implications.loading")}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              {t("implications.loadError", { error })}
            </p>
          </div>
        )}

        {!loading && !error && (!hasAny || !snapshot) && (
          <div className="p-6 rounded-xl bg-surface text-center">
            <p className="text-ink-muted">
              {snapshotUnavailable?.message ?? t("implications.noData")}
            </p>
          </div>
        )}

        {!loading && !error && hasAny && snapshot && (
          <div className="stagger-children space-y-3">
            {/* 1. The picture at the horizon */}
            <section className="card p-4 space-y-3" aria-labelledby="picture-heading">
              <h3 id="picture-heading" className="text-sm font-semibold text-ink">
                {t("implications.pictureHeading", { year })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Stat
                  label={t("implications.income")}
                  from={formatMetricValue(gdpCurrent, "int$")}
                  to={formatMetricValue(gdpFuture, "int$")}
                  note={t("implications.timesRicher", {
                    factor: (gdpFuture / gdpCurrent).toFixed(1),
                  })}
                />
                <Stat
                  label={t("implications.people")}
                  from={formatPeople(popCurrent)}
                  to={formatPeople(popFuture)}
                  note={`UN ${populationVariant}`}
                />
                <Stat
                  label={t("implications.electricity")}
                  from={formatTWh(demandNow)}
                  to={formatTWh(demandThen)}
                  note={t("implications.perYear")}
                />
              </div>
            </section>

            {/* 2. What has to be built */}
            <PowerToBuild
              snapshot={snapshot}
              chaserName={chaserName}
              coalShare={observedElectricity?.shares.coal ?? null}
            />

            {/* 3. The two assumptions that move the answer most */}
            <section className="card p-4 space-y-4" aria-labelledby="assumptions-heading">
              <h3 id="assumptions-heading" className="text-sm font-semibold text-ink">
                {t("implications.assumptionsHeading")}
              </h3>
              <div className="space-y-2">
                <Segmented<TemplateId>
                  label={t("implications.pathLabel")}
                  value={template}
                  options={TEMPLATE_PATHS.map((p) => ({
                    value: p.id,
                    label: t(PATH_LABEL_KEYS[p.id]),
                  }))}
                  onChange={onTemplateChange}
                />
                <PathExplainer
                  pathFit={pathFit}
                  chaserName={chaserName}
                  year={year}
                  onTemplateChange={onTemplateChange}
                />
              </div>
              <div className="space-y-2">
                <Segmented<PopulationVariant>
                  label={t("implications.populationLabel")}
                  value={populationVariant}
                  options={[
                    { value: "low", label: t("implications.popLow") },
                    { value: "medium", label: t("implications.popMedium") },
                    { value: "high", label: t("implications.popHigh") },
                  ]}
                  onChange={(variant) =>
                    onControlsChange({ ...controls, populationVariant: variant })
                  }
                />
                <p className="text-xs text-ink-muted">
                  {t("implications.populationSource")} {t("implications.populationCaveat")}{" "}
                  <a
                    href={FERNANDEZ_VILLAVERDE_LECTURE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring rounded-sm text-[var(--color-accent)] underline underline-offset-2"
                  >
                    {t("implications.populationCaveatLink")}
                  </a>{" "}
                  ·{" "}
                  <a
                    href={FERNANDEZ_VILLAVERDE_RESEARCH}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring rounded-sm text-[var(--color-accent)] underline underline-offset-2"
                  >
                    {t("implications.populationResearchLink")}
                  </a>
                </p>
              </div>
            </section>

            {/* 4. Everything else, for people who want to dig in */}
            <details className="card group">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between rounded-[14px] px-4 py-3 text-sm font-semibold text-ink">
                <span>
                  {t("implications.moreHeading")}
                  {controls.customized && (
                    <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                      {t("implications.customAssumptions")}
                    </span>
                  )}
                </span>
                <svg
                  className="size-4 text-ink-faint transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                  />
                </svg>
              </summary>
              <div className="space-y-4 px-4 pb-4">
                <div className="space-y-1.5">
                  <div className="text-xs text-ink-muted">{t("implications.scenarioLabel")}</div>
                  <div className="flex flex-wrap gap-1">
                    {IMPLICATION_SCENARIOS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleScenarioChange(s.id)}
                        aria-pressed={scenario === s.id}
                        className={[
                          "pressable focus-ring rounded-full px-2.5 py-1 text-xs font-medium",
                          scenario === s.id
                            ? "bg-ink text-surface"
                            : "bg-surface text-ink-muted hover:text-ink",
                        ].join(" ")}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-ink-faint">{scenarioDef.blurb}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-ink-muted">{t("implications.supplyHeading")}</div>
                  <ElectricityWaterfall snapshot={snapshot} />
                </div>

                <ElectricityAssumptionsEditor
                  assumptions={assumptions}
                  onChange={updateAssumptions}
                />

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>
                    {t("implications.totalGdp")}: {formatDollars(macro.gdpTotalCurrent)} →{" "}
                    {formatDollars(macro.gdpTotalFuture)}
                  </span>
                  {observedElectricity && (
                    <span>
                      {t("implications.observedMix", { year: observedElectricity.year })}:{" "}
                      {(["coal", "nuclear", "wind", "solar"] as const)
                        .filter((k) => (observedElectricity.shares[k] ?? 0) >= 1)
                        .map((k) => `${k} ${observedElectricity.shares[k]!.toFixed(0)}%`)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            </details>

            <details className="card">
              <summary className="focus-ring cursor-pointer list-none rounded-[14px] px-4 py-3 text-sm font-semibold text-ink">
                {t("implications.sourcesHeading")}
              </summary>
              <div className="space-y-1 px-4 pb-4 text-[11px] text-ink-muted">
                {snapshot.provenance.map((source) => (
                  <div key={`${source.indicator}:${source.observedYear}:${source.source}`}>
                    {source.indicator}: {source.source}
                    {source.observedYear != null ? ` (${source.observedYear})` : ""}
                    {source.sourceVintage ? ` · ${source.sourceVintage}` : ""}
                  </div>
                ))}
                <div>
                  {templateLabel} · UN {populationVariant} · {assumptions.gridLossPct}% losses ·{" "}
                  {assumptions.netImportsPct}% net imports
                </div>
              </div>
            </details>

            <p className="text-center text-xs text-ink-faint">{t("implications.disclaimer")}</p>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
