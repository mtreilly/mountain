import { useQuery } from "@tanstack/react-query";
import { loadCountries } from "../lib/staticData";
import type { Country } from "../types";

export function useCountries() {
  const query = useQuery({
    queryKey: ["countries"],
    queryFn: async () => (await loadCountries()) as Country[],
    // Static snapshot: it can't change until the next deploy.
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    countries: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
