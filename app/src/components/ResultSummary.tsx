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
		<div className="card p-4 sm:p-5">
			{/* Main headline - more compact */}
			<p className="text-base sm:text-lg leading-relaxed text-ink">
				{willConverge ? (
					<>
						<span className="font-bold text-chaser">{chaserName}</span> could
						match <span className="font-bold text-target">{targetName}</span> in{" "}
						<span className="text-xl sm:text-2xl font-display font-black">
							{formatYears(yearsToConvergence)}
						</span>
						{convergenceYear && (
							<span className="text-ink-muted text-sm">
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
			<p className="text-xs sm:text-sm text-ink-muted mt-2">
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
				{" · "}
				{metricName}
			</p>

			{milestoneText && willConverge && (
				<p className="text-[11px] text-ink-faint mt-2">
					Milestones: {milestoneText}
				</p>
			)}

			{/* Stats row - compact horizontal layout */}
			<div className="flex items-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-surface-subtle">
				<div className="text-center">
					<div className="text-lg sm:text-xl font-display font-bold text-ink">
						{gap.toFixed(1)}×
					</div>
					<div className="text-[10px] text-ink-faint uppercase tracking-wider">
						Gap
					</div>
				</div>
				<div className="text-center flex-1">
					<div className="text-lg sm:text-xl font-display font-bold text-chaser">
						{formatMetricValue(chaserValue, metricUnit)}
						{chaserIsAdjusted && (
							<span className="text-xs text-ink-faint ml-0.5">*</span>
						)}
					</div>
					<div className="text-[10px] text-ink-faint uppercase tracking-wider truncate">
						{chaserName}
					</div>
				</div>
				<div className="text-center flex-1">
					<div className="text-lg sm:text-xl font-display font-bold text-target">
						{formatMetricValue(targetValue, metricUnit)}
						{targetIsAdjusted && (
							<span className="text-xs text-ink-faint ml-0.5">*</span>
						)}
					</div>
					<div className="text-[10px] text-ink-faint uppercase tracking-wider truncate">
						{targetName}
					</div>
				</div>
			</div>
		</div>
	);
}
