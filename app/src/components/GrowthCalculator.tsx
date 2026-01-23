import { useId } from "react";
import { calculateRequiredChaserGrowthRate, formatPercent } from "../lib/convergence";
import { benchmarkGrowthRate } from "../lib/growthBenchmarks";

export function GrowthCalculator({
  chaserName,
  targetName,
  chaserValue,
  targetValue,
  chaserGrowthRate,
  targetGrowthRate,
  years,
  onYearsChange,
}: {
  chaserName: string;
  targetName: string;
  chaserValue: number;
  targetValue: number;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  years: number;
  onYearsChange: (years: number) => void;
}) {
  const yearsInputId = useId();

  const required = calculateRequiredChaserGrowthRate({
    chaserValue,
    targetValue,
    targetGrowthRate,
    years,
  });

  const bench = required == null ? null : benchmarkGrowthRate(required);
  const toneClass =
    bench?.tone === "unprecedented"
      ? "text-rose-700 dark:text-rose-300"
      : bench?.tone === "ambitious"
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";

  const ppDelta =
    required == null ? null : (required - chaserGrowthRate) * 100;

  const targetAssumption =
    targetGrowthRate === 0
      ? "Assumes target is static."
      : `Assumes target grows at ${formatPercent(targetGrowthRate)}/yr.`;

  const yearsLabel = years === 1 ? "year" : "years";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            What growth rate needed?
          </h3>
          <p className="text-[11px] text-ink-faint mt-1">{targetAssumption}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-muted" htmlFor={yearsInputId}>
            Years
          </label>
          <input
            id={yearsInputId}
            type="number"
            min={1}
            max={150}
            step={1}
            value={years}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onYearsChange(Math.max(1, Math.min(150, Math.round(next))));
            }}
            className="w-20 px-2 py-1 rounded-md bg-surface border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      <div className="mt-3">
        {required == null ? (
          <p className="text-sm text-ink-muted">—</p>
        ) : chaserValue >= targetValue ? (
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-chaser">{chaserName}</span> is already ahead of{" "}
            <span className="font-semibold text-target">{targetName}</span>.
          </p>
        ) : (
          <p className="text-sm text-ink-muted leading-relaxed">
            To catch up in{" "}
            <span className="font-semibold text-ink">{years}</span> {yearsLabel},{" "}
            <span className="font-semibold text-chaser">{chaserName}</span> needs{" "}
            <span className={["font-semibold", toneClass].join(" ")}>
              {formatPercent(required)}
            </span>
            /yr.
            {bench?.label && (
              <span className="ml-2 text-[11px] text-ink-faint">({bench.label})</span>
            )}
          </p>
        )}

        {required != null && chaserValue < targetValue && ppDelta != null && (
          <p className="text-[11px] text-ink-faint mt-2">
            vs current {formatPercent(chaserGrowthRate)}/yr{" "}
            ({ppDelta >= 0 ? "+" : ""}
            {ppDelta.toFixed(1)}pp)
          </p>
        )}
      </div>
    </div>
  );
}
