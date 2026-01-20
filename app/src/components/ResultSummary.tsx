import { formatMetricValue, formatYears, formatPercent } from "../lib/convergence";

interface ResultSummaryProps {
  chaserName: string;
  targetName: string;
  metricName: string;
  metricUnit?: string | null;
  chaserValue: number;
  targetValue: number;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  yearsToConvergence: number;
  convergenceYear: number | null;
  gap: number;
}

export function ResultSummary({
  chaserName,
  targetName,
  metricName,
  metricUnit,
  chaserValue,
  targetValue,
  chaserGrowthRate,
  targetGrowthRate,
  yearsToConvergence,
  convergenceYear,
  gap,
}: ResultSummaryProps) {
  const willConverge = isFinite(yearsToConvergence) && yearsToConvergence > 0;

  return (
    <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
      {/* Main headline */}
      <p className="text-xl leading-relaxed text-zinc-800 dark:text-zinc-100">
        {willConverge ? (
          <>
            <span className="font-bold text-red-600">{chaserName}</span> could
            match{" "}
            <span className="font-bold text-green-600">{targetName}</span>'s{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{metricName}</span>{" "}
            in{" "}
            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
              {formatYears(yearsToConvergence)}
            </span>
            {convergenceYear && (
              <span className="text-zinc-500 dark:text-zinc-400"> (by {convergenceYear})</span>
            )}
          </>
        ) : chaserGrowthRate <= targetGrowthRate ? (
          <>
            <span className="font-bold text-red-600">{chaserName}</span> will{" "}
            <span className="font-bold text-orange-600">never catch up</span> to{" "}
            <span className="font-bold text-green-600">{targetName}</span> at
            these growth rates
          </>
        ) : (
          <>
            <span className="font-bold text-red-600">{chaserName}</span> is
            already ahead of{" "}
            <span className="font-bold text-green-600">{targetName}</span>
          </>
        )}
      </p>

      {/* Growth rate comparison */}
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Assuming {metricName} grows at{" "}
        <span className="font-semibold text-red-600">
          {formatPercent(chaserGrowthRate)}
        </span>{" "}
        per year
        {targetGrowthRate > 0 ? (
          <>
            {" "}
            while {targetName} grows at{" "}
            <span className="font-semibold text-green-600">
              {formatPercent(targetGrowthRate)}
            </span>{" "}
            per year
          </>
        ) : (
          <> while {targetName} remains static</>
        )}
        .
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{gap.toFixed(1)}×</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Current gap
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{formatMetricValue(chaserValue, metricUnit)}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {chaserName}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{formatMetricValue(targetValue, metricUnit)}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {targetName}
          </div>
        </div>
      </div>

      {metricUnit && (
        <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          Unit: {metricUnit}
        </div>
      )}
    </div>
  );
}
