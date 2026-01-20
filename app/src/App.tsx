import { useState } from "react";
import { CountrySelector } from "./components/CountrySelector";
import { GrowthRateControls } from "./components/GrowthRateControls";
import { ConvergenceChart } from "./components/ConvergenceChart";
import { ResultSummary } from "./components/ResultSummary";
import { MetricSelector } from "./components/MetricSelector";
import { useConvergence } from "./hooks/useConvergence";
import { useCountries } from "./hooks/useCountries";
import { useCountryData } from "./hooks/useCountryData";
import { ThemeToggle } from "./components/ThemeToggle";
import { useTheme } from "./hooks/useTheme";
import { useIndicators } from "./hooks/useIndicators";

export default function App() {
  const [chaserIso, setChaserIso] = useState("NGA");
  const [targetIso, setTargetIso] = useState("IRL");
  const [indicatorCode, setIndicatorCode] = useState("GDP_PCAP_PPP");
  const { theme, toggleTheme } = useTheme();

  // Fetch countries from API
  const { countries, loading: countriesLoading, error: countriesError } = useCountries();
  const { indicators, loading: indicatorsLoading } = useIndicators();

  // Fetch GDP data for selected countries
  const {
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

  const chaserValue = chaserValueRaw ?? 1;
  const targetValue = targetValueRaw ?? 2;

  const {
    chaserGrowthRate,
    setChaserGrowthRate,
    targetGrowthRate,
    setTargetGrowthRate,
    yearsToConvergence,
    convergenceYear,
    projection,
    gap,
  } = useConvergence({
    chaserValue,
    targetValue,
    initialChaserGrowthRate: 0.035,
    initialTargetGrowthRate: 0.015,
    baseYear: 2023,
  });

  if (countriesLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-300">Loading countries...</p>
        </div>
      </div>
    );
  }

  if (countriesError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Connection Error
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300">Failed to load data: {countriesError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                The Mountain to Climb
              </h1>
              <p className="mt-2 text-sm md:text-base text-zinc-600 dark:text-zinc-300 max-w-2xl">
                How long would it take for one country to match another? Explore convergence
                timelines with simple assumptions.
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* Country selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <CountrySelector
            label="Chaser country"
            value={chaserIso}
            onChange={setChaserIso}
            countries={countries}
            excludeIso={targetIso}
            color="chaser"
          />
          <CountrySelector
            label="Target country"
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

        {/* Loading indicator for data */}
        {dataLoading && (
          <div className="text-center py-8">
            <div className="animate-pulse text-zinc-500 dark:text-zinc-400">Loading data...</div>
          </div>
        )}

        {/* Data error */}
        {dataError && !dataLoading && (
          <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            Could not load data for <span className="font-medium">{metricName}</span>: {dataError}
          </div>
        )}

        {/* Missing data indicator */}
        {chaserCountry && targetCountry && !dataLoading && !dataError && (chaserValueRaw == null || targetValueRaw == null) && (
          <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            No recent data available for <span className="font-medium">{metricName}</span> for one or
            both selected countries.
          </div>
        )}

        {/* Main content */}
        {chaserCountry && targetCountry && !dataLoading && !dataError && chaserValueRaw != null && targetValueRaw != null && (
          <div className="space-y-8">
            {/* Result summary */}
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
            />

            {/* Chart */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-200 uppercase tracking-wide mb-1 text-center">
                Projected {metricName}
              </h3>
              {metricUnit && (
                <p className="text-center text-xs text-gray-500 dark:text-zinc-400 mb-4">
                  Unit: {metricUnit}
                </p>
              )}
              <div className="flex justify-center">
                <ConvergenceChart
                  projection={projection}
                  chaserName={chaserCountry.name}
                  targetName={targetCountry.name}
                  convergenceYear={convergenceYear}
                  unit={metricUnit}
                />
              </div>
            </div>

            {/* Growth rate controls */}
            <GrowthRateControls
              chaserRate={chaserGrowthRate}
              targetRate={targetGrowthRate}
              onChaserRateChange={setChaserGrowthRate}
              onTargetRateChange={setTargetGrowthRate}
              chaserName={chaserCountry.name}
              targetName={targetCountry.name}
            />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>
            Data from{" "}
            <a
              href="https://data.worldbank.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              World Bank Open Data
            </a>
            {" · "}
            Inspired by{" "}
            <a
              href="https://oliverwkim.com/The-Mountain-To-Climb/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Oliver Kim
            </a>
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {countries.length} countries · {metricName}
            {metricUnit ? ` (${metricUnit})` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
