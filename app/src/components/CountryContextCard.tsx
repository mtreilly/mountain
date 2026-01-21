import { formatMetricValue } from "../lib/convergence";
import type { CountryAdjustment } from "../lib/countryAdjustments";

interface CountryContextCardProps {
	adjustment: CountryAdjustment;
	countryName: string;
	originalValue: number;
	adjustedValue: number;
	useAdjusted: boolean;
	onToggleAdjusted: (useAdjusted: boolean) => void;
	unit?: string | null;
	color: "chaser" | "target";
}

export function CountryContextCard({
	adjustment,
	countryName,
	originalValue,
	adjustedValue,
	useAdjusted,
	onToggleAdjusted,
	unit,
	color,
}: CountryContextCardProps) {
	const borderColor = color === "chaser" ? "border-chaser" : "border-target";
	const bgColor = color === "chaser" ? "bg-chaser-light" : "bg-target-light";
	const textColor = color === "chaser" ? "text-chaser" : "text-target";

	return (
		<div
			className={`card p-3 border-l-4 ${borderColor} ${bgColor}`}
			role="region"
			aria-label={`Data adjustment for ${countryName}`}
		>
			{/* Header */}
			<div className="flex items-start gap-2 mb-2">
				<svg
					className={`w-4 h-4 mt-0.5 shrink-0 ${textColor}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div className="flex-1 min-w-0">
					<h4 className={`text-sm font-semibold ${textColor}`}>
						{adjustment.title}
					</h4>
				</div>
			</div>

			{/* Explanation */}
			<p className="text-xs text-ink-muted leading-relaxed mb-2">
				{adjustment.explanation}
				{adjustment.source && (
					<span className="text-ink-faint"> — {adjustment.source}</span>
				)}
			</p>

			{/* Value comparison */}
			<div className="flex items-center gap-2.5 text-xs mb-2 py-1.5 px-2 rounded-lg bg-surface/50 dark:bg-surface-dark/50">
				<div className="flex-1">
					<div className="text-ink-faint mb-0.5">Original</div>
					<div
						className={`font-semibold ${!useAdjusted ? textColor : "text-ink-muted"}`}
					>
						{formatMetricValue(originalValue, unit)}
					</div>
				</div>
				<div className="text-ink-faint">→</div>
				<div className="flex-1">
					<div className="text-ink-faint mb-0.5">Adjusted</div>
					<div
						className={`font-semibold ${useAdjusted ? textColor : "text-ink-muted"}`}
					>
						{formatMetricValue(adjustedValue, unit)}
					</div>
				</div>
			</div>

			{/* Toggle buttons */}
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => onToggleAdjusted(false)}
					className={[
						"flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-default",
						!useAdjusted
							? `${color === "chaser" ? "bg-chaser" : "bg-target"} text-white`
							: "bg-surface dark:bg-surface-dark text-ink-muted hover:text-ink",
					].join(" ")}
					aria-pressed={!useAdjusted}
				>
					Use original
				</button>
				<button
					type="button"
					onClick={() => onToggleAdjusted(true)}
					className={[
						"flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-default",
						useAdjusted
							? `${color === "chaser" ? "bg-chaser" : "bg-target"} text-white`
							: "bg-surface dark:bg-surface-dark text-ink-muted hover:text-ink",
					].join(" ")}
					aria-pressed={useAdjusted}
				>
					Use adjusted
				</button>
			</div>
		</div>
	);
}
