import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { formatPercent } from "../lib/convergence";

const RATE_RANGE = {
  min: -0.05,
  maxChaser: 0.12,
  maxTarget: 0.08,
  step: 0.001,
} as const;

const COLOR_CLASSES = {
  chaser: { text: "text-chaser", dot: "bg-chaser", slider: "slider-chaser" },
  target: { text: "text-target", dot: "bg-target", slider: "slider-target" },
} as const;

type SpeedKey = "shrinking" | "still" | "slow" | "steady" | "fast" | "veryFast" | "rare";

function speedKey(rate: number): SpeedKey {
  if (rate <= -0.0005) return "shrinking";
  if (rate < 0.0005) return "still";
  if (rate < 0.02) return "slow";
  if (rate < 0.035) return "steady";
  if (rate < 0.05) return "fast";
  if (rate < 0.07) return "veryFast";
  return "rare";
}

function RateRow({
  name,
  rate,
  max,
  color,
  onChange,
}: {
  name: string;
  rate: number;
  max: number;
  color: "chaser" | "target";
  onChange: (rate: number) => void;
}) {
  const { t } = useTranslation();
  const key = speedKey(rate);
  const colors = COLOR_CLASSES[color];
  const fill = ((rate - RATE_RANGE.min) / (max - RATE_RANGE.min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`flex items-center gap-2 min-w-0 text-sm font-medium ${colors.text}`}>
          <span className={`size-2 shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
          <span className="truncate">{name}</span>
        </span>
        <span className="flex items-baseline gap-1.5 shrink-0">
          <span
            key={key}
            className={[
              "animate-swap text-[11px] font-medium",
              key === "shrinking" || key === "rare"
                ? "text-amber-700 dark:text-amber-300"
                : "text-ink-faint",
            ].join(" ")}
          >
            {t(`sidebar.speed.${key}`)}
          </span>
          <span className={`text-base font-display font-bold tabular-nums ${colors.text}`}>
            {formatPercent(rate)}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={RATE_RANGE.min}
        max={max}
        step={RATE_RANGE.step}
        value={rate}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={t("sidebar.growthRateLabel", { name })}
        aria-valuetext={`${formatPercent(rate)} ${t("sidebar.perYear")}, ${t(`sidebar.speed.${key}`)}`}
        className={`w-full ${colors.slider}`}
        style={{ "--fill": `${fill}%` } as CSSProperties}
      />
    </div>
  );
}

export function GrowthSpeedCard({
  chaserName,
  targetName,
  chaserRate,
  targetRate,
  onChaserRateChange,
  onTargetRateChange,
}: {
  chaserName: string;
  targetName: string;
  chaserRate: number;
  targetRate: number;
  onChaserRateChange: (rate: number) => void;
  onTargetRateChange: (rate: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="card p-4 space-y-4" aria-labelledby="growth-speed-heading">
      <header>
        <h2 id="growth-speed-heading" className="text-sm font-semibold text-ink">
          {t("sidebar.speedHeading")}
        </h2>
        <p className="text-xs text-ink-muted mt-0.5 text-pretty">{t("sidebar.speedHint")}</p>
      </header>

      <RateRow
        name={chaserName}
        rate={chaserRate}
        max={RATE_RANGE.maxChaser}
        color="chaser"
        onChange={onChaserRateChange}
      />
      <RateRow
        name={targetName}
        rate={targetRate}
        max={RATE_RANGE.maxTarget}
        color="target"
        onChange={onTargetRateChange}
      />
    </section>
  );
}
