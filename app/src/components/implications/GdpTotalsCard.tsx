import { formatNumber } from "../../lib/convergence";
import type { GdpData } from "../../types/implications";

interface GdpTotalsCardProps {
  data: GdpData;
  onShare?: () => void;
}

function formatTotal(t: { unit: string; value: number } | null) {
  if (!t || !Number.isFinite(t.value)) return "—";
  if (t.unit === "int$") return `$${formatNumber(t.value)}`;
  return `${formatNumber(t.value)} ${t.unit}`;
}

export function GdpTotalsCard({ data, onShare }: GdpTotalsCardProps) {
  return (
    <div
      role="tabpanel"
      id="gdp-panel"
      aria-labelledby="gdp-tab"
      className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium text-ink">GDP Totals</div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
            aria-label="Share GDP totals card"
          >
            Share
          </button>
        )}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        GDP (total) {formatTotal(data.gdpTotalCurrent)}{" "}
        <span className="mx-1">→</span>
        {formatTotal(data.gdpTotalFuture)}
      </div>
      {data.popCurrent != null && data.popFuture != null && (
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Population: {formatNumber(Math.round(data.popCurrent))}{" "}
          <span className="mx-1">→</span>
          {formatNumber(Math.round(data.popFuture))}
        </div>
      )}
    </div>
  );
}
