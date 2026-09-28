import { useQuery } from "@tanstack/react-query";
import { loadSeries } from "../lib/staticData";
import { seriesForCountries } from "../lib/staticDataFormat";

interface DataPoint {
  year: number;
  value: number;
}

interface IndicatorInfo {
  code: string;
  name: string;
  unit: string | null;
  source?: string | null;
  source_code?: string | null;
}

interface UseCountryDataParams {
  countries: string[];
  indicator: string;
  enabled?: boolean;
  invalidIndicator?: boolean;
}

async function fetchCountryData(params: { countries: string[]; indicator: string }) {
  const series = await loadSeries(params.indicator);
  if (!series) throw new Error("HTTP 404");
  return {
    data: seriesForCountries(series, params.countries, { startYear: 1990 }) as Record<
      string,
      DataPoint[]
    >,
    indicator: series.indicator as IndicatorInfo,
  };
}

export function useCountryData({
  countries,
  indicator,
  enabled = true,
  invalidIndicator = false,
}: UseCountryDataParams) {
  const countriesKey = countries.join(",");
  const queryEnabled = enabled && countries.length > 0 && Boolean(indicator);

  const query = useQuery({
    queryKey: ["country-data", countriesKey, indicator],
    queryFn: () => fetchCountryData({ countries, indicator }),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: queryEnabled,
  });

  const data = query.data?.data ?? {};
  const indicatorInfo = query.data?.indicator ?? null;

  const queryError = query.error instanceof Error ? query.error.message : null;
  const resolvedError =
    !enabled && invalidIndicator && indicator ? "INDICATOR_NOT_FOUND" : queryError;

  // Get the latest value for a country
  const getLatestValue = (iso: string): number | null => {
    const countryData = data[iso];
    if (!countryData || countryData.length === 0) return null;

    let latest = countryData[0];
    for (const point of countryData) if (point.year > latest.year) latest = point;
    return latest.value;
  };

  return {
    data: enabled ? data : {},
    indicator: enabled ? indicatorInfo : null,
    loading: queryEnabled ? query.isLoading || query.isFetching : false,
    error: resolvedError,
    hasLoaded: queryEnabled ? query.isFetched : false,
    getLatestValue,
  };
}
