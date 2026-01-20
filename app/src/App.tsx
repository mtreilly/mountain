import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { ConvergenceChartInteractive } from "./components/ConvergenceChartInteractive";
import { CountryContextCard } from "./components/CountryContextCard";
import { CountrySelector } from "./components/CountrySelector";
import { GrowthRateControls } from "./components/GrowthRateControls";
import { MetricSelector } from "./components/MetricSelector";
import { ProjectionTable } from "./components/ProjectionTable";
import { ResultSummary } from "./components/ResultSummary";
import { ShareMenu } from "./components/ShareMenu";
import { ThemeToggle } from "./components/ThemeToggle";
import { useConvergence } from "./hooks/useConvergence";
import { useCountries } from "./hooks/useCountries";
import { useCountryData } from "./hooks/useCountryData";
import { useIndicators } from "./hooks/useIndicators";
import { useTheme } from "./hooks/useTheme";
import { copyTextToClipboard } from "./lib/clipboard";
import { applyAdjustment, getAdjustment } from "./lib/countryAdjustments";
import { toObservedCsv, toProjectionCsv, toReportJson } from "./lib/dataExport";
import { downloadText } from "./lib/download";
import {
	DEFAULT_SHARE_STATE,
	parseShareStateFromSearch,
	type ShareState,
	toSearchString,
} from "./lib/shareState";

export default function App() {
	const initialShareState = useMemo(() => {
		if (typeof window === "undefined") return DEFAULT_SHARE_STATE;
		return parseShareStateFromSearch(
			window.location.search,
			DEFAULT_SHARE_STATE,
		);
	}, []);

	const [chaserIso, setChaserIso] = useState(initialShareState.chaser);
	const [targetIso, setTargetIso] = useState(initialShareState.target);
	const [indicatorCode, setIndicatorCode] = useState(
		initialShareState.indicator,
	);
	const [chaserGrowthRate, setChaserGrowthRate] = useState(
		initialShareState.cg,
	);
	const [targetGrowthRate, setTargetGrowthRate] = useState(
		initialShareState.tmode === "static" ? 0 : initialShareState.tg,
	);
	const [baseYear, setBaseYear] = useState(initialShareState.baseYear);
	const [view, setView] = useState<ShareState["view"]>(
		initialShareState.view || "chart",
	);
	const [useChaserAdjusted, setUseChaserAdjusted] = useState(
		initialShareState.adjC ?? true,
	);
	const [useTargetAdjusted, setUseTargetAdjusted] = useState(
		initialShareState.adjT ?? true,
	);
	const { theme, toggleTheme } = useTheme();

	const {
		countries,
		loading: countriesLoading,
		error: countriesError,
	} = useCountries();
	const { indicators, loading: indicatorsLoading } = useIndicators();

	const {
		data,
		getLatestValue,
		indicator: indicatorInfo,
		loading: dataLoading,
		error: dataError,
	} = useCountryData({
		countries: [chaserIso, targetIso],
		indicator: indicatorCode,
	});

	const chaserCountry = countries.find((c) => c.iso_alpha3 === chaserIso);
	const targetCountry = countries.find((c) => c.iso_alpha3 === targetIso);

	const selectedIndicator =
		indicators.find((i) => i.code === indicatorCode) || indicatorInfo || null;
	const metricName = selectedIndicator?.name || indicatorCode;
	const metricUnit = selectedIndicator?.unit || null;

	const chaserValueRaw = getLatestValue(chaserIso);
	const targetValueRaw = getLatestValue(targetIso);

	const chaserAdjustment = getAdjustment(chaserIso, indicatorCode);
	const targetAdjustment = getAdjustment(targetIso, indicatorCode);

	const chaserValue =
		chaserValueRaw != null
			? applyAdjustment(chaserValueRaw, chaserAdjustment, useChaserAdjusted)
			: 1;
	const targetValue =
		targetValueRaw != null
			? applyAdjustment(targetValueRaw, targetAdjustment, useTargetAdjusted)
			: 2;

	const { yearsToConvergence, convergenceYear, projection, gap } =
		useConvergence({
			chaserValue,
			targetValue,
			chaserGrowthRate,
			targetGrowthRate,
			baseYear,
		});

	const shareState: ShareState = useMemo(() => {
		return {
			chaser: chaserIso,
			target: targetIso,
			indicator: indicatorCode,
			cg: chaserGrowthRate,
			tg: targetGrowthRate,
			tmode: targetGrowthRate === 0 ? "static" : "growing",
			baseYear,
			view,
			adjC: useChaserAdjusted,
			adjT: useTargetAdjusted,
		};
	}, [
		baseYear,
		chaserGrowthRate,
		chaserIso,
		indicatorCode,
		targetGrowthRate,
		targetIso,
		view,
		useChaserAdjusted,
		useTargetAdjusted,
	]);

	const hasData =
		chaserCountry &&
		targetCountry &&
		!dataLoading &&
		!dataError &&
		chaserValueRaw != null &&
		targetValueRaw != null;

	const chartSvgRef = useRef<SVGSVGElement>(null);
	const [chartAvailable, setChartAvailable] = useState(false);
	useEffect(() => {
		setChartAvailable(chartSvgRef.current != null);
	}, [view, hasData]);
	const lastSyncedSearchRef = useRef<string | null>(null);
	useEffect(() => {
		const nextSearch = toSearchString(shareState);
		const currentSearch =
			typeof window === "undefined" ? "" : window.location.search;
		if (nextSearch === currentSearch) return;

		const handle = window.setTimeout(() => {
			if (lastSyncedSearchRef.current === nextSearch) return;
			const url = new URL(window.location.href);
			url.search = nextSearch;
			window.history.replaceState(null, "", url);
			lastSyncedSearchRef.current = nextSearch;
		}, 200);

		return () => window.clearTimeout(handle);
	}, [shareState]);

	const shareUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}/share${toSearchString(shareState)}`;
	}, [shareState]);

	const ogImageUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}/api/og.png${toSearchString(shareState)}`;
	}, [shareState]);

	const appUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}${window.location.pathname}${toSearchString(shareState)}`;
	}, [shareState]);

	const exportBasename = useMemo(() => {
		const safe = (s: string) =>
			s
				.replace(/[^a-z0-9_-]+/gi, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");
		return safe(
			`mountain-${chaserIso}-${targetIso}-${indicatorCode}-${baseYear}`,
		);
	}, [baseYear, chaserIso, indicatorCode, targetIso]);

	const countriesByIso3 = useMemo(() => {
		const map: Record<string, { name: string }> = {};
		for (const c of countries) map[c.iso_alpha3] = { name: c.name };
		return map;
	}, [countries]);

	const exportIndicator = useMemo(() => {
		return indicators.find((i) => i.code === indicatorCode) || null;
	}, [indicatorCode, indicators]);

	const onDownloadObservedCsv = useMemo(() => {
		if (!hasData) return undefined;
		return () => {
			const csv = toObservedCsv({
				state: shareState,
				indicator: exportIndicator,
				countriesByIso3,
				data,
			});
			downloadText(
				`${exportBasename}-observed.csv`,
				csv,
				"text/csv;charset=utf-8",
			);
		};
	}, [
		countriesByIso3,
		data,
		exportBasename,
		exportIndicator,
		hasData,
		shareState,
	]);

	const onDownloadProjectionCsv = useMemo(() => {
		if (!hasData) return undefined;
		return () => {
			const csv = toProjectionCsv({
				state: shareState,
				indicator: exportIndicator,
				projection,
			});
			downloadText(
				`${exportBasename}-projection.csv`,
				csv,
				"text/csv;charset=utf-8",
			);
		};
	}, [exportBasename, exportIndicator, hasData, projection, shareState]);

	const onDownloadReportJson = useMemo(() => {
		if (!hasData) return undefined;
		return () => {
			const json = toReportJson({
				state: shareState,
				indicator: exportIndicator,
				countriesByIso3,
				observed: data,
				projection,
				derived: { yearsToConvergence, convergenceYear, gap },
			});
			downloadText(
				`${exportBasename}-report.json`,
				json,
				"application/json;charset=utf-8",
			);
		};
	}, [
		convergenceYear,
		countriesByIso3,
		data,
		exportBasename,
		exportIndicator,
		gap,
		hasData,
		projection,
		shareState,
		yearsToConvergence,
	]);

	const resetToDefaults = useCallback(() => {
		setChaserIso(DEFAULT_SHARE_STATE.chaser);
		setTargetIso(DEFAULT_SHARE_STATE.target);
		setIndicatorCode(DEFAULT_SHARE_STATE.indicator);
		setChaserGrowthRate(DEFAULT_SHARE_STATE.cg);
		setTargetGrowthRate(
			DEFAULT_SHARE_STATE.tmode === "static" ? 0 : DEFAULT_SHARE_STATE.tg,
		);
		setBaseYear(DEFAULT_SHARE_STATE.baseYear);
		setView(DEFAULT_SHARE_STATE.view || "chart");
		setUseChaserAdjusted(true);
		setUseTargetAdjusted(true);
	}, []);

	if (countriesLoading) {
		return (
			<div className="min-h-screen bg-surface grain flex items-center justify-center">
				<div className="text-center">
					<div className="relative w-12 h-12 mx-auto">
						<div className="absolute inset-0 rounded-full border-2 border-surface-sunken" />
						<div className="absolute inset-0 rounded-full border-2 border-t-[var(--color-accent)] animate-spin" />
					</div>
					<p className="mt-4 text-ink-muted text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	if (countriesError) {
		return (
			<div className="min-h-screen bg-surface grain flex items-center justify-center p-4">
				<div className="text-center max-w-sm p-6 card animate-fade-in-up">
					<div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
						<svg
							className="w-5 h-5 text-red-600 dark:text-red-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<h2 className="text-lg font-display font-semibold text-ink mb-1">
						Connection Error
					</h2>
					<p className="text-ink-muted text-sm mb-4">{countriesError}</p>
					<button
						onClick={() => window.location.reload()}
						className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm rounded-lg font-medium hover:bg-[var(--color-accent-light)] transition-default"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-surface grain">
			<Toaster theme={theme} position="top-right" closeButton richColors />
			<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-10">
				{/* Header - Compact */}
				<header className="mb-6 lg:mb-8 animate-fade-in-up">
					<div className="flex items-center justify-between gap-4">
						<div>
							<h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-semibold tracking-tight text-ink">
								The Mountain to Climb
							</h1>
							<p className="mt-1 text-sm sm:text-base text-ink-muted">
								Explore economic convergence timelines between countries.
							</p>
						</div>
						<div className="flex items-center gap-2 no-print">
							<button
								type="button"
								disabled={!shareUrl}
								onClick={async () => {
									try {
										await copyTextToClipboard(shareUrl);
										toast.success("Copied share link");
									} catch {
										toast.error("Copy failed");
									}
								}}
								className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-light)] transition-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:opacity-50"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 8a3 3 0 10-6 0v8a3 3 0 006 0V8z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M11 12h2"
									/>
								</svg>
								Copy link
							</button>
							<ShareMenu
								appUrl={appUrl}
								ogImageUrl={ogImageUrl}
								chartAvailable={chartAvailable}
								disabled={countriesLoading}
								baseYear={baseYear}
								onBaseYearChange={(year) => {
									if (!Number.isFinite(year)) return;
									setBaseYear(Math.max(1950, Math.min(2100, year)));
								}}
								onReset={() => {
									resetToDefaults();
									toast.success("Reset to defaults");
								}}
								chartSvgRef={chartSvgRef}
								exportBasename={exportBasename}
								onDownloadObservedCsv={onDownloadObservedCsv}
								onDownloadProjectionCsv={onDownloadProjectionCsv}
								onDownloadReportJson={onDownloadReportJson}
							/>
							<ThemeToggle theme={theme} onToggle={toggleTheme} />
						</div>
					</div>
					<div className="print-only mt-3 text-sm text-ink-muted">
						<span className="font-medium text-ink">Chaser:</span>{" "}
						{chaserCountry?.name || chaserIso}
						{" · "}
						<span className="font-medium text-ink">Target:</span>{" "}
						{targetCountry?.name || targetIso}
						{" · "}
						<span className="font-medium text-ink">Metric:</span> {metricName}
					</div>
				</header>

				{/* Main two-column layout for large screens */}
				<div className="layout-two-col">
					{/* Left column - Main content */}
					<div className="space-y-4 sm:space-y-5">
						{/* Selectors row - more compact */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 animate-fade-in-up stagger-1 no-print">
							<CountrySelector
								label="Chaser"
								value={chaserIso}
								onChange={setChaserIso}
								countries={countries}
								excludeIso={targetIso}
								color="chaser"
							/>
							<CountrySelector
								label="Target"
								value={targetIso}
								onChange={setTargetIso}
								countries={countries}
								excludeIso={chaserIso}
								color="target"
							/>
							<MetricSelector
								value={indicatorCode}
								onChange={setIndicatorCode}
								indicators={indicators}
								disabled={indicatorsLoading}
							/>
						</div>

						{/* Loading state */}
						{dataLoading && (
							<div className="text-center py-8 animate-fade-in">
								<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised border border-surface text-sm">
									<div className="w-3 h-3 rounded-full border-2 border-t-[var(--color-accent)] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
									<span className="text-ink-muted">Loading...</span>
								</div>
							</div>
						)}

						{/* Errors */}
						{dataError && !dataLoading && (
							<div className="card p-3 animate-fade-in-up">
								<div className="flex items-center gap-2 text-sm">
									<svg
										className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
									<span className="text-ink-muted">
										Could not load {metricName}
									</span>
								</div>
							</div>
						)}

						{/* Missing data */}
						{chaserCountry &&
							targetCountry &&
							!dataLoading &&
							!dataError &&
							(chaserValueRaw == null || targetValueRaw == null) && (
								<div className="card p-3 animate-fade-in-up">
									<p className="text-ink-muted text-sm">
										No data for{" "}
										<span className="font-medium text-ink">{metricName}</span>.
									</p>
								</div>
							)}

						{/* Result summary - compact */}
						{hasData && (
							<div className="animate-fade-in-up stagger-2">
								<ResultSummary
									chaserName={chaserCountry.name}
									targetName={targetCountry.name}
									metricName={metricName}
									metricUnit={metricUnit}
									chaserValue={chaserValue}
									targetValue={targetValue}
									chaserGrowthRate={chaserGrowthRate}
									targetGrowthRate={targetGrowthRate}
									yearsToConvergence={yearsToConvergence}
									convergenceYear={convergenceYear}
									gap={gap}
									chaserIsAdjusted={
										chaserAdjustment != null && useChaserAdjusted
									}
									targetIsAdjusted={
										targetAdjustment != null && useTargetAdjusted
									}
								/>
							</div>
						)}

						{/* Chart */}
						{hasData && (
							<div className="card p-3 sm:p-4 animate-fade-in-up stagger-3">
								<div className="flex items-center justify-between mb-2">
									<h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
										Projection
									</h3>
									<div className="flex items-center gap-2">
										<div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
											<button
												type="button"
												onClick={() => setView("chart")}
												className={[
													"px-2.5 py-1 text-xs font-medium transition-default",
													view === "chart"
														? "bg-surface-raised text-ink"
														: "text-ink-muted hover:bg-surface-raised/60",
												].join(" ")}
											>
												Chart
											</button>
											<button
												type="button"
												onClick={() => setView("table")}
												className={[
													"px-2.5 py-1 text-xs font-medium transition-default",
													view === "table"
														? "bg-surface-raised text-ink"
														: "text-ink-muted hover:bg-surface-raised/60",
												].join(" ")}
											>
												Table
											</button>
										</div>
										{metricUnit && (
											<span className="text-xs text-ink-faint">
												{metricUnit}
											</span>
										)}
									</div>
								</div>
								{view === "table" ? (
									<ProjectionTable
										projection={projection}
										chaserName={chaserCountry.name}
										targetName={targetCountry.name}
										unit={metricUnit}
									/>
								) : (
									<ConvergenceChartInteractive
										svgRef={chartSvgRef}
										projection={projection}
										chaserName={chaserCountry.name}
										targetName={targetCountry.name}
										convergenceYear={convergenceYear}
										unit={metricUnit}
										theme={theme}
										chaserHasNote={chaserAdjustment != null && useChaserAdjusted}
										targetHasNote={targetAdjustment != null && useTargetAdjusted}
									/>
								)}
							</div>
						)}

						{/* Growth controls and context cards - shown below chart on mobile/tablet */}
						{hasData && (
							<div className="sidebar-mobile animate-fade-in-up stagger-4 no-print space-y-4">
								<GrowthRateControls
									chaserRate={chaserGrowthRate}
									targetRate={targetGrowthRate}
									onChaserRateChange={setChaserGrowthRate}
									onTargetRateChange={setTargetGrowthRate}
									chaserName={chaserCountry.name}
									targetName={targetCountry.name}
								/>
								{/* Country context cards on mobile */}
								{(chaserAdjustment || targetAdjustment) && (
									<div className="space-y-3">
										{chaserAdjustment && chaserValueRaw != null && (
											<CountryContextCard
												adjustment={chaserAdjustment}
												countryName={chaserCountry.name}
												originalValue={chaserValueRaw}
												adjustedValue={applyAdjustment(
													chaserValueRaw,
													chaserAdjustment,
													true,
												)}
												useAdjusted={useChaserAdjusted}
												onToggleAdjusted={setUseChaserAdjusted}
												unit={metricUnit}
												color="chaser"
											/>
										)}
										{targetAdjustment && targetValueRaw != null && (
											<CountryContextCard
												adjustment={targetAdjustment}
												countryName={targetCountry.name}
												originalValue={targetValueRaw}
												adjustedValue={applyAdjustment(
													targetValueRaw,
													targetAdjustment,
													true,
												)}
												useAdjusted={useTargetAdjusted}
												onToggleAdjusted={setUseTargetAdjusted}
												unit={metricUnit}
												color="target"
											/>
										)}
									</div>
								)}
							</div>
						)}
					</div>

					{/* Right column - Growth controls and context cards sidebar (desktop only) */}
					<aside className="sidebar-desktop">
						{hasData && (
							<div className="sticky top-6 space-y-4 animate-fade-in-up stagger-2 no-print">
								<GrowthRateControls
									chaserRate={chaserGrowthRate}
									targetRate={targetGrowthRate}
									onChaserRateChange={setChaserGrowthRate}
									onTargetRateChange={setTargetGrowthRate}
									chaserName={chaserCountry.name}
									targetName={targetCountry.name}
									compact
								/>
								{/* Country context cards on desktop */}
								{(chaserAdjustment || targetAdjustment) && (
									<div className="space-y-3">
										{chaserAdjustment && chaserValueRaw != null && (
											<CountryContextCard
												adjustment={chaserAdjustment}
												countryName={chaserCountry.name}
												originalValue={chaserValueRaw}
												adjustedValue={applyAdjustment(
													chaserValueRaw,
													chaserAdjustment,
													true,
												)}
												useAdjusted={useChaserAdjusted}
												onToggleAdjusted={setUseChaserAdjusted}
												unit={metricUnit}
												color="chaser"
											/>
										)}
										{targetAdjustment && targetValueRaw != null && (
											<CountryContextCard
												adjustment={targetAdjustment}
												countryName={targetCountry.name}
												originalValue={targetValueRaw}
												adjustedValue={applyAdjustment(
													targetValueRaw,
													targetAdjustment,
													true,
												)}
												useAdjusted={useTargetAdjusted}
												onToggleAdjusted={setUseTargetAdjusted}
												unit={metricUnit}
												color="target"
											/>
										)}
									</div>
								)}
							</div>
						)}
					</aside>
				</div>

				{/* Footer - minimal */}
				<footer className="mt-10 lg:mt-12 pt-6 border-t border-surface text-center">
					<p className="text-xs text-ink-faint">
						Data:{" "}
						<a
							href="https://data.worldbank.org/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[var(--color-accent)] hover:underline"
						>
							World Bank
						</a>
						{" · "}
						Inspired by{" "}
						<a
							href="https://oliverwkim.com/The-Mountain-To-Climb/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[var(--color-accent)] hover:underline"
						>
							Oliver Kim
						</a>
						{" · "}
						{countries.length} countries
					</p>
				</footer>
			</div>
		</div>
	);
}
