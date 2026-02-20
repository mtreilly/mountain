import { useEffect, useState } from "react";
import type { Indicator } from "../types";

// These codes are kept in the DB for internal use (implications engine) but
// should not appear in the user-facing metric selector.
const INTERNAL_ONLY_CODES = new Set([
  "INSTALLED_CAPACITY_COAL_GW",
  "INSTALLED_CAPACITY_NUCLEAR_GW",
  "ENERGY_USE_PCAP",
  "URBAN_POP_PCT",
  "INDUSTRY_VA_PCT_GDP",
  "CAPITAL_FORMATION_PCT_GDP",
]);

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
        setIndicators(all.filter((ind) => !INTERNAL_ONLY_CODES.has(ind.code)));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { indicators, loading, error };
}
