import { useState, useEffect } from "react";

interface DataPoint {
  year: number;
  value: number;
}

interface IndicatorInfo {
  code: string;
  name: string;
  unit: string | null;
}

interface UseCountryDataParams {
  countries: string[];
  indicator: string;
}

export function useCountryData({ countries, indicator }: UseCountryDataParams) {
  const [data, setData] = useState<Record<string, DataPoint[]>>({});
  const [indicatorInfo, setIndicatorInfo] = useState<IndicatorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countriesKey = countries.join(",");

  useEffect(() => {
    if (countries.length === 0 || !indicator) return;

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
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
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [countriesKey, countries.length, indicator]);

  // Get the latest value for a country
  const getLatestValue = (iso: string): number | null => {
    const countryData = data[iso];
    if (!countryData || countryData.length === 0) return null;

    // Sort by year descending and get the first (latest)
    const sorted = [...countryData].sort((a, b) => b.year - a.year);
    return sorted[0].value;
  };

  return { data, indicator: indicatorInfo, loading, error, getLatestValue };
}
