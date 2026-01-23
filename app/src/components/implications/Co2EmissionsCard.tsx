import type { Co2Data } from "../../types/implications";

interface Co2EmissionsCardProps {
  data: Co2Data;
  onShare?: () => void;
}

function formatTotal(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} MtCO₂`;
}

export function Co2EmissionsCard({ data, onShare }: Co2EmissionsCardProps) {
  return (
    <div
      role="tabpanel"
      id="co2-panel"
      aria-labelledby="co2-tab"
      className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium text-ink">CO₂ (territorial)</div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
            aria-label="Share CO₂ emissions card"
          >
            Share
          </button>
        )}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Total {formatTotal(data.currentMt)}
        <span className="mx-1">→</span>
        {formatTotal(data.futureMt)}
      </div>
    </div>
  );
}
