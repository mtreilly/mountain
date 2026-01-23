import { useEffect, useMemo, useRef } from "react";
import type { Milestone } from "../lib/convergence";
import type { EmbedParams, ShareState } from "../lib/shareState";
import { toSearchString } from "../lib/shareState";
import { ConvergenceChart } from "./ConvergenceChart";
import { ConvergenceChartInteractive } from "./ConvergenceChartInteractive";
import { EmbedFooter } from "./EmbedFooter";

type EmbedViewStatus = "ready" | "loading" | "no-data";

interface EmbedViewProps {
	shareState: ShareState;
	embedParams: EmbedParams;
	chaserName: string;
	targetName: string;
	status?: EmbedViewStatus;
	message?: string;
	projection?: Array<{ year: number; chaser: number; target: number }>;
	convergenceYear?: number | null;
	yearsToConvergence?: number | null;
	milestones?: Milestone[];
	unit?: string | null;
	resolvedTheme: "light" | "dark";
}

export function EmbedView({
	shareState,
	embedParams,
	chaserName,
	targetName,
	status = "ready",
	message,
	projection,
	convergenceYear = null,
	yearsToConvergence = null,
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
		if (status !== "ready") {
			return (
				message ??
				(status === "no-data"
					? "Data unavailable for this embed"
					: "Loading…")
			);
		}

		if (!projection || projection.length === 0) {
			return message ?? "Loading…";
		}

		const alreadyAhead =
			Number.isFinite(projection[0].chaser) &&
			Number.isFinite(projection[0].target) &&
			projection[0].chaser >= projection[0].target;

		if (alreadyAhead) {
			return `${chaserName} is already ahead of ${targetName}`;
		}
		if (yearsToConvergence == null) {
			return `${chaserName} won't catch up to ${targetName}`;
		}
		if (yearsToConvergence <= 0) {
			return `${chaserName} is already ahead of ${targetName}`;
		}
		return `${chaserName} catches up in ${Math.round(yearsToConvergence)} years`;
	}, [chaserName, message, projection, status, targetName, yearsToConvergence]);

	const showMilestones = shareState.ms !== false;

	return (
		<div
			className="embed-container"
			style={{ height: embedParams.height }}
		>
			{/* Chart area */}
			<div className="embed-chart-wrapper">
				{status === "ready" && projection && projection.length > 0 ? (
					embedParams.interactive ? (
						<ConvergenceChartInteractive
							svgRef={chartRef}
							projection={projection}
							chaserName={chaserName}
							targetName={targetName}
							convergenceYear={convergenceYear ?? null}
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
							convergenceYear={convergenceYear ?? null}
							milestones={showMilestones ? milestones : undefined}
							unit={unit}
							theme={theme}
							svgProps={{
								className: "w-full pointer-events-none",
							}}
						/>
					)
				) : (
					<div className="h-full flex items-center justify-center">
						<div className="text-sm text-ink-muted">
							{headline}
						</div>
					</div>
				)}
			</div>

			{/* Compact headline */}
			<div className="embed-headline">
				<span className="text-ink font-medium">{headline}</span>
				{status === "ready" && convergenceYear && (
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
