import type { ElectricityAssumption } from "../../types/implications";

interface ElectricityAssumptionsCardProps {
  assumptions: ElectricityAssumption;
  onAssumptionsChange: (assumptions: ElectricityAssumption) => void;
  onReset: () => void;
  onShare?: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function AssumptionField(props: {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { label, value, unit, step, min, max, onChange } = props;
  return (
    <label className="block">
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(clamp(next, min, max));
          }}
          className="w-full px-2 py-1 rounded-md bg-surface-raised border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        {unit && <span className="text-[11px] text-ink-faint shrink-0">{unit}</span>}
      </div>
    </label>
  );
}

export function ElectricityAssumptionsCard({
  assumptions,
  onAssumptionsChange,
  onReset,
  onShare,
}: ElectricityAssumptionsCardProps) {
  return (
    <div
      role="tabpanel"
      id="elec-assumptions-panel"
      aria-labelledby="elec-assumptions-tab"
      className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium text-ink">Electricity assumptions</div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
            aria-label="Share electricity assumptions card"
          >
            Share
          </button>
        )}
      </div>
      <div className="mt-2 rounded-lg border border-surface bg-surface px-3 py-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <AssumptionField
            label="Solar CF"
            value={assumptions.solarCf * 100}
            unit="%"
            step={1}
            min={5}
            max={50}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, solarCf: clamp(next / 100, 0.01, 1) })
            }
          />
          <AssumptionField
            label="Wind CF"
            value={assumptions.windCf * 100}
            unit="%"
            step={1}
            min={5}
            max={70}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, windCf: clamp(next / 100, 0.01, 1) })
            }
          />
          <AssumptionField
            label="Nuclear CF"
            value={assumptions.nuclearCf * 100}
            unit="%"
            step={1}
            min={5}
            max={98}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, nuclearCf: clamp(next / 100, 0.01, 1) })
            }
          />
          <AssumptionField
            label="Coal CF"
            value={assumptions.coalCf * 100}
            unit="%"
            step={1}
            min={5}
            max={95}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, coalCf: clamp(next / 100, 0.01, 1) })
            }
          />
          <AssumptionField
            label="Panel size"
            value={assumptions.panelWatts}
            unit="W"
            step={10}
            min={100}
            max={1000}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, panelWatts: clamp(next, 100, 1000) })
            }
          />
          <AssumptionField
            label="Turbine size"
            value={assumptions.windTurbineMw}
            unit="MW"
            step={0.5}
            min={0.5}
            max={20}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, windTurbineMw: clamp(next, 0.5, 20) })
            }
          />
          <AssumptionField
            label="People/home"
            value={assumptions.householdSize}
            unit=""
            step={0.1}
            min={1}
            max={10}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, householdSize: clamp(next, 1, 10) })
            }
          />
          <AssumptionField
            label="Grid losses"
            value={assumptions.gridLossPct}
            unit="%"
            step={1}
            min={0}
            max={50}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, gridLossPct: clamp(next, 0, 50) })
            }
          />
          <AssumptionField
            label="Net imports"
            value={assumptions.netImportsPct}
            unit="%"
            step={1}
            min={-50}
            max={50}
            onChange={(next) =>
              onAssumptionsChange({ ...assumptions, netImportsPct: clamp(next, -50, 50) })
            }
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={onReset}
              className="w-full px-2 py-1 rounded-md border border-surface bg-surface-raised text-xs font-medium text-ink hover:bg-surface transition-default focus-ring"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
