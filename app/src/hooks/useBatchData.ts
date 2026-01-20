import { useEffect, useMemo, useState } from "react";
import type { Indicator } from "../types";

export interface BatchSeriesPoint {
  year: number;
  value: number;
}

export type BatchSeries = Record<string, Record<string, BatchSeriesPoint[]>>; // indicator -> iso -> points

export function useBatchData(params: {
  countries: string[];
  indicators: string[];
  startYear?: number;
  endYear?: number;
  enabled?: boolean;
}) {
  const { countries, indicators, startYear = 1990, endYear, enabled = true } = params;

  const key = useMemo(() => {
    const c = [...countries].map((x) => x.trim().toUpperCase()).filter(Boolean).sort().join(",");
    const i = [...indicators].map((x) => x.trim().toUpperCase()).filter(Boolean).sort().join(",");
    return `${c}__${i}__${startYear}__${endYear ?? ""}`;
  }, [countries, endYear, indicators, startYear]);

  const [data, setData] = useState<BatchSeries>({});
  const [indicatorByCode, setIndicatorByCode] = useState<Record<string, Indicator>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (countries.length === 0 || indicators.length === 0) return;

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    const qs = new URLSearchParams({
      countries: countries.join(","),
      indicators: indicators.join(","),
      start_year: String(startYear),
    });
    if (endYear != null) qs.set("end_year", String(endYear));

    fetch(`/api/batch-data?${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result) => {
        setData(result.data || {});
        setIndicatorByCode(result.indicators || {});
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [countries, endYear, enabled, indicators, key, startYear]);

  const getLatestValue = (indicator: string, iso: string): number | null => {
    const pts = data[indicator]?.[iso];
    if (!pts || pts.length === 0) return null;
    let best = pts[0];
    for (const p of pts) if (p.year > best.year) best = p;
    return best.value;
  };

  return { data, indicatorByCode, loading, error, getLatestValue };
}

