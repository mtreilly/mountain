import { useState, useEffect } from "react";

interface DataPoint {
  year: number;
  value: number;
}

interface IndicatorInfo {
  code: string;
  name: string;
  unit: string | null;
  source?: string | null;
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

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      setHasLoaded(false);
    });
    const params = new URLSearchParams({
      countries: countriesKey,
      start_year: "1990",
    });

    fetch(`/api/data/${indicator}?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result) => {
        setData(result.data || {});
        setIndicatorInfo(result.indicator || null);
        setLoading(false);
        setHasLoaded(true);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        setHasLoaded(true);
      });
  }, [countriesKey, countries.length, enabled, indicator, invalidIndicator]);

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
