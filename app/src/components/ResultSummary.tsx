import { useTranslation } from "react-i18next";
import { formatMetricValue, formatPercent, formatYears, type Milestone } from "../lib/convergence";

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
  chaserIsAdjusted?: boolean;
  targetIsAdjusted?: boolean;
  milestones?: Milestone[];
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
  chaserIsAdjusted,
  targetIsAdjusted,
  milestones,
}: ResultSummaryProps) {
  const { t } = useTranslation();
  const chaserAlreadyAhead = chaserValue >= targetValue;
  const willConverge =
    !chaserAlreadyAhead && Number.isFinite(yearsToConvergence) && yearsToConvergence > 0;

  // Hide milestones already exceeded at the starting values
  const initialRatio = targetValue > 0 ? chaserValue / targetValue : 0;
  const visibleMilestones = milestones?.filter((m) => m.percentage > initialRatio);

  const milestoneText =
    visibleMilestones && visibleMilestones.length > 0
      ? visibleMilestones.map((m) => `${Math.round(m.percentage * 100)}% (${m.year})`).join(", ")
      : null;

  const headline = willConverge ? (
    <>
      <span className="font-bold text-chaser">{chaserName}</span> {t("result.couldMatch")}{" "}
      <span className="font-bold text-target">{targetName}</span> {t("result.in")}{" "}
      <span className="text-2xl sm:text-3xl font-display font-black">
        {formatYears(yearsToConvergence)}
      </span>
      {convergenceYear && (
        <span className="text-ink-muted text-sm sm:text-base font-sans"> {t("result.by", { year: convergenceYear })}</span>
      )}
    </>
  ) : chaserAlreadyAhead ? (
    <>
      <span className="font-bold text-chaser">{chaserName}</span> {t("result.alreadyAhead")}{" "}
      <span className="font-bold text-target">{targetName}</span>
    </>
  ) : (
    <>
      <span className="font-bold text-chaser">{chaserName}</span>{" "}
      <span className="font-bold text-amber-600 dark:text-amber-400">{t("result.wontCatchUp")}</span> {t("result.to")}{" "}
      <span className="font-bold text-target">{targetName}</span>
    </>
  );

  return (
    <div className="card p-4 sm:p-5">
      {/* Main headline - more compact */}
      <p className="text-lg sm:text-xl lg:text-2xl font-display leading-snug text-ink">{headline}</p>

      {/* Growth rate comparison - inline and compact */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-ink-muted">
        <span>
          {t("result.at")} <span className="font-medium text-chaser">{formatPercent(chaserGrowthRate)}</span>
          {t("result.perYear")}
          {targetGrowthRate !== 0 ? (
            <>
              {" "}
              vs <span className="font-medium text-target">{formatPercent(targetGrowthRate)}</span>
              {t("result.perYear")}
            </>
          ) : (
            <> {t("result.targetStatic")}</>
          )}
        </span>
        <span className="text-ink-faint">·</span>
        <span className="truncate">{metricName}</span>
        {milestoneText && willConverge && (
          <>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-faint">{t("result.milestones")} {milestoneText}</span>
          </>
        )}
      </div>

      {/* Stats row - compact horizontal layout */}
      <div className="mt-3 pt-3 border-t border-surface-subtle">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-display font-bold text-ink tabular-nums">
              {gap.toFixed(1)}×
            </div>
            <div className="text-[10px] text-ink-faint uppercase tracking-wider">{t("result.gap")}</div>
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-display font-bold text-chaser tabular-nums">
              {formatMetricValue(chaserValue, metricUnit)}
              {chaserIsAdjusted && <span className="text-[10px] text-ink-faint ml-0.5">*</span>}
            </div>
            <div className="text-[10px] text-ink-faint uppercase tracking-wider truncate">
              {chaserName}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-display font-bold text-target tabular-nums">
              {formatMetricValue(targetValue, metricUnit)}
              {targetIsAdjusted && <span className="text-[10px] text-ink-faint ml-0.5">*</span>}
            </div>
            <div className="text-[10px] text-ink-faint uppercase tracking-wider truncate">
              {targetName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
