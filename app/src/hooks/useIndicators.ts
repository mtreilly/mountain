import { useEffect, useState } from "react";
import type { Indicator } from "../types";

const VISIBLE_METRIC_CODES = [
  "POPULATION",
  "GDP_PCAP_PPP",
  "LIFE_EXPECT",
  "INTERNET",
  "ELECTRICITY_USE_PCAP",
] as const;

const VISIBLE_METRIC_SET = new Set<string>(VISIBLE_METRIC_CODES);
const METRIC_ORDER: Record<string, number> = Object.fromEntries(
  VISIBLE_METRIC_CODES.map((code, index) => [code, index]),
);

export function useIndicators() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/indicators")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const all: Indicator[] = data.data || [];
        const filtered = all
          .filter((ind) => VISIBLE_METRIC_SET.has(ind.code))
          .sort((a, b) => (METRIC_ORDER[a.code] ?? 99) - (METRIC_ORDER[b.code] ?? 99));
        setIndicators(filtered);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { indicators, loading, error };
}
