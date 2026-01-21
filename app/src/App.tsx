import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AppErrorScreen } from "./components/AppErrorScreen";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { CountryContextCard } from "./components/CountryContextCard";
import { DataStates } from "./components/DataStates";
import { ExportModal } from "./components/ExportModal";
import { GrowthSidebarContent } from "./components/GrowthSidebarContent";
import { ShareCardModal } from "./components/ShareCardModal";
import { GrowthRateBar } from "./components/GrowthRateBar";
import { ImplicationsPanel } from "./components/ImplicationsPanel";
import { ProjectionCard } from "./components/ProjectionCard";
import { RegionalImplicationsPanel } from "./components/RegionalImplicationsPanel";
import { ResultSummary } from "./components/ResultSummary";
import { SelectorsPanel } from "./components/SelectorsPanel";
import { useConvergence } from "./hooks/useConvergence";
import { useCountries } from "./hooks/useCountries";
import { useCountryData } from "./hooks/useCountryData";
import { useIndicators } from "./hooks/useIndicators";
import { useRegionalConvergence } from "./hooks/useOECDRegions";
import { useTheme } from "./hooks/useTheme";
import { applyAdjustment, getAdjustment } from "./lib/countryAdjustments";
import { toObservedCsv, toProjectionCsv, toReportJson } from "./lib/dataExport";
import { downloadText } from "./lib/download";
import type { HeadlineData } from "./lib/headlineGenerator";
import type { ShareCardParams } from "./lib/shareCardSvg";
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

	const [comparisonMode, setComparisonMode] = useState<"countries" | "regions">(
		initialShareState.mode ?? "countries"
	);
	const [chaserIso, setChaserIso] = useState(initialShareState.chaser);
	const [targetIso, setTargetIso] = useState(initialShareState.target);
	const [chaserRegionCode, setChaserRegionCode] = useState(initialShareState.cr ?? "UKC");
	const [targetRegionCode, setTargetRegionCode] = useState(initialShareState.tr ?? "UKI");
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
	const [catchUpYears, setCatchUpYears] = useState(
		initialShareState.goal ?? 25,
	);
	const [showMilestones, setShowMilestones] = useState(
		initialShareState.ms ?? true,
	);
	const [impTemplate, setImpTemplate] = useState<
		"china" | "us" | "eu"
	>((initialShareState.tpl as "china" | "us" | "eu" | undefined) ?? "china");
	const [impHorizonYears, setImpHorizonYears] = useState(
		initialShareState.ih ?? 25,
	);
	const [isExportModalOpen, setIsExportModalOpen] = useState(false);
	const [isShareCardModalOpen, setIsShareCardModalOpen] = useState(false);
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

	const countryConvergence = useConvergence({
		chaserValue,
		targetValue,
		chaserGrowthRate,
		targetGrowthRate,
		baseYear,
	});

	// Regional convergence (OECD data)
	const regionalConvergence = useRegionalConvergence({
		chaserCode: chaserRegionCode,
		targetCode: targetRegionCode,
		chaserGrowthRate,
		targetGrowthRate,
		baseYear,
	});

	// Use the appropriate convergence data based on mode
	const { yearsToConvergence, convergenceYear, projection, gap, milestones } =
		comparisonMode === "regions"
			? {
					yearsToConvergence: regionalConvergence.yearsToConvergence,
					convergenceYear: regionalConvergence.convergenceYear,
					projection: regionalConvergence.projection,
					gap: regionalConvergence.gap,
					milestones: regionalConvergence.milestones,
				}
			: countryConvergence;

	// Computed display values based on mode
	const displayChaserName =
		comparisonMode === "regions"
			? regionalConvergence.chaserRegion?.name || chaserRegionCode
			: chaserCountry?.name || chaserIso;
	const displayTargetName =
		comparisonMode === "regions"
			? regionalConvergence.targetRegion?.name || targetRegionCode
			: targetCountry?.name || targetIso;
	const displayChaserValue =
		comparisonMode === "regions"
			? regionalConvergence.chaserValue
			: chaserValue;
	const displayTargetValue =
		comparisonMode === "regions"
			? regionalConvergence.targetValue
			: targetValue;
	const displayMetricName =
		comparisonMode === "regions" ? "GDP per capita (USD PPP)" : metricName;
	const displayMetricUnit =
		comparisonMode === "regions" ? "USD PPP" : metricUnit;

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
			goal: catchUpYears,
			ms: showMilestones,
			tpl: impTemplate,
			ih: impHorizonYears,
			mode: comparisonMode,
			cr: chaserRegionCode,
			tr: targetRegionCode,
		};
	}, [
		baseYear,
		catchUpYears,
		chaserGrowthRate,
		chaserIso,
		chaserRegionCode,
		comparisonMode,
		indicatorCode,
		impHorizonYears,
		impTemplate,
		showMilestones,
		targetGrowthRate,
		targetIso,
		targetRegionCode,
		view,
		useChaserAdjusted,
		useTargetAdjusted,
	]);

	const hasCountryData =
		chaserCountry &&
		targetCountry &&
		!dataLoading &&
		!dataError &&
		chaserValueRaw != null &&
		targetValueRaw != null;

	const hasRegionalData = regionalConvergence.hasData;

	const hasData =
		comparisonMode === "regions" ? hasRegionalData : hasCountryData;

	const showImplications = hasData && indicatorCode === "GDP_PCAP_PPP";

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

	const headlineData: HeadlineData | undefined = useMemo(() => {
		if (comparisonMode !== "countries") return undefined;
		if (!chaserCountry || !targetCountry) return undefined;
		return {
			chaserName: chaserCountry.name,
			chaserIso,
			targetName: targetCountry.name,
			targetIso,
			metricName,
			chaserGrowthRate,
			targetGrowthRate,
			yearsToConvergence: countryConvergence.yearsToConvergence,
			convergenceYear: countryConvergence.convergenceYear,
			gap: countryConvergence.gap,
			appUrl,
		};
	}, [
		comparisonMode,
		chaserCountry,
		targetCountry,
		chaserIso,
		targetIso,
		metricName,
		chaserGrowthRate,
		targetGrowthRate,
		countryConvergence.convergenceYear,
		countryConvergence.gap,
		countryConvergence.yearsToConvergence,
		appUrl,
	]);

	const shareCardParams: ShareCardParams | null = useMemo(() => {
		if (!hasData) return null;
		return {
			chaserName: displayChaserName,
			targetName: displayTargetName,
			chaserCode: comparisonMode === "regions" ? chaserRegionCode : chaserIso,
			targetCode: comparisonMode === "regions" ? targetRegionCode : targetIso,
			metricLabel: displayMetricName,
			metricUnit: displayMetricUnit,
			projection,
			convergenceYear,
			yearsToConvergence,
			currentGap: gap ?? 1,
			chaserGrowth: chaserGrowthRate,
			targetGrowth: targetGrowthRate,
			targetMode: targetGrowthRate === 0 ? "static" : "growing",
			theme,
			siteUrl: typeof window !== "undefined" ? window.location.origin : undefined,
			dataSource: comparisonMode === "regions" ? "OECD" : "World Bank",
		};
	}, [
		hasData,
		displayChaserName,
		displayTargetName,
		comparisonMode,
		chaserRegionCode,
		chaserIso,
		targetRegionCode,
		targetIso,
		displayMetricName,
		displayMetricUnit,
		projection,
		convergenceYear,
		yearsToConvergence,
		gap,
		chaserGrowthRate,
		targetGrowthRate,
		theme,
	]);

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
					derived: { yearsToConvergence, convergenceYear, gap: gap ?? 0 },
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
		setComparisonMode(DEFAULT_SHARE_STATE.mode ?? "countries");
		setChaserRegionCode(DEFAULT_SHARE_STATE.cr ?? "UKC");
		setTargetRegionCode(DEFAULT_SHARE_STATE.tr ?? "UKI");
	}, []);

	const swapCountries = useCallback(() => {
		setChaserIso(targetIso);
		setTargetIso(chaserIso);
		setChaserGrowthRate(targetGrowthRate);
		setTargetGrowthRate(chaserGrowthRate);
		setUseChaserAdjusted(useTargetAdjusted);
		setUseTargetAdjusted(useChaserAdjusted);
	}, [
		chaserIso,
		targetIso,
		chaserGrowthRate,
		targetGrowthRate,
		useChaserAdjusted,
		useTargetAdjusted,
	]);

	const swapRegions = useCallback(() => {
		const temp = chaserRegionCode;
		setChaserRegionCode(targetRegionCode);
		setTargetRegionCode(temp);
	}, [chaserRegionCode, targetRegionCode]);

	const contextCards =
		comparisonMode === "countries" &&
		chaserCountry != null &&
		targetCountry != null &&
		(chaserAdjustment || targetAdjustment) ? (
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
		) : null;

	if (countriesLoading) {
		return <AppLoadingScreen />;
	}

	if (countriesError) {
		return (
			<AppErrorScreen
				message={countriesError}
				onRetry={() => window.location.reload()}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-surface grain">
			<Toaster theme={theme} position="top-right" closeButton richColors />
				<div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-10">
				{/* Header - Compact */}
				<AppHeader
					comparisonMode={comparisonMode}
					shareUrl={shareUrl}
					chartAvailable={chartAvailable}
					chartSvgRef={chartSvgRef}
					headlineData={headlineData}
					onOpenExportModal={() => setIsExportModalOpen(true)}
					onOpenShareCardModal={() => setIsShareCardModalOpen(true)}
					shareCardAvailable={shareCardParams !== null}
					theme={theme}
					onToggleTheme={toggleTheme}
					printChaser={displayChaserName}
					printTarget={displayTargetName}
					printMetric={displayMetricName}
					disableShareActions={countriesLoading}
				/>

				{/* Main two-column layout for large screens */}
				<div className="layout-two-col">
					{/* Left column - Main content */}
						<div className="space-y-3 sm:space-y-4">
						{/* Mode toggle and Selectors */}
							<SelectorsPanel
								comparisonMode={comparisonMode}
								onComparisonModeChange={setComparisonMode}
								countries={countries}
							indicators={indicators}
							indicatorsLoading={indicatorsLoading}
							chaserIso={chaserIso}
							targetIso={targetIso}
							onChaserIsoChange={setChaserIso}
							onTargetIsoChange={setTargetIso}
							onSwapCountries={swapCountries}
							indicatorCode={indicatorCode}
							onIndicatorCodeChange={setIndicatorCode}
							chaserRegionCode={chaserRegionCode}
							targetRegionCode={targetRegionCode}
							onChaserRegionCodeChange={setChaserRegionCode}
								onTargetRegionCodeChange={setTargetRegionCode}
								onSwapRegions={swapRegions}
							/>
							<div className="hidden lg:block no-print">
								<GrowthRateBar
									chaserName={displayChaserName}
									targetName={displayTargetName}
									chaserRate={chaserGrowthRate}
									targetRate={targetGrowthRate}
									onChaserRateChange={setChaserGrowthRate}
									onTargetRateChange={setTargetGrowthRate}
								/>
							</div>
							<DataStates
								loading={dataLoading}
								error={dataError}
								metricName={metricName}
							showMissingData={
								comparisonMode === "countries" &&
								chaserCountry != null &&
								targetCountry != null &&
								(chaserValueRaw == null || targetValueRaw == null)
							}
						/>

						{/* Result summary - compact */}
						{hasData && (
							<div className="animate-fade-in-up stagger-2">
								<ResultSummary
									chaserName={displayChaserName}
									targetName={displayTargetName}
									metricName={displayMetricName}
									metricUnit={displayMetricUnit}
									chaserValue={displayChaserValue ?? 0}
									targetValue={displayTargetValue ?? 0}
									chaserGrowthRate={chaserGrowthRate}
									targetGrowthRate={targetGrowthRate}
									yearsToConvergence={yearsToConvergence}
									convergenceYear={convergenceYear}
									gap={gap ?? 0}
									chaserIsAdjusted={
										comparisonMode === "countries" &&
										chaserAdjustment != null &&
										useChaserAdjusted
									}
									targetIsAdjusted={
										comparisonMode === "countries" &&
										targetAdjustment != null &&
										useTargetAdjusted
									}
									milestones={showMilestones ? milestones : []}
								/>
							</div>
						)}

						{/* Chart */}
						{hasData && (
							<ProjectionCard
								view={view}
								onViewChange={setView}
								showMilestones={showMilestones}
								onShowMilestonesChange={setShowMilestones}
								projection={projection}
								chaserName={displayChaserName}
								targetName={displayTargetName}
								convergenceYear={convergenceYear}
								milestones={milestones}
								unit={displayMetricUnit}
								theme={theme}
								svgRef={chartSvgRef}
								chaserHasNote={
									comparisonMode === "countries" &&
									chaserAdjustment != null &&
									useChaserAdjusted
								}
								targetHasNote={
									comparisonMode === "countries" &&
									targetAdjustment != null &&
									useTargetAdjusted
								}
							/>
						)}

						{/* Implications / context (main column) */}
						{showImplications && comparisonMode === "countries" && (
							<div className="animate-fade-in-up stagger-4">
								<ImplicationsPanel
									chaserIso={chaserIso}
									chaserName={displayChaserName}
									gdpCurrent={chaserValue}
									chaserGrowthRate={chaserGrowthRate}
									baseYear={baseYear}
									horizonYears={impHorizonYears}
									onHorizonYearsChange={setImpHorizonYears}
									template={impTemplate}
									onTemplateChange={setImpTemplate}
									enabled={showImplications}
								/>
							</div>
						)}
						{comparisonMode === "regions" && (
							<div className="animate-fade-in-up stagger-4">
								<RegionalImplicationsPanel
									chaserCode={chaserRegionCode}
									chaserName={displayChaserName}
									gdpCurrent={displayChaserValue}
									chaserGrowthRate={chaserGrowthRate}
									baseYear={baseYear}
									horizonYears={impHorizonYears}
									onHorizonYearsChange={setImpHorizonYears}
								/>
							</div>
						)}

						{/* Growth controls and context cards - shown below chart on mobile/tablet */}
						{hasData && (
							<div className="sidebar-mobile animate-fade-in-up stagger-4 no-print space-y-4">
								<GrowthSidebarContent
									chaserName={displayChaserName}
									targetName={displayTargetName}
									chaserValue={displayChaserValue ?? 0}
									targetValue={displayTargetValue ?? 0}
									chaserGrowthRate={chaserGrowthRate}
									targetGrowthRate={targetGrowthRate}
									onChaserGrowthRateChange={setChaserGrowthRate}
									onTargetGrowthRateChange={setTargetGrowthRate}
									catchUpYears={catchUpYears}
									onCatchUpYearsChange={setCatchUpYears}
									contextCards={contextCards}
								/>
							</div>
						)}
					</div>

					{/* Right column - Growth controls and context cards sidebar (desktop only) */}
					<aside className="sidebar-desktop">
						{hasData && (
							<div className="sticky top-6 space-y-4 animate-fade-in-up stagger-2 no-print">
								<GrowthSidebarContent
									compact
									chaserName={displayChaserName}
									targetName={displayTargetName}
									chaserValue={displayChaserValue ?? 0}
									targetValue={displayTargetValue ?? 0}
									chaserGrowthRate={chaserGrowthRate}
									targetGrowthRate={targetGrowthRate}
									onChaserGrowthRateChange={setChaserGrowthRate}
									onTargetGrowthRateChange={setTargetGrowthRate}
									catchUpYears={catchUpYears}
									onCatchUpYearsChange={setCatchUpYears}
									contextCards={contextCards}
									showControls={false}
								/>
							</div>
						)}
					</aside>
				</div>

				<AppFooter countriesCount={countries.length} />
			</div>

			{/* Export Modal */}
			<ExportModal
				isOpen={isExportModalOpen}
				onClose={() => setIsExportModalOpen(false)}
				chartSvgRef={chartSvgRef}
				chartAvailable={chartAvailable}
				ogImageUrl={ogImageUrl}
				exportBasename={exportBasename}
				baseYear={baseYear}
				onBaseYearChange={(year) => {
					if (!Number.isFinite(year)) return;
					setBaseYear(Math.max(1950, Math.min(2100, year)));
				}}
				onReset={resetToDefaults}
				onDownloadObservedCsv={onDownloadObservedCsv}
				onDownloadProjectionCsv={onDownloadProjectionCsv}
				onDownloadReportJson={onDownloadReportJson}
				onOpenShareCardModal={() => setIsShareCardModalOpen(true)}
				shareCardAvailable={shareCardParams !== null}
			/>

			{/* Share Card Modal */}
			<ShareCardModal
				isOpen={isShareCardModalOpen}
				onClose={() => setIsShareCardModalOpen(false)}
				shareCardParams={shareCardParams}
			/>
		</div>
	);
}
