import {
	formatMetricValue,
	formatPercent,
	formatYears,
	type Milestone,
} from "../lib/convergence";

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
	const willConverge =
		Number.isFinite(yearsToConvergence) && yearsToConvergence > 0;

	const milestoneText =
		milestones && milestones.length > 0
			? milestones
					.map(
						(m) => `${Math.round(m.percentage * 100)}% (${m.year})`,
					)
					.join(", ")
			: null;

	return (
		<div className="card p-3 sm:p-4">
			{/* Main headline - more compact */}
			<p className="text-sm sm:text-base leading-snug text-ink">
				{willConverge ? (
					<>
						<span className="font-bold text-chaser">{chaserName}</span> could
						match <span className="font-bold text-target">{targetName}</span> in{" "}
						<span className="text-lg sm:text-xl font-display font-black">
							{formatYears(yearsToConvergence)}
						</span>
						{convergenceYear && (
							<span className="text-ink-muted text-xs">
								{" "}
								({convergenceYear})
							</span>
						)}
					</>
				) : chaserGrowthRate <= targetGrowthRate ? (
					<>
						<span className="font-bold text-chaser">{chaserName}</span>{" "}
						<span className="font-bold text-amber-600 dark:text-amber-400">
							won't catch up
						</span>{" "}
						to <span className="font-bold text-target">{targetName}</span>
					</>
				) : (
					<>
						<span className="font-bold text-chaser">{chaserName}</span> is
						already ahead of{" "}
						<span className="font-bold text-target">{targetName}</span>
					</>
				)}
			</p>

			{/* Growth rate comparison - inline and compact */}
			<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-ink-muted">
				<span>
					At{" "}
					<span className="font-medium text-chaser">
						{formatPercent(chaserGrowthRate)}
					</span>
					/yr
					{targetGrowthRate > 0 ? (
						<>
							{" "}
							vs{" "}
							<span className="font-medium text-target">
								{formatPercent(targetGrowthRate)}
							</span>
							/yr
						</>
					) : (
						<> (target static)</>
					)}
				</span>
				<span className="text-ink-faint">·</span>
				<span className="truncate">{metricName}</span>
				{milestoneText && willConverge && (
					<>
						<span className="text-ink-faint">·</span>
						<span className="text-ink-faint">
							Milestones: {milestoneText}
						</span>
					</>
				)}
			</div>

			{/* Stats row - compact horizontal layout */}
			<div className="mt-3 pt-3 border-t border-surface-subtle">
				<div className="grid grid-cols-3 gap-3 sm:gap-4">
					<div className="min-w-0">
						<div className="text-base sm:text-lg font-display font-bold text-ink tabular-nums">
							{gap.toFixed(1)}×
						</div>
						<div className="text-[10px] text-ink-faint uppercase tracking-wider">
							Gap
						</div>
					</div>
					<div className="min-w-0">
						<div className="text-base sm:text-lg font-display font-bold text-chaser tabular-nums">
							{formatMetricValue(chaserValue, metricUnit)}
							{chaserIsAdjusted && (
								<span className="text-[10px] text-ink-faint ml-0.5">*</span>
							)}
						</div>
						<div className="text-[10px] text-ink-faint uppercase tracking-wider truncate">
							{chaserName}
						</div>
					</div>
					<div className="min-w-0">
						<div className="text-base sm:text-lg font-display font-bold text-target tabular-nums">
							{formatMetricValue(targetValue, metricUnit)}
							{targetIsAdjusted && (
								<span className="text-[10px] text-ink-faint ml-0.5">*</span>
							)}
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
