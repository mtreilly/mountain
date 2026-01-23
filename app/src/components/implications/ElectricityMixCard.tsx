import { formatNumber } from "../../lib/convergence";
import type {
  ObservedElectricity,
  TechEquivalents,
  BaselineMultipliers,
  MixBuildout,
  PowerMixKey,
} from "../../types/implications";

interface ElectricityMixCardProps {
  observedMix: ObservedElectricity | null;
  techEquivalents: TechEquivalents | null;
  baselineMultipliers: BaselineMultipliers | null;
  mixMode: boolean;
  onMixModeChange: (mode: boolean) => void;
  mixBuildout: MixBuildout | null;
  mix: Record<PowerMixKey, number>;
  onMixChange: (mix: Record<PowerMixKey, number>) => void;
  mixPresets: Array<{ id: string; label: string; mix: Record<PowerMixKey, number> }>;
  horizonYears: number;
  onShare?: () => void;
}

function formatTotal(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} TWh`;
}

function formatUnitCount(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (abs < 1) return `${sign}<1`;
  if (abs < 10) return `${sign}${abs.toFixed(1).replace(/\.0$/, "")}`;
  return `${sign}${formatNumber(Math.round(abs))}`;
}

function formatMultiplier(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 0.1) return "<0.1×";
  if (value < 10) return `${value.toFixed(1)}×`;
  if (value < 100) return `${Math.round(value)}×`;
  return `${formatNumber(Math.round(value))}×`;
}

function formatSourceVintage(vintage: string) {
  const v = vintage.trim();
  if (!v) return "—";
  const [kindRaw, suffixRaw] = v.split("@");
  const kind = (kindRaw || "").trim().toLowerCase();
  const suffix = (suffixRaw || "").trim();

  if (kind.includes("ember-electricity-generation"))
    return suffix ? `Ember gen ${suffix}` : "Ember gen";
  if (kind.includes("ember-installed-capacity"))
    return suffix ? `Ember cap ${suffix}` : "Ember cap";
  if (kind.includes("owid-energy-data"))
    return suffix ? `OWID energy ${suffix}` : "OWID energy";
  if (kind.includes("owid-co2-data")) return suffix ? `OWID CO₂ ${suffix}` : "OWID CO₂";

  return v.length > 40 ? `${v.slice(0, 37)}…` : v;
}

function MixField(props: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  const { label, value, color, onChange } = props;
  return (
    <label className="block rounded-lg border border-surface bg-surface px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
          <span className="text-[11px] text-ink truncate">{label}</span>
        </div>
        <input
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.max(0, next));
          }}
          className="w-16 px-2 py-1 rounded-md bg-surface-raised border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-label={`${label} percent`}
        />
        <span className="text-[11px] text-ink-faint">%</span>
      </div>
    </label>
  );
}

function MixResultCard(props: {
  title: string;
  color: string;
  twh: number;
  gw: number;
  perYearTwh: number;
  perYearGw: number;
  equivalentLabel: string;
  equivalentCount: number | null;
  capacityX: number | null;
  generationX: number | null;
  paceBenchmarkTwhPerYear: number | null;
  paceX: number | null;
}) {
  const {
    title,
    color,
    twh,
    gw,
    perYearTwh,
    perYearGw,
    equivalentLabel,
    equivalentCount,
    capacityX,
    generationX,
    paceBenchmarkTwhPerYear,
    paceX,
  } = props;

  return (
    <div className="rounded-lg border border-surface bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
          <div className="text-xs font-medium text-ink truncate">{title}</div>
        </div>
        <div className="text-[11px] text-ink-faint shrink-0">
          {formatTotal(twh)} · {formatUnitCount(gw)} GW
        </div>
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Rate: {formatTotal(perYearTwh)}/yr · {formatUnitCount(perYearGw)} GW/yr
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Equivalent:{" "}
        <span className="font-medium text-ink">
          {equivalentCount != null ? formatUnitCount(equivalentCount) : "—"}
        </span>{" "}
        {equivalentLabel}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        vs today: capacity {formatMultiplier(capacityX)} · generation{" "}
        {formatMultiplier(generationX)}
      </div>
      {(paceBenchmarkTwhPerYear != null || paceX != null) && (
        <div className="mt-1 text-[11px] text-ink-faint">
          Pace: {formatTotal(perYearTwh)}/yr vs best 5y avg{" "}
          {paceBenchmarkTwhPerYear != null ? formatTotal(paceBenchmarkTwhPerYear) : "—"}/yr (
          {formatMultiplier(paceX)})
        </div>
      )}
    </div>
  );
}

export function ElectricityMixCard({
  observedMix,
  techEquivalents,
  baselineMultipliers,
  mixMode,
  onMixModeChange,
  mixBuildout,
  mix,
  onMixChange,
  mixPresets,
  horizonYears,
  onShare,
}: ElectricityMixCardProps) {
  return (
    <div
      role="tabpanel"
      id="elec-mix-panel"
      aria-labelledby="elec-mix-tab"
      className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium text-ink">Electricity mix</div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
            aria-label="Share electricity mix card"
          >
            Share
          </button>
        )}
      </div>

      {observedMix && (
        <div className="mt-1 text-[11px] text-ink-faint">
          Observed generation mix{" "}
          <span className="font-medium text-ink">
            {formatTotal(observedMix.totalTWh)}
          </span>{" "}
          ({observedMix.year}
          {observedMix.totalSourceVintage
            ? ` · ${formatSourceVintage(observedMix.totalSourceVintage)}`
            : ""})
          · Solar{" "}
          {observedMix.shares.solar != null
            ? `${observedMix.shares.solar.toFixed(0)}%`
            : "—"}{" "}
          · Wind{" "}
          {observedMix.shares.wind != null
            ? `${observedMix.shares.wind.toFixed(0)}%`
            : "—"}{" "}
          · Coal{" "}
          {observedMix.shares.coal != null
            ? `${observedMix.shares.coal.toFixed(0)}%`
            : "—"}{" "}
          · Nuclear{" "}
          {observedMix.shares.nuclear != null
            ? `${observedMix.shares.nuclear.toFixed(0)}%`
            : "—"}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => onMixModeChange(false)}
            aria-pressed={!mixMode}
            className={[
              "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
              !mixMode
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-raised/60",
            ].join(" ")}
          >
            Compare
          </button>
          <button
            type="button"
            onClick={() => onMixModeChange(true)}
            aria-pressed={mixMode}
            disabled={!mixBuildout}
            className={[
              "px-2.5 py-1 text-xs font-medium transition-default focus-ring disabled:opacity-50",
              mixMode
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-raised/60",
            ].join(" ")}
          >
            Mix
          </button>
        </div>
      </div>

      {!mixMode && baselineMultipliers && (
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Buildout vs today (
          {baselineMultipliers.kind === "reported"
            ? "reported installed GW (IRENA/Ember solar+wind; inferred otherwise)"
            : "estimated GW from TWh & CF"}
          , {baselineMultipliers.year}): Solar{" "}
          {baselineMultipliers.ratio.solar != null
            ? `${baselineMultipliers.ratio.solar.toFixed(1)}×`
            : "—"}{" "}
          · Wind{" "}
          {baselineMultipliers.ratio.wind != null
            ? `${baselineMultipliers.ratio.wind.toFixed(1)}×`
            : "—"}{" "}
          · Coal{" "}
          {baselineMultipliers.ratio.coal != null
            ? `${baselineMultipliers.ratio.coal.toFixed(1)}×`
            : "—"}{" "}
          · Nuclear{" "}
          {baselineMultipliers.ratio.nuclear != null
            ? `${baselineMultipliers.ratio.nuclear.toFixed(1)}×`
            : "—"}
        </div>
      )}

      {techEquivalents && !mixMode && (
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-1 text-[11px] text-ink-faint">
          <div>
            Nuclear:{" "}
            <span className="font-medium text-ink">
              {formatUnitCount(techEquivalents.nuclear.plants)}
            </span>{" "}
            1-GW plants ({formatUnitCount(techEquivalents.nuclear.plants / horizonYears)}
            /yr)
          </div>
          <div>
            Coal:{" "}
            <span className="font-medium text-ink">
              {formatUnitCount(techEquivalents.coal.plants)}
            </span>{" "}
            1-GW plants ({formatUnitCount(techEquivalents.coal.plants / horizonYears)}/yr)
          </div>
          <div>
            Solar:{" "}
            <span className="font-medium text-ink">
              {formatUnitCount(techEquivalents.solar.gw)}
            </span>{" "}
            GW ({formatUnitCount(techEquivalents.solar.gw / horizonYears)} GW/yr)
            {techEquivalents.solar.panels != null && (
              <>
                {" "}
                (
                <span className="font-medium text-ink">
                  {formatUnitCount(techEquivalents.solar.panels)}
                </span>{" "}
                panels)
              </>
            )}
          </div>
          <div>
            Wind:{" "}
            <span className="font-medium text-ink">
              {formatUnitCount(techEquivalents.wind.gw)}
            </span>{" "}
            GW ({formatUnitCount(techEquivalents.wind.gw / horizonYears)} GW/yr)
            {techEquivalents.wind.turbines != null && (
              <>
                {" "}
                (
                <span className="font-medium text-ink">
                  {formatUnitCount(techEquivalents.wind.turbines)}
                </span>{" "}
                turbines)
              </>
            )}
          </div>
        </div>
      )}

      {mixMode && mixBuildout && (
        <div className="mt-2">
          <div className="h-2 rounded-full overflow-hidden bg-surface flex">
            <div
              className="bg-amber-400"
              style={{ width: `${mixBuildout.percent.solar}%` }}
              aria-label={`Solar ${mixBuildout.percent.solar}%`}
            />
            <div
              className="bg-sky-400"
              style={{ width: `${mixBuildout.percent.wind}%` }}
              aria-label={`Wind ${mixBuildout.percent.wind}%`}
            />
            <div
              className="bg-violet-400"
              style={{ width: `${mixBuildout.percent.nuclear}%` }}
              aria-label={`Nuclear ${mixBuildout.percent.nuclear}%`}
            />
            <div
              className="bg-slate-400"
              style={{ width: `${mixBuildout.percent.coal}%` }}
              aria-label={`Coal ${mixBuildout.percent.coal}%`}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MixField
              label="Solar"
              value={mix.solar}
              color="bg-amber-400"
              onChange={(v) => onMixChange({ ...mix, solar: v })}
            />
            <MixField
              label="Wind"
              value={mix.wind}
              color="bg-sky-400"
              onChange={(v) => onMixChange({ ...mix, wind: v })}
            />
            <MixField
              label="Nuclear"
              value={mix.nuclear}
              color="bg-violet-400"
              onChange={(v) => onMixChange({ ...mix, nuclear: v })}
            />
            <MixField
              label="Coal"
              value={mix.coal}
              color="bg-slate-400"
              onChange={(v) => onMixChange({ ...mix, coal: v })}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {mixPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onMixChange(p.mix)}
                className="px-2 py-1 rounded-md border border-surface bg-surface text-[11px] text-ink-muted hover:text-ink hover:bg-surface-raised transition-default focus-ring"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-2 text-[11px] text-ink-faint">
            Baseline:{" "}
            {mixBuildout.baselineKind === "reported"
              ? "reported installed GW (IRENA/Ember solar+wind; inferred otherwise)"
              : "estimated from observed generation + CF"}
            {" · "}
            Mix is normalized from inputs (sum {mixBuildout.sum.toFixed(0)}).
          </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <MixResultCard
              title="Solar"
              color="bg-amber-400"
              twh={mixBuildout.tech.solar.twh}
              gw={mixBuildout.tech.solar.gw}
              perYearGw={mixBuildout.tech.solar.perYear.gw}
              perYearTwh={mixBuildout.tech.solar.perYear.twh}
              equivalentLabel="panels"
              equivalentCount={mixBuildout.tech.solar.equivalents.panels}
              capacityX={mixBuildout.tech.solar.multiplier.capacityX}
              generationX={mixBuildout.tech.solar.multiplier.generationX}
              paceX={mixBuildout.tech.solar.pace.paceX}
              paceBenchmarkTwhPerYear={mixBuildout.tech.solar.pace.max5yTwhPerYear}
            />
            <MixResultCard
              title="Wind"
              color="bg-sky-400"
              twh={mixBuildout.tech.wind.twh}
              gw={mixBuildout.tech.wind.gw}
              perYearGw={mixBuildout.tech.wind.perYear.gw}
              perYearTwh={mixBuildout.tech.wind.perYear.twh}
              equivalentLabel="turbines"
              equivalentCount={mixBuildout.tech.wind.equivalents.turbines}
              capacityX={mixBuildout.tech.wind.multiplier.capacityX}
              generationX={mixBuildout.tech.wind.multiplier.generationX}
              paceX={mixBuildout.tech.wind.pace.paceX}
              paceBenchmarkTwhPerYear={mixBuildout.tech.wind.pace.max5yTwhPerYear}
            />
            <MixResultCard
              title="Nuclear"
              color="bg-violet-400"
              twh={mixBuildout.tech.nuclear.twh}
              gw={mixBuildout.tech.nuclear.gw}
              perYearGw={mixBuildout.tech.nuclear.perYear.gw}
              perYearTwh={mixBuildout.tech.nuclear.perYear.twh}
              equivalentLabel="1‑GW plants"
              equivalentCount={mixBuildout.tech.nuclear.equivalents.plants}
              capacityX={mixBuildout.tech.nuclear.multiplier.capacityX}
              generationX={mixBuildout.tech.nuclear.multiplier.generationX}
              paceX={mixBuildout.tech.nuclear.pace.paceX}
              paceBenchmarkTwhPerYear={mixBuildout.tech.nuclear.pace.max5yTwhPerYear}
            />
            <MixResultCard
              title="Coal"
              color="bg-slate-400"
              twh={mixBuildout.tech.coal.twh}
              gw={mixBuildout.tech.coal.gw}
              perYearGw={mixBuildout.tech.coal.perYear.gw}
              perYearTwh={mixBuildout.tech.coal.perYear.twh}
              equivalentLabel="1‑GW plants"
              equivalentCount={mixBuildout.tech.coal.equivalents.plants}
              capacityX={mixBuildout.tech.coal.multiplier.capacityX}
              generationX={mixBuildout.tech.coal.multiplier.generationX}
              paceX={mixBuildout.tech.coal.pace.paceX}
              paceBenchmarkTwhPerYear={mixBuildout.tech.coal.pace.max5yTwhPerYear}
            />
          </div>
        </div>
      )}
    </div>
  );
}
