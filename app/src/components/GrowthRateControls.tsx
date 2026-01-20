import { formatPercent } from "../lib/convergence";
import { useEffect, useRef } from "react";

interface GrowthRateControlsProps {
  chaserRate: number;
  targetRate: number;
  onChaserRateChange: (rate: number) => void;
  onTargetRateChange: (rate: number) => void;
  chaserName: string;
  targetName: string;
}

const PRESETS = [
  { label: "Stagnant", value: 0.005 },
  { label: "Slow", value: 0.015 },
  { label: "Moderate", value: 0.03 },
  { label: "Fast", value: 0.05 },
  { label: "Rapid", value: 0.07 },
];

export function GrowthRateControls({
  chaserRate,
  targetRate,
  onChaserRateChange,
  onTargetRateChange,
  chaserName,
  targetName,
}: GrowthRateControlsProps) {
  const netAdvantage = chaserRate - targetRate;
  const lastDynamicTargetRate = useRef(0.015);

  useEffect(() => {
    if (targetRate > 0) lastDynamicTargetRate.current = targetRate;
  }, [targetRate]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 shadow-sm">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide">
          Growth Rate Assumptions
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Set how each country’s selected metric evolves year over year.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chaser growth rate */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-red-700 dark:text-red-300">{chaserName}</label>
            <span className="text-lg font-bold text-red-600">{formatPercent(chaserRate)}</span>
          </div>
          <input
            type="range"
            min={0.001}
            max={0.12}
            step={0.001}
            value={chaserRate}
            onChange={(e) => onChaserRateChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-red-200 dark:bg-red-900/40 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={`chaser-${preset.label}`}
                type="button"
                onClick={() => onChaserRateChange(preset.value)}
                className={[
                  "px-2.5 py-1 text-xs rounded-full transition-colors",
                  Math.abs(chaserRate - preset.value) < 0.002
                    ? "bg-red-500 text-white"
                    : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target growth rate */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-green-700 dark:text-green-300">
              {targetName}
            </label>
            <span className="text-lg font-bold text-green-600">
              {targetRate === 0 ? "Static" : formatPercent(targetRate)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onTargetRateChange(Math.max(0.001, lastDynamicTargetRate.current))}
              className={[
                "flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                targetRate === 0
                  ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                  : "border-green-300 bg-green-100 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200",
              ].join(" ")}
            >
              Growing
            </button>
            <button
              type="button"
              onClick={() => onTargetRateChange(0)}
              className={[
                "flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                targetRate === 0
                  ? "border-green-300 bg-green-100 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/60",
              ].join(" ")}
            >
              Static
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={0.08}
            step={0.001}
            value={targetRate}
            disabled={targetRate === 0}
            onChange={(e) => onTargetRateChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-green-200 dark:bg-green-900/40 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-40"
          />

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.slice(0, 4).map((preset) => (
              <button
                key={`target-${preset.label}`}
                type="button"
                onClick={() => onTargetRateChange(preset.value)}
                disabled={targetRate === 0}
                className={[
                  "px-2.5 py-1 text-xs rounded-full transition-colors",
                  targetRate === 0 ? "opacity-50 cursor-not-allowed" : "",
                  Math.abs(targetRate - preset.value) < 0.002 && targetRate !== 0
                    ? "bg-green-500 text-white"
                    : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-950/60",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {targetRate === 0
              ? "Static keeps the target constant (no growth)."
              : "Growing applies a constant annual growth rate to the target too."}
          </p>
        </div>
      </div>

      {/* Net advantage indicator */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Net growth advantage:</span>
          <span
            className={[
              "font-semibold",
              netAdvantage > 0
                ? "text-blue-600"
                : netAdvantage < 0
                  ? "text-orange-600"
                  : "text-zinc-500 dark:text-zinc-400",
            ].join(" ")}
          >
            {netAdvantage > 0 ? "+" : ""}
            {formatPercent(netAdvantage)}
            {netAdvantage <= 0 && " · no convergence"}
          </span>
        </div>
      </div>
    </div>
  );
}
