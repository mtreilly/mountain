import { useQuery } from "@tanstack/react-query";
import type { Country } from "../types";

async function fetchCountries({ signal }: { signal?: AbortSignal }) {
  const res = await fetch("/api/countries", { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || []) as Country[];
}

export function useCountries() {
  const query = useQuery({
    queryKey: ["countries"],
    queryFn: ({ signal }) => fetchCountries({ signal }),
  });

  return {
    countries: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
