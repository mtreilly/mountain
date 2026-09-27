import { useId } from "react";
import { useTranslation } from "react-i18next";
import { calculateRequiredChaserGrowthRate, formatPercent } from "../lib/convergence";
import { benchmarkGrowthRate } from "../lib/growthBenchmarks";

const YEARS_STEP = 5;
const YEARS_MIN = 1;
const YEARS_MAX = 150;

function clampYears(years: number) {
  return Math.max(YEARS_MIN, Math.min(YEARS_MAX, Math.round(years)));
}

export function GrowthCalculator({
  chaserName,
  chaserValue,
  targetValue,
  chaserGrowthRate,
  targetGrowthRate,
  years,
  onYearsChange,
}: {
  chaserName: string;
  chaserValue: number;
  targetValue: number;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  years: number;
  onYearsChange: (years: number) => void;
}) {
  const { t } = useTranslation();
  const yearsInputId = useId();

  // Nothing to catch up on when the chaser is already ahead; the speed card says so.
  if (chaserValue >= targetValue) return null;

  const required = calculateRequiredChaserGrowthRate({
    chaserValue,
    targetValue,
    targetGrowthRate,
    years,
  });
  if (required == null) return null;

  const bench = benchmarkGrowthRate(required);
  const onTrack = chaserGrowthRate >= required;
  const note =
    bench.tone === "unprecedented"
      ? t("sidebar.unprecedented")
      : bench.tone === "ambitious"
        ? t("sidebar.ambitious")
        : onTrack
          ? t("sidebar.onTrack", { rate: formatPercent(chaserGrowthRate) })
          : t("sidebar.shortfall", { rate: formatPercent(chaserGrowthRate) });
  const noteTone =
    bench.tone === "unprecedented"
      ? "text-rose-700 dark:text-rose-300"
      : bench.tone === "ambitious" || !onTrack
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";

  const stepperButton =
    "pressable focus-ring grid size-8 place-items-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-40";

  return (
    <section className="card p-4 space-y-3" aria-labelledby="deadline-heading">
      <header>
        <h2 id="deadline-heading" className="text-sm font-semibold text-ink">
          {t("sidebar.deadlineHeading")}
        </h2>
        <p className="text-xs text-ink-muted mt-0.5">{t("sidebar.deadlineHint")}</p>
      </header>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor={yearsInputId} className="text-sm text-ink-muted">
          {t("sidebar.within")}
        </label>
        <div className="flex items-center gap-0.5 rounded-lg bg-surface p-0.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <button
            type="button"
            onClick={() => onYearsChange(clampYears(years - YEARS_STEP))}
            disabled={years <= YEARS_MIN}
            aria-label={t("sidebar.fewerYears")}
            className={stepperButton}
          >
            <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.5 8h9" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
            </svg>
          </button>
          <input
            id={yearsInputId}
            type="number"
            inputMode="numeric"
            min={YEARS_MIN}
            max={YEARS_MAX}
            step={1}
            value={years}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onYearsChange(clampYears(next));
            }}
            className="no-spinner w-10 bg-transparent text-center text-sm font-semibold text-ink tabular-nums focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onYearsChange(clampYears(years + YEARS_STEP))}
            disabled={years >= YEARS_MAX}
            aria-label={t("sidebar.moreYears")}
            className={stepperButton}
          >
            <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 3.5v9M3.5 8h9"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="pr-2 pl-0.5 text-xs text-ink-faint">{t("sidebar.years")}</span>
        </div>
      </div>

      <div className="rounded-lg bg-surface px-3 py-2.5" aria-live="polite">
        <p className="text-xs text-ink-muted">{t("sidebar.needs", { chaser: chaserName })}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-display font-bold text-chaser tabular-nums">
            {formatPercent(required)}
          </span>
          <span className="text-sm text-ink-muted">{t("sidebar.perYear")}</span>
        </p>
        <p key={noteTone} className={`animate-swap mt-1 text-xs ${noteTone}`}>
          {note}
        </p>
      </div>
    </section>
  );
}
