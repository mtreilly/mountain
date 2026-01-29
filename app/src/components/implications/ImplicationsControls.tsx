import { TEMPLATE_PATHS, type TemplateId } from "../../lib/templatePaths";
import { IMPLICATION_SCENARIOS, type ScenarioId, type Scenario } from "../../lib/implicationsScenarios";
import type { ImplicationAssumptions } from "./useImplicationsComputed";

interface ImplicationsControlsProps {
  template: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  horizonYears: number;
  onHorizonYearsChange: (years: number) => void;
  year: number;
  popAssumption: "trend" | "static";
  onPopAssumptionChange: (val: "trend" | "static") => void;
  popTrendRate: number;
  scenario: ScenarioId;
  onScenarioChange: (id: ScenarioId) => void;
  onAssumptionsChange: (fn: (a: ImplicationAssumptions) => ImplicationAssumptions) => void;
  scenarioDef: Scenario;
}

export function ImplicationsControls({
  template,
  onTemplateChange,
  horizonYears,
  onHorizonYearsChange,
  year,
  popAssumption,
  onPopAssumptionChange,
  popTrendRate,
  scenario,
  onScenarioChange,
  onAssumptionsChange,
  scenarioDef,
}: ImplicationsControlsProps) {
  return (
    <div className="space-y-4">
      {/* Template Path */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2">
          Development Path Template
        </label>
        <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
          {TEMPLATE_PATHS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplateChange(t.id)}
              aria-pressed={template === t.id}
              className={[
                "px-3 py-2 text-sm font-medium transition-default focus-ring",
                template === t.id
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Horizon Year */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2" htmlFor="imp-horizon">
          Projection Horizon
        </label>
        <div className="flex items-center gap-3">
          <input
            id="imp-horizon"
            type="number"
            min={1}
            max={150}
            step={1}
            value={horizonYears}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onHorizonYearsChange(Math.max(1, Math.min(150, Math.round(next))));
            }}
            className="w-24 px-3 py-2 rounded-lg bg-surface border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm text-ink-muted">years</span>
          <span className="text-sm text-ink-faint">({year})</span>
        </div>
      </div>

      {/* Population Assumption */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2">
          Population Assumption
        </label>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
            <button
              type="button"
              onClick={() => onPopAssumptionChange("trend")}
              aria-pressed={popAssumption === "trend"}
              className={[
                "px-3 py-2 text-sm font-medium transition-default focus-ring",
                popAssumption === "trend"
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              10-year trend
            </button>
            <button
              type="button"
              onClick={() => onPopAssumptionChange("static")}
              aria-pressed={popAssumption === "static"}
              className={[
                "px-3 py-2 text-sm font-medium transition-default focus-ring",
                popAssumption === "static"
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              Static
            </button>
          </div>
          {popAssumption === "trend" && (
            <span className="text-sm text-ink-faint">
              {popTrendRate >= 0 ? "+" : ""}
              {(popTrendRate * 100).toFixed(2)}%/yr
            </span>
          )}
        </div>
      </div>

      {/* Scenario */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2">
          Scenario
        </label>
        <div className="inline-flex flex-wrap rounded-lg border border-surface bg-surface overflow-hidden">
          {IMPLICATION_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onScenarioChange(s.id);
                if (s.presets?.horizonYears != null) onHorizonYearsChange(s.presets.horizonYears);
                if (s.presets?.gridLossPct != null || s.presets?.netImportsPct != null) {
                  onAssumptionsChange((a) => ({
                    ...a,
                    gridLossPct: s.presets?.gridLossPct ?? a.gridLossPct,
                    netImportsPct: s.presets?.netImportsPct ?? a.netImportsPct,
                  }));
                }
              }}
              aria-pressed={scenario === s.id}
              className={[
                "px-3 py-2 text-sm font-medium transition-default focus-ring",
                scenario === s.id
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-faint">{scenarioDef.blurb}</p>
      </div>
    </div>
  );
}
