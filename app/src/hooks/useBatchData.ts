import { useQuery } from "@tanstack/react-query";
import type { Indicator } from "../types";

interface BatchSeriesPoint {
  year: number;
  value: number;
  source_vintage?: string | null;
}

type BatchSeries = Record<string, Record<string, BatchSeriesPoint[]>>; // indicator -> iso -> points

async function fetchBatchData(params: {
  countriesKey: string;
  indicatorsKey: string;
  startYear: number;
  endYear?: number;
  includeSourceVintage: boolean;
  signal?: AbortSignal;
}) {
  const qs = new URLSearchParams({
    countries: params.countriesKey,
    indicators: params.indicatorsKey,
    start_year: String(params.startYear),
  });
  if (params.endYear != null) qs.set("end_year", String(params.endYear));
  if (params.includeSourceVintage) qs.set("include_source_vintage", "1");

  const res = await fetch(`/api/batch-data?${qs}`, { signal: params.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as {
    data?: BatchSeries;
    indicators?: Record<string, Indicator>;
  };
}

export function useBatchData(params: {
  countries: string[];
  indicators: string[];
  startYear?: number;
  endYear?: number;
  enabled?: boolean;
  includeSourceVintage?: boolean;
}) {
  const {
    countries,
    indicators,
    startYear = 1990,
    endYear,
    enabled = true,
    includeSourceVintage = false,
  } = params;

  const countriesKey = countries.join(",");
  const indicatorsKey = indicators.join(",");
  const queryEnabled = enabled && countries.length > 0 && indicators.length > 0;

  const query = useQuery({
    queryKey: ["batch-data", countriesKey, indicatorsKey, startYear, endYear, includeSourceVintage],
    queryFn: ({ signal }) =>
      fetchBatchData({
        countriesKey,
        indicatorsKey,
        startYear,
        endYear,
        includeSourceVintage,
        signal,
      }),
    enabled: queryEnabled,
  });

  const data = query.data?.data ?? {};
  const indicatorByCode = query.data?.indicators ?? {};
  const error = query.error instanceof Error ? query.error.message : null;

  const getLatestValue = (indicator: string, iso: string): number | null => {
    const pts = data[indicator]?.[iso];
    if (!pts || pts.length === 0) return null;
    let best = pts[0];
    for (const p of pts) if (p.year > best.year) best = p;
    return best.value;
  };

  return {
    data,
    indicatorByCode,
    loading: queryEnabled ? query.isLoading || query.isFetching : false,
    error,
    getLatestValue,
  };
}
