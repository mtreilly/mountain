import { formatNumber } from "../../lib/convergence";
import type { UrbanizationData } from "../../types/implications";

interface UrbanizationCardProps {
  data: UrbanizationData;
  onShare?: () => void;
}

function formatTotal(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatNumber(value);
}

function formatSignedTotal(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}${formatNumber(abs)}`;
}

function formatUnitCount(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (abs < 1) return `${sign}<1`;
  if (abs < 10) return `${sign}${abs.toFixed(1).replace(/\.0$/, "")}`;
  return `${sign}${formatNumber(Math.round(abs))}`;
}

export function UrbanizationCard({ data, onShare }: UrbanizationCardProps) {
  return (
    <div
      role="tabpanel"
      id="urban-panel"
      aria-labelledby="urban-tab"
      className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-ink">Urbanization buildout</div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-ink-faint">
            Uses people/home in assumptions
          </div>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
              aria-label="Share urbanization card"
            >
              Share
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Urban residents {formatTotal(data.currentPersons)}
        <span className="mx-1">→</span>
        {formatTotal(data.futurePersons)}
        {data.deltaPersons != null && (
          <>
            {" "}
            (
            <span className="font-medium text-ink">
              {formatSignedTotal(data.deltaPersons)}
            </span>
            )
          </>
        )}
      </div>
      {data.homesNeeded != null && (
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Homes (rough):{" "}
          <span className="font-medium text-ink">
            {formatUnitCount(data.homesNeeded)}
          </span>{" "}
          total (
          <span className="font-medium text-ink">
            {formatUnitCount(data.homesNeeded / data.yearsToProject)}
          </span>
          /yr)
        </div>
      )}
    </div>
  );
}
