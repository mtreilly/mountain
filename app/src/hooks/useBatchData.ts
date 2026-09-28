import { useQuery } from "@tanstack/react-query";
import { loadSeries } from "../lib/staticData";
import { seriesForCountries } from "../lib/staticDataFormat";
import type { Indicator } from "../types";

interface BatchSeriesPoint {
  year: number;
  value: number;
  source_vintage?: string | null;
}

type BatchSeries = Record<string, Record<string, BatchSeriesPoint[]>>; // indicator -> iso -> points

async function fetchBatchData(params: {
  countries: string[];
  indicators: string[];
  startYear: number;
  endYear?: number;
  includeSourceVintage: boolean;
}) {
  const loaded = await Promise.all(params.indicators.map((code) => loadSeries(code)));
  const data: BatchSeries = {};
  const indicators: Record<string, Indicator> = {};
  loaded.forEach((series, i) => {
    if (!series) return;
    const code = params.indicators[i]!;
    indicators[code] = series.indicator as Indicator;
    data[code] = seriesForCountries(series, params.countries, {
      startYear: params.startYear,
      endYear: params.endYear,
      includeSourceVintage: params.includeSourceVintage,
    });
  });
  return { data, indicators };
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
    queryFn: () =>
      fetchBatchData({ countries, indicators, startYear, endYear, includeSourceVintage }),
    staleTime: Number.POSITIVE_INFINITY,
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
