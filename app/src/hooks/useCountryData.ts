import { useEffect, useState } from "react";

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

export function useCountryData({
  countries,
  indicator,
  enabled = true,
  invalidIndicator = false,
}: UseCountryDataParams) {
  const [data, setData] = useState<Record<string, DataPoint[]>>({});
  const [indicatorInfo, setIndicatorInfo] = useState<IndicatorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const countriesKey = countries.join(",");

  useEffect(() => {
    if (countries.length === 0 || !indicator) return;
    if (!enabled) return;
    const controller = new AbortController();
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;
      setLoading(true);
      setError(null);
      setHasLoaded(false);
    });
    const params = new URLSearchParams({
      countries: countriesKey,
      start_year: "1990",
    });

    fetch(`/api/data/${indicator}?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (!isActive) return;
        setData(result.data || {});
        setIndicatorInfo(result.indicator || null);
        setLoading(false);
        setHasLoaded(true);
      })
      .catch((err) => {
        if (!isActive) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
        setHasLoaded(true);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [countriesKey, countries.length, enabled, indicator]);

  const resolvedError = !enabled && invalidIndicator && indicator ? "INDICATOR_NOT_FOUND" : error;

  // Get the latest value for a country
  const getLatestValue = (iso: string): number | null => {
    const countryData = data[iso];
    if (!countryData || countryData.length === 0) return null;

    // Sort by year descending and get the first (latest)
    const sorted = [...countryData].sort((a, b) => b.year - a.year);
    return sorted[0].value;
  };

  return {
    data: enabled ? data : {},
    indicator: enabled ? indicatorInfo : null,
    loading: enabled ? loading : false,
    error: resolvedError,
    hasLoaded: enabled ? hasLoaded : false,
    getLatestValue,
  };
}
