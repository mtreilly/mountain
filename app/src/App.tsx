import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AppErrorScreen } from "./components/AppErrorScreen";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { CitationPanel } from "./components/CitationPanel";
import { CountryContextCard } from "./components/CountryContextCard";
import { DataStates } from "./components/DataStates";
import { EmbedView } from "./components/EmbedView";
import { ExportModal } from "./components/ExportModal";
import { GrowthSidebarContent } from "./components/GrowthSidebarContent";
import { ShareCardModal } from "./components/ShareCardModal";
import { ThreadGeneratorModal } from "./components/ThreadGeneratorModal";
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
import { ALL_TL2_REGIONS, getRegionDataSeries } from "./lib/oecdRegions";
import {
	toRegionalObservedCsv,
	toRegionalProjectionCsv,
	toRegionalReportJson,
} from "./lib/regionsDataExport";
import type { HeadlineData } from "./lib/headlineGenerator";
import type { ShareCardParams } from "./lib/shareCardSvg";
import {
	DEFAULT_SHARE_STATE,
	parseEmbedParams,
	parseShareStateFromSearch,
	type ShareState,
	toSyncedSearchString,
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

	// Parse embed parameters (separate from share state)
	const embedParams = useMemo(() => {
		if (typeof window === "undefined")
			return { embed: false, interactive: true, embedTheme: "auto" as const, height: 400 };
		return parseEmbedParams(window.location.search);
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
	const [isCitationPanelOpen, setIsCitationPanelOpen] = useState(false);
	const [isThreadGeneratorOpen, setIsThreadGeneratorOpen] = useState(false);
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
		unit: metricUnit,
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
	const lastSyncedSearchRef = useRef<string | null>(null);
	useEffect(() => {
		// Preserve embed-mode parameters in the URL so embed links remain stable.
		const nextSearch = toSyncedSearchString(shareState, embedParams);
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
	}, [embedParams, shareState]);

	// Keyboard shortcut: Cmd/Ctrl+Shift+C opens citation panel
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault();
				setIsCitationPanelOpen(true);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	const shareUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}/share${toSearchString(shareState)}`;
	}, [shareState]);

	const appUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}${window.location.pathname}${toSearchString(shareState)}`;
	}, [shareState]);

	const ogImageUrl = useMemo(() => {
		if (typeof window === "undefined") return "";
		return `${window.location.origin}/api/og.png${toSearchString(shareState)}`;
	}, [shareState]);

	const citationIndicator =
		comparisonMode !== "regions"
			? selectedIndicator
			: {
					code: "GDP_PCAP_PPP",
					name: "GDP per capita (USD PPP)",
					unit: "USD PPP",
					source: "OECD",
				};

	const exportBasename = useMemo(() => {
		const safe = (s: string) =>
			s
				.replace(/[^a-z0-9_-]+/gi, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");
		return safe(
			comparisonMode === "regions"
				? `mountain-${chaserRegionCode}-${targetRegionCode}-GDP_PCAP_PPP-${baseYear}`
				: `mountain-${chaserIso}-${targetIso}-${indicatorCode}-${baseYear}`,
		);
	}, [
		baseYear,
		chaserIso,
		chaserRegionCode,
		comparisonMode,
		indicatorCode,
		targetIso,
		targetRegionCode,
	]);

	const headlineData: HeadlineData | undefined =
		comparisonMode !== "countries" || !chaserCountry || !targetCountry
			? undefined
			: {
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

	const shareCardParams: ShareCardParams | null = !hasData
		? null
		: {
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
				siteUrl:
					typeof window !== "undefined" ? window.location.origin : undefined,
				dataSource: comparisonMode === "regions" ? "OECD" : "World Bank",
			};

	// Historical data for thread generator
	const historicalData = useMemo(() => {
		if (comparisonMode !== "countries" || !data) return null;

		const chaserSeries = data[chaserIso] || [];
		const targetSeries = data[targetIso] || [];

		const getEarliest = (series: Array<{ year: number; value: number }>) => {
			if (!series.length) return null;
			const sorted = [...series].sort((a, b) => a.year - b.year);
			return { year: sorted[0].year, value: sorted[0].value };
		};

		const getLatest = (series: Array<{ year: number; value: number }>) => {
			if (!series.length) return null;
			const sorted = [...series].sort((a, b) => b.year - a.year);
			return { year: sorted[0].year, value: sorted[0].value };
		};

		return {
			chaserStart: getEarliest(chaserSeries),
			chaserCurrent: getLatest(chaserSeries),
			targetStart: getEarliest(targetSeries),
			targetCurrent: getLatest(targetSeries),
		};
	}, [comparisonMode, data, chaserIso, targetIso]);

	// Simplified implications data for thread generator (only when GDP per capita is selected)
	const implicationsData =
		comparisonMode !== "countries" ||
		indicatorCode !== "GDP_PCAP_PPP" ||
		!chaserValue ||
		!yearsToConvergence
			? null
			: (() => {
					const gdpFuture =
						chaserValue * Math.pow(1 + chaserGrowthRate, impHorizonYears);
					return {
						electricityDeltaTWh: null,
						nuclearPlants: null,
						urbanDeltaPersons: null,
						homesNeeded: null,
						co2DeltaMt: null,
						gdpCurrent: chaserValue,
						gdpFuture,
					};
				})();

	const countriesByIso3 = useMemo(() => {
		const map: Record<string, { name: string }> = {};
		for (const c of countries) map[c.iso_alpha3] = { name: c.name };
		return map;
	}, [countries]);

	const exportIndicator = useMemo(() => {
		return indicators.find((i) => i.code === indicatorCode) || null;
	}, [indicatorCode, indicators]);

	const onDownloadObservedCsv = !hasData
		? undefined
		: comparisonMode === "regions"
			? (() => {
					const chaserRegion = regionalConvergence.chaserRegion;
					const targetRegion = regionalConvergence.targetRegion;
					if (!chaserRegion || !targetRegion) return undefined;

					return () => {
						const csv = toRegionalObservedCsv({
							state: shareState,
							observed: {
								[chaserRegion.code]: getRegionDataSeries(chaserRegion.code).map((p) => ({
									year: p.year,
									value: p.gdpPerCapita,
								})),
								[targetRegion.code]: getRegionDataSeries(targetRegion.code).map((p) => ({
									year: p.year,
									value: p.gdpPerCapita,
								})),
							},
							chaserRegion,
							targetRegion,
						});
						const filename = `${exportBasename}-observed.csv`;
						downloadText(filename, csv, "text/csv;charset=utf-8");
						return filename;
					};
				})()
			: () => {
					const csv = toObservedCsv({
						state: shareState,
						indicator: exportIndicator,
						countriesByIso3,
						data,
					});
					const filename = `${exportBasename}-observed.csv`;
					downloadText(filename, csv, "text/csv;charset=utf-8");
					return filename;
				};

	const onDownloadProjectionCsv = !hasData
		? undefined
		: comparisonMode === "regions"
			? (() => {
					const chaserRegion = regionalConvergence.chaserRegion;
					const targetRegion = regionalConvergence.targetRegion;
					if (!chaserRegion || !targetRegion) return undefined;

					return () => {
						const csv = toRegionalProjectionCsv({
							state: shareState,
							projection,
							chaserRegion,
							targetRegion,
						});
						const filename = `${exportBasename}-projection.csv`;
						downloadText(filename, csv, "text/csv;charset=utf-8");
						return filename;
					};
				})()
			: () => {
					const csv = toProjectionCsv({
						state: shareState,
						indicator: exportIndicator,
						projection,
					});
					const filename = `${exportBasename}-projection.csv`;
					downloadText(filename, csv, "text/csv;charset=utf-8");
					return filename;
				};

	const onDownloadReportJson = !hasData
		? undefined
		: comparisonMode === "regions"
			? (() => {
					const chaserRegion = regionalConvergence.chaserRegion;
					const targetRegion = regionalConvergence.targetRegion;
					if (!chaserRegion || !targetRegion) return undefined;

					return () => {
						const json = toRegionalReportJson({
							state: shareState,
							observed: {
								[chaserRegion.code]: getRegionDataSeries(chaserRegion.code),
								[targetRegion.code]: getRegionDataSeries(targetRegion.code),
							},
							projection,
							derived: { yearsToConvergence, convergenceYear, gap: gap ?? 0 },
							chaserRegion,
							targetRegion,
						});
						const filename = `${exportBasename}-report.json`;
						downloadText(filename, json, "application/json;charset=utf-8");
						return filename;
					};
				})()
			: () => {
					const json = toReportJson({
						state: shareState,
						indicator: exportIndicator,
						countriesByIso3,
						observed: data,
						projection,
						derived: { yearsToConvergence, convergenceYear, gap: gap ?? 0 },
					});
					const filename = `${exportBasename}-report.json`;
					downloadText(filename, json, "application/json;charset=utf-8");
					return filename;
				};

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

	// Embed mode: render minimal chart-only view
	if (embedParams.embed && hasData) {
		return (
			<EmbedView
				shareState={shareState}
				embedParams={embedParams}
				chaserName={displayChaserName}
				targetName={displayTargetName}
				projection={projection}
				convergenceYear={convergenceYear}
				yearsToConvergence={yearsToConvergence}
				milestones={milestones}
				unit={displayMetricUnit}
				resolvedTheme={theme}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-surface grain">
			<Toaster theme={theme} position="bottom-right" closeButton richColors />
				<div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
				{/* Header - Compact */}
				<AppHeader
					comparisonMode={comparisonMode}
					shareUrl={shareUrl}
					headlineData={headlineData}
					onOpenExportModal={() => setIsExportModalOpen(true)}
					onOpenShareCardModal={() => setIsShareCardModalOpen(true)}
					onOpenCitationPanel={() => setIsCitationPanelOpen(true)}
					onOpenThreadGenerator={() => setIsThreadGeneratorOpen(true)}
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
					<div className="min-w-0 space-y-2.5 sm:space-y-3">
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

				<AppFooter
					comparisonMode={comparisonMode}
					countriesCount={countries.length}
					regionsCount={ALL_TL2_REGIONS.length}
				/>
			</div>

			{/* Export Modal */}
			<ExportModal
				isOpen={isExportModalOpen}
				onClose={() => setIsExportModalOpen(false)}
				baseYear={baseYear}
				onBaseYearChange={(year) => {
					if (!Number.isFinite(year)) return;
					setBaseYear(Math.max(1950, Math.min(2100, year)));
				}}
				onReset={resetToDefaults}
				comparisonMode={comparisonMode}
				onDownloadObservedCsv={onDownloadObservedCsv}
				onDownloadProjectionCsv={onDownloadProjectionCsv}
				onDownloadReportJson={onDownloadReportJson}
				shareState={shareState}
				ogImageUrl={ogImageUrl}
				onOpenCitationPanel={() => setIsCitationPanelOpen(true)}
			/>

			{/* Share Card Modal */}
			<ShareCardModal
				isOpen={isShareCardModalOpen}
				onClose={() => setIsShareCardModalOpen(false)}
				shareCardParams={shareCardParams}
			/>

			{/* Citation Panel */}
			<CitationPanel
				isOpen={isCitationPanelOpen}
				onClose={() => setIsCitationPanelOpen(false)}
				shareState={shareState}
				indicator={citationIndicator}
				chaserName={displayChaserName}
				targetName={displayTargetName}
				/>

				{/* Thread Generator Modal */}
				{isThreadGeneratorOpen && shareCardParams && (
					<ThreadGeneratorModal
						isOpen
						onClose={() => setIsThreadGeneratorOpen(false)}
						shareCardParams={shareCardParams}
						historicalData={historicalData}
						implicationsData={implicationsData}
						baseYear={baseYear}
						horizonYears={impHorizonYears}
						appUrl={appUrl}
					/>
				)}
			</div>
		);
	}
