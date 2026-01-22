import { formatPercent } from "../lib/convergence";
import { useEffect, useRef } from "react";

interface GrowthRateControlsProps {
  chaserRate: number;
  targetRate: number;
  onChaserRateChange: (rate: number) => void;
  onTargetRateChange: (rate: number) => void;
  chaserName: string;
  targetName: string;
  compact?: boolean;
}

const PRESETS = [
  { label: "Stagnant", value: 0.005 },
  { label: "Slow", value: 0.015 },
  { label: "Moderate", value: 0.03 },
  { label: "Fast", value: 0.05 },
  { label: "Rapid", value: 0.07 },
];

const RATE_RANGE = {
  min: -0.05,
  maxChaser: 0.12,
  maxTarget: 0.08,
  step: 0.001,
} as const;

export function GrowthRateControls({
  chaserRate,
  targetRate,
  onChaserRateChange,
  onTargetRateChange,
  chaserName,
  targetName,
  compact = false,
}: GrowthRateControlsProps) {
  const netAdvantage = chaserRate - targetRate;
  const lastDynamicTargetRate = useRef(0.015);

  useEffect(() => {
    if (targetRate !== 0) lastDynamicTargetRate.current = targetRate;
  }, [targetRate]);

  // Compact sidebar layout for desktop
  if (compact) {
    return (
      <div className="card p-3 space-y-3">
        <div className="text-center">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Growth Rates
          </h3>
        </div>

        {/* Chaser */}
        <div className="rounded-lg border border-chaser bg-chaser-light p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-chaser truncate max-w-[120px]">{chaserName}</span>
            <span className="text-sm font-display font-bold text-chaser tabular-nums">
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
          />
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <button
                key={`chaser-${preset.label}`}
                type="button"
                onClick={() => onChaserRateChange(preset.value)}
                className={[
                  "px-2 py-1 text-[10px] rounded font-medium transition-default",
                  Math.abs(chaserRate - preset.value) < 0.002
                    ? "bg-chaser text-white"
                    : "bg-surface-raised text-chaser hover:bg-surface",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target */}
        <div className="rounded-lg border border-target bg-target-light p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-target truncate max-w-[120px]">{targetName}</span>
            <span className="text-sm font-display font-bold text-target tabular-nums">
              {targetRate === 0 ? "Static" : formatPercent(targetRate)}
            </span>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onTargetRateChange(lastDynamicTargetRate.current || 0.015)}
              className={[
                "flex-1 px-2 py-1.5 text-[10px] rounded border font-medium transition-default",
                targetRate === 0
                  ? "border-surface bg-surface-raised text-ink-muted"
                  : "border-target bg-target text-white",
              ].join(" ")}
            >
              Growing
            </button>
            <button
              type="button"
              onClick={() => onTargetRateChange(0)}
              className={[
                "flex-1 px-2 py-1.5 text-[10px] rounded border font-medium transition-default",
                targetRate === 0
                  ? "border-target bg-target text-white"
                  : "border-surface bg-surface-raised text-ink-muted",
              ].join(" ")}
            >
              Static
            </button>
          </div>

          <input
            type="range"
            min={RATE_RANGE.min}
            max={RATE_RANGE.maxTarget}
            step={RATE_RANGE.step}
            value={targetRate}
            onChange={(e) => onTargetRateChange(parseFloat(e.target.value))}
            className="w-full slider-target"
          />

          <div className="flex flex-wrap gap-1">
            {PRESETS.slice(0, 4).map((preset) => (
              <button
                key={`target-${preset.label}`}
                type="button"
                onClick={() => onTargetRateChange(preset.value)}
                className={[
                  "px-2 py-1 text-[10px] rounded font-medium transition-default",
                  Math.abs(targetRate - preset.value) < 0.002 && targetRate !== 0
                    ? "bg-target text-white"
                    : "bg-surface-raised text-target hover:bg-surface",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Net advantage */}
        <div className="pt-3 border-t border-surface-subtle">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-muted">Net advantage</span>
            <span
              className={[
                "font-display font-semibold tabular-nums",
                netAdvantage > 0
                  ? "text-convergence"
                  : netAdvantage < 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-ink-faint",
              ].join(" ")}
            >
              {netAdvantage > 0 ? "+" : ""}
              {formatPercent(netAdvantage)}
            </span>
          </div>
          {netAdvantage <= 0 && (
            <p className="text-[10px] text-ink-faint mt-1">No convergence at these rates</p>
          )}
        </div>
      </div>
    );
  }

  // Full layout for mobile/tablet
  return (
    <div className="card p-4 sm:p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
          Growth Rate Assumptions
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Chaser growth rate */}
        <div className="rounded-xl border border-chaser bg-chaser-light p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-chaser truncate">{chaserName}</label>
            <span className="text-lg font-display font-bold text-chaser tabular-nums">
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
          />

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={`chaser-${preset.label}`}
                type="button"
                onClick={() => onChaserRateChange(preset.value)}
                className={[
                  "px-2.5 py-1.5 text-xs rounded-lg font-medium transition-default",
                  Math.abs(chaserRate - preset.value) < 0.002
                    ? "bg-chaser text-white shadow-sm"
                    : "bg-surface-raised text-chaser hover:bg-surface border border-transparent hover:border-chaser",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target growth rate */}
        <div className="rounded-xl border border-target bg-target-light p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-target truncate">{targetName}</label>
            <span className="text-lg font-display font-bold text-target tabular-nums">
              {targetRate === 0 ? "Static" : formatPercent(targetRate)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onTargetRateChange(lastDynamicTargetRate.current || 0.015)}
              className={[
                "flex-1 px-3 py-1.5 text-xs rounded-lg border font-medium transition-default",
                targetRate === 0
                  ? "border-surface bg-surface-raised text-ink-muted hover:bg-surface hover:text-ink"
                  : "border-target bg-target text-white",
              ].join(" ")}
            >
              Growing
            </button>
            <button
              type="button"
              onClick={() => onTargetRateChange(0)}
              className={[
                "flex-1 px-3 py-1.5 text-xs rounded-lg border font-medium transition-default",
                targetRate === 0
                  ? "border-target bg-target text-white"
                  : "border-surface bg-surface-raised text-ink-muted hover:bg-surface hover:text-ink",
              ].join(" ")}
            >
              Static
            </button>
          </div>

          <input
            type="range"
            min={RATE_RANGE.min}
            max={RATE_RANGE.maxTarget}
            step={RATE_RANGE.step}
            value={targetRate}
            onChange={(e) => onTargetRateChange(parseFloat(e.target.value))}
            className="w-full slider-target"
          />

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.slice(0, 4).map((preset) => (
              <button
                key={`target-${preset.label}`}
                type="button"
                onClick={() => onTargetRateChange(preset.value)}
                className={[
                  "px-2.5 py-1.5 text-xs rounded-lg font-medium transition-default",
                  Math.abs(targetRate - preset.value) < 0.002 && targetRate !== 0
                    ? "bg-target text-white shadow-sm"
                    : "bg-surface-raised text-target hover:bg-surface border border-transparent hover:border-target",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Net advantage indicator */}
      <div className="pt-4 border-t border-surface-subtle">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Net growth advantage:</span>
          <span
            className={[
              "font-display font-semibold tabular-nums",
              netAdvantage > 0
                ? "text-convergence"
                : netAdvantage < 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-ink-faint",
            ].join(" ")}
          >
            {netAdvantage > 0 ? "+" : ""}
            {formatPercent(netAdvantage)}
            {netAdvantage <= 0 && (
              <span className="text-xs font-normal ml-2">· no convergence</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
