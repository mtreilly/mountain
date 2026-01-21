import { useEffect, useMemo, useRef } from "react";
import type { Milestone } from "../lib/convergence";
import type { EmbedParams, ShareState } from "../lib/shareState";
import { toSearchString } from "../lib/shareState";
import { ConvergenceChart } from "./ConvergenceChart";
import { ConvergenceChartInteractive } from "./ConvergenceChartInteractive";
import { EmbedFooter } from "./EmbedFooter";

interface EmbedViewProps {
	shareState: ShareState;
	embedParams: EmbedParams;
	chaserName: string;
	targetName: string;
	projection: Array<{ year: number; chaser: number; target: number }>;
	convergenceYear: number | null;
	yearsToConvergence: number | null;
	milestones?: Milestone[];
	unit?: string | null;
	resolvedTheme: "light" | "dark";
}

export function EmbedView({
	shareState,
	embedParams,
	chaserName,
	targetName,
	projection,
	convergenceYear,
	yearsToConvergence,
	milestones,
	unit,
	resolvedTheme,
}: EmbedViewProps) {
	const chartRef = useRef<SVGSVGElement>(null);

	// Determine the theme to use
	const theme = useMemo(() => {
		if (embedParams.embedTheme === "auto") {
			return resolvedTheme;
		}
		return embedParams.embedTheme;
	}, [embedParams.embedTheme, resolvedTheme]);

	// Apply embed-mode class to body
	useEffect(() => {
		document.body.classList.add("embed-mode");
		if (theme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
		return () => {
			document.body.classList.remove("embed-mode");
		};
	}, [theme]);

	// Generate the app URL (without embed params) for the footer link
	const appUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}${window.location.pathname}${toSearchString(shareState)}`;
	}, [shareState]);

	// Generate headline text
	const headline = useMemo(() => {
		if (yearsToConvergence === null) {
			return `${chaserName} won't catch up to ${targetName}`;
		}
		if (yearsToConvergence <= 0) {
			return `${chaserName} has already caught up to ${targetName}`;
		}
		return `${chaserName} catches up in ${Math.round(yearsToConvergence)} years`;
	}, [chaserName, targetName, yearsToConvergence]);

	const showMilestones = shareState.ms !== false;

	return (
		<div
			className="embed-container"
			style={{ height: embedParams.height }}
		>
			{/* Chart area */}
			<div className="embed-chart-wrapper">
				{embedParams.interactive ? (
					<ConvergenceChartInteractive
						svgRef={chartRef}
						projection={projection}
						chaserName={chaserName}
						targetName={targetName}
						convergenceYear={convergenceYear}
						milestones={showMilestones ? milestones : undefined}
						unit={unit}
						theme={theme}
					/>
				) : (
					<ConvergenceChart
						ref={chartRef}
						projection={projection}
						chaserName={chaserName}
						targetName={targetName}
						convergenceYear={convergenceYear}
						milestones={showMilestones ? milestones : undefined}
						unit={unit}
						theme={theme}
						svgProps={{
							className: "w-full pointer-events-none",
						}}
					/>
				)}
			</div>

			{/* Compact headline */}
			<div className="embed-headline">
				<span className="text-ink font-medium">{headline}</span>
				{convergenceYear && (
					<span className="text-ink-muted ml-2">({convergenceYear})</span>
				)}
			</div>

			{/* Attribution footer */}
			<EmbedFooter
				shareUrl={appUrl}
				chaserName={chaserName}
				targetName={targetName}
			/>
		</div>
	);
}
