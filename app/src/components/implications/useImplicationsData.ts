import { useMemo } from "react";
import { useBatchData } from "../../hooks/useBatchData";
import { IMPLICATION_METRIC_CODES } from "../../lib/templatePaths";
import type { TemplateId } from "../../lib/templatePaths";
import { TEMPLATE_PATHS } from "../../lib/templatePaths";

interface UseImplicationsDataOptions {
  chaserIso: string;
  template: TemplateId;
  enabled: boolean;
}

export function useImplicationsData({
  chaserIso,
  template,
  enabled,
}: UseImplicationsDataOptions) {
  const templateDef = TEMPLATE_PATHS.find((t) => t.id === template) ?? TEMPLATE_PATHS[0];

  const countries = useMemo(() => {
    const list = [chaserIso, ...templateDef.iso3];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const iso of list) {
      const cleaned = iso.trim().toUpperCase();
      if (!cleaned) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      out.push(cleaned);
    }
    return out;
  }, [chaserIso, templateDef.iso3]);

  const indicators = useMemo(
    () => [
      "GDP_PCAP_PPP",
      "POPULATION",
      ...IMPLICATION_METRIC_CODES,
      "ELECTRICITY_GEN_TOTAL",
      "ELECTRICITY_GEN_SOLAR",
      "ELECTRICITY_GEN_WIND",
      "ELECTRICITY_GEN_COAL",
      "ELECTRICITY_GEN_NUCLEAR",
      "INSTALLED_CAPACITY_SOLAR_GW",
      "INSTALLED_CAPACITY_WIND_GW",
      "INSTALLED_CAPACITY_COAL_GW",
      "INSTALLED_CAPACITY_NUCLEAR_GW",
    ],
    []
  );

  const { data, indicatorByCode, loading, error, getLatestValue } = useBatchData({
    countries,
    indicators,
    startYear: 1990,
    enabled,
  });

  const { data: dataWithVintage } = useBatchData({
    countries: [chaserIso],
    indicators: ["ELECTRICITY_GEN_TOTAL"],
    startYear: 1990,
    enabled,
    includeSourceVintage: true,
  });

  return {
    data,
    dataWithVintage,
    indicatorByCode,
    loading,
    error,
    getLatestValue,
    templateDef,
  };
}
