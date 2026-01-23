import type { ElectricityDemandData } from "../../types/implications";

interface ElectricityDemandCardProps {
  data: ElectricityDemandData;
  onShare?: () => void;
}

function formatTotal(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} TWh`;
}

function formatSignedTotal(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const formatted = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return `${sign}${formatted} TWh`;
}

export function ElectricityDemandCard({ data, onShare }: ElectricityDemandCardProps) {
  return (
    <div
      role="tabpanel"
      id="elec-demand-panel"
      aria-labelledby="elec-demand-tab"
      className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium text-ink">Electricity demand</div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-ink-faint shrink-0">
            Losses {Math.round(data.assumptions.gridLossPct)}% · Net imports{" "}
            {Math.round(data.assumptions.netImportsPct)}%
          </div>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
              aria-label="Share electricity demand card"
            >
              Share
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Demand (WB) {formatTotal(data.demandCurrentTWh)}
        <span className="mx-1">→</span>
        {formatTotal(data.demandFutureTWh)}
        {data.demandDeltaTWh != null && (
          <>
            {" "}
            (
            <span className="font-medium text-ink">
              {formatSignedTotal(data.demandDeltaTWh)}
            </span>
            )
          </>
        )}
      </div>
      {data.requiredDomesticGenerationFutureTWh != null && (
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Required domestic generation (to meet demand):{" "}
          <span className="font-medium text-ink">
            {formatTotal(data.requiredDomesticGenerationFutureTWh)}
          </span>
          {data.buildoutDeltaTWh != null && (
            <>
              {" · "}Buildout vs observed{" "}
              <span className="font-medium text-ink">
                {formatSignedTotal(data.buildoutDeltaTWh)}
              </span>
            </>
          )}
        </div>
      )}
      {data.buildoutDeltaAvgGW != null && (
        <div className="mt-0.5 text-[11px] text-ink-faint">
          Average load:{" "}
          <span className="font-medium text-ink">
            {data.buildoutDeltaAvgGW >= 0 ? "+" : "−"}
            {Math.abs(data.buildoutDeltaAvgGW).toFixed(
              data.buildoutDeltaAvgGW >= 10 ? 0 : 1
            )}{" "}
            GW
          </span>{" "}
          (GWavg)
        </div>
      )}
    </div>
  );
}
