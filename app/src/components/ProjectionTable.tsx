import { formatMetricValue } from "../lib/convergence";

export function ProjectionTable({
  projection,
  chaserName,
  targetName,
  unit,
}: {
  projection: Array<{ year: number; chaser: number; target: number }>;
  chaserName: string;
  targetName: string;
  unit?: string | null;
}) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          Projection Data
        </h3>
        {unit && <span className="text-xs text-ink-faint">{unit}</span>}
      </div>

      <div className="overflow-auto rounded-lg border border-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-sunken">
            <tr className="text-left text-xs text-ink-muted">
              <th className="px-3 py-2 font-semibold">Year</th>
              <th className="px-3 py-2 font-semibold">{chaserName}</th>
              <th className="px-3 py-2 font-semibold">{targetName}</th>
            </tr>
          </thead>
          <tbody>
            {projection.map((row) => (
              <tr key={row.year} className="border-t border-surface">
                <td className="px-3 py-2 tabular-nums text-ink">{row.year}</td>
                <td className="px-3 py-2 tabular-nums text-chaser">
                  {formatMetricValue(row.chaser, unit)}
                </td>
                <td className="px-3 py-2 tabular-nums text-target">
                  {formatMetricValue(row.target, unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-ink-faint">
        Tip: use “Projection Data (CSV)” in More options → Data / Embed for a file download.
      </p>
    </div>
  );
}
