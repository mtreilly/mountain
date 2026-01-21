import type { RefObject } from "react";
import { ConvergenceChartInteractive } from "./ConvergenceChartInteractive";
import { ProjectionTable } from "./ProjectionTable";
import type { Milestone } from "../lib/convergence";
import type { ShareState } from "../lib/shareState";

export function ProjectionCard({
  view,
  onViewChange,
  showMilestones,
  onShowMilestonesChange,
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
}: {
  view: ShareState["view"];
  onViewChange: (view: ShareState["view"]) => void;
  showMilestones: boolean;
  onShowMilestonesChange: (show: boolean) => void;
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
}) {
  return (
    <div className="card p-3 sm:p-4 animate-fade-in-up stagger-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          Projection
        </h3>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted select-none">
            <input
              type="checkbox"
              checked={showMilestones}
              onChange={(e) => onShowMilestonesChange(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Milestones
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
              Chart
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
              Table
            </button>
          </div>
          {unit && <span className="text-xs text-ink-faint">{unit}</span>}
        </div>
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

