import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Milestone } from "../lib/convergence";
import type { ShareState } from "../lib/shareState";
import { ConvergenceChartInteractive } from "./ConvergenceChartInteractive";
import { ProjectionTable } from "./ProjectionTable";

export function ProjectionCard({
  view,
  onViewChange,
  showMilestones,
  onShowMilestonesChange,
  observedSeries,
  projection,
  chaserName,
  targetName,
  convergenceYear,
  milestones,
  unit,
  theme,
  svgRef,
  chaserHasNote,
  targetHasNote,
  onShareCard,
  onExport,
}: {
  view: ShareState["view"];
  onViewChange: (view: ShareState["view"]) => void;
  showMilestones: boolean;
  onShowMilestonesChange: (show: boolean) => void;
  observedSeries?: Array<{ year: number; chaser: number; target: number }>;
  projection: Array<{ year: number; chaser: number; target: number }>;
  chaserName: string;
  targetName: string;
  convergenceYear: number | null;
  milestones?: Milestone[];
  unit?: string | null;
  theme: "light" | "dark";
  svgRef: RefObject<SVGSVGElement | null>;
  chaserHasNote?: boolean;
  targetHasNote?: boolean;
  onShareCard?: () => void;
  onExport?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="card p-2.5 sm:p-3 animate-fade-in-up stagger-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {/* Left: controls */}
        <div className="flex items-center gap-2 min-w-0">
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted select-none">
            <input
              type="checkbox"
              checked={showMilestones}
              onChange={(e) => onShowMilestonesChange(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            {t("projection.milestones")}
          </label>
          <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => onViewChange("chart")}
              className={[
                "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
                view === "chart"
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              {t("projection.chart")}
            </button>
            <button
              type="button"
              onClick={() => onViewChange("table")}
              className={[
                "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
                view === "table"
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              {t("projection.table")}
            </button>
          </div>
          {unit && <span className="text-xs text-ink-faint truncate">{unit}</span>}
        </div>

        {/* Right: Share / Export */}
        {(onShareCard || onExport) && (
          <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden no-print flex-shrink-0">
            {onShareCard && (
              <button
                type="button"
                onClick={onShareCard}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-raised/60 transition-default focus-ring"
                aria-label={t("projection.shareAsCard")}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {t("projection.share")}
              </button>
            )}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-raised/60 transition-default focus-ring"
                aria-label={t("projection.exportData")}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {t("projection.export")}
              </button>
            )}
          </div>
        )}
      </div>

      {view === "table" ? (
        <ProjectionTable
          projection={projection}
          chaserName={chaserName}
          targetName={targetName}
          unit={unit}
        />
      ) : (
        <ConvergenceChartInteractive
          svgRef={svgRef}
          observed={observedSeries}
          projection={projection}
          chaserName={chaserName}
          targetName={targetName}
          convergenceYear={convergenceYear}
          milestones={showMilestones ? milestones : undefined}
          unit={unit}
          theme={theme}
          chaserHasNote={chaserHasNote}
          targetHasNote={targetHasNote}
        />
      )}
    </div>
  );
}
