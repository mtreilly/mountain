import { useQuery } from "@tanstack/react-query";

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

async function fetchCountryData(params: {
  countriesKey: string;
  indicator: string;
  signal?: AbortSignal;
}) {
  const qs = new URLSearchParams({
    countries: params.countriesKey,
    start_year: "1990",
  });

  const res = await fetch(`/api/data/${params.indicator}?${qs}`, { signal: params.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as {
    data?: Record<string, DataPoint[]>;
    indicator?: IndicatorInfo | null;
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
    queryFn: ({ signal }) => fetchCountryData({ countriesKey, indicator, signal }),
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
