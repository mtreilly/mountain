import { useQuery } from "@tanstack/react-query";
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

async function fetchIndicators({ signal }: { signal?: AbortSignal }) {
  const res = await fetch("/api/indicators", { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const all: Indicator[] = data.data || [];
  return all
    .filter((ind) => VISIBLE_METRIC_SET.has(ind.code))
    .toSorted((a, b) => (METRIC_ORDER[a.code] ?? 99) - (METRIC_ORDER[b.code] ?? 99));
}

export function useIndicators() {
  const query = useQuery({
    queryKey: ["indicators"],
    queryFn: ({ signal }) => fetchIndicators({ signal }),
  });

  return {
    indicators: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
