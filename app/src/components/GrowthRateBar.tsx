import { useEffect, useRef } from "react";
import { formatPercent } from "../lib/convergence";

const RATE_RANGE = {
  min: -0.05,
  maxChaser: 0.12,
  maxTarget: 0.08,
  step: 0.001,
} as const;

const QUICK_PRESETS = [
  { label: "Slow", value: 0.015 },
  { label: "Moderate", value: 0.03 },
  { label: "Fast", value: 0.05 },
  { label: "Rapid", value: 0.07 },
] as const;

export function GrowthRateBar({
  chaserRate,
  targetRate,
  onChaserRateChange,
  onTargetRateChange,
  chaserName,
  targetName,
}: {
  chaserRate: number;
  targetRate: number;
  onChaserRateChange: (rate: number) => void;
  onTargetRateChange: (rate: number) => void;
  chaserName: string;
  targetName: string;
}) {
  const netAdvantage = chaserRate - targetRate;
  const lastDynamicTargetRate = useRef(0.015);

  useEffect(() => {
    if (targetRate !== 0) lastDynamicTargetRate.current = targetRate;
  }, [targetRate]);

  return (
    <div className="card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-chaser truncate">{chaserName}</span>
            <span className="font-semibold text-chaser tabular-nums">
              {formatPercent(chaserRate)}
            </span>
          </div>
          <input
            type="range"
            min={RATE_RANGE.min}
            max={RATE_RANGE.maxChaser}
            step={RATE_RANGE.step}
            value={chaserRate}
            onChange={(e) => onChaserRateChange(parseFloat(e.target.value))}
            className="w-full slider-chaser"
            aria-label={`${chaserName} growth rate`}
          />
          <div className="hidden xl:flex flex-wrap gap-1 mt-1">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={`chaser-${preset.label}`}
                type="button"
                onClick={() => onChaserRateChange(preset.value)}
                className={[
                  "px-2 py-0.5 text-[10px] rounded font-medium transition-default focus-ring",
                  Math.abs(chaserRate - preset.value) < 0.002
                    ? "bg-chaser text-white"
                    : "bg-surface-raised text-chaser hover:bg-surface border border-surface",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-10 bg-surface-subtle" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-target truncate">{targetName}</span>
            <span className="font-semibold text-target tabular-nums">
              {targetRate === 0 ? "Static" : formatPercent(targetRate)}
            </span>
          </div>
          <input
            type="range"
            min={RATE_RANGE.min}
            max={RATE_RANGE.maxTarget}
            step={RATE_RANGE.step}
            value={targetRate}
            onChange={(e) => onTargetRateChange(parseFloat(e.target.value))}
            className="w-full slider-target"
            aria-label={`${targetName} growth rate`}
          />
          <div className="hidden xl:flex flex-wrap gap-1 mt-1">
            {QUICK_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={`target-${preset.label}`}
                type="button"
                onClick={() => onTargetRateChange(preset.value)}
                className={[
                  "px-2 py-0.5 text-[10px] rounded font-medium transition-default focus-ring",
                  Math.abs(targetRate - preset.value) < 0.002 && targetRate !== 0
                    ? "bg-target text-white"
                    : "bg-surface-raised text-target hover:bg-surface border border-surface",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => onTargetRateChange(lastDynamicTargetRate.current || 0.015)}
              aria-pressed={targetRate !== 0}
              className={[
                "px-2.5 py-2 text-[11px] font-medium transition-default focus-ring",
                targetRate !== 0
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              Growing
            </button>
            <button
              type="button"
              onClick={() => onTargetRateChange(0)}
              aria-pressed={targetRate === 0}
              className={[
                "px-2.5 py-2 text-[11px] font-medium transition-default focus-ring",
                targetRate === 0
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              Static
            </button>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-ink-faint">Net</div>
            <div
              className={[
                "text-[11px] font-semibold tabular-nums",
                netAdvantage > 0
                  ? "text-convergence"
                  : netAdvantage < 0
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-ink-faint",
              ].join(" ")}
              aria-label={`Net advantage ${formatPercent(netAdvantage)}`}
            >
              {netAdvantage > 0 ? "+" : ""}
              {formatPercent(netAdvantage)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
