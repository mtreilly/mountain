import type { ImplicationMetricCode } from "./templatePaths";

export type ScenarioId =
  | "baseline"
  | "highGrowth"
  | "efficient"
  | "electrify"
  | "highIndustry"
  | "importDependent";

export type Scenario = {
  id: ScenarioId;
  label: string;
  blurb: string;
  presets?: {
    horizonYears?: number;
    gridLossPct?: number;
    netImportsPct?: number;
  };
  adjustments: {
    electricityUseMultiplier?: number;
    energyUseMultiplier?: number;
    co2Multiplier?: number;
    industryShareAddPctPoints?: number;
  };
};

export const IMPLICATION_SCENARIOS: Scenario[] = [
  {
    id: "baseline",
    label: "Baseline",
    blurb: "Template-only (no extra assumptions).",
    adjustments: {},
  },
  {
    id: "highGrowth",
    label: "High growth (25y)",
    blurb: "Sets horizon to 25 years (growth rate is still controlled elsewhere).",
    presets: { horizonYears: 25 },
    adjustments: {},
  },
  {
    id: "efficient",
    label: "Efficient growth",
    blurb: "Less energy/electricity per unit of GDP than the template path.",
    presets: { gridLossPct: 7 },
    adjustments: { electricityUseMultiplier: 0.85, energyUseMultiplier: 0.9, co2Multiplier: 0.85 },
  },
  {
    id: "electrify",
    label: "Electrify everything",
    blurb: "Higher electricity demand (transport + heat + industry electrification).",
    adjustments: { electricityUseMultiplier: 1.35 },
  },
  {
    id: "highIndustry",
    label: "High industry",
    blurb: "More heavy industry; higher electricity intensity and industry share.",
    presets: { gridLossPct: 12 },
    adjustments: { electricityUseMultiplier: 1.15, industryShareAddPctPoints: 5 },
  },
  {
    id: "importDependent",
    label: "Import-dependent",
    blurb: "Meets part of demand via net electricity imports.",
    presets: { netImportsPct: 10 },
    adjustments: {},
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function applyScenarioToImpliedMetric(params: {
  scenarioId: ScenarioId;
  metricCode: ImplicationMetricCode;
  implied: number | null;
}): number | null {
  const { scenarioId, metricCode, implied } = params;
  if (implied == null || !Number.isFinite(implied)) return null;

  const scenario = IMPLICATION_SCENARIOS.find((s) => s.id === scenarioId) || IMPLICATION_SCENARIOS[0];
  const adj = scenario.adjustments;

  if (metricCode === "ELECTRICITY_USE_PCAP" && adj.electricityUseMultiplier != null) {
    return implied * adj.electricityUseMultiplier;
  }
  if (metricCode === "ENERGY_USE_PCAP" && adj.energyUseMultiplier != null) {
    return implied * adj.energyUseMultiplier;
  }
  if (metricCode === "CO2_PCAP" && adj.co2Multiplier != null) {
    return implied * adj.co2Multiplier;
  }
  if (metricCode === "INDUSTRY_VA_PCT_GDP" && adj.industryShareAddPctPoints != null) {
    return clamp(implied + adj.industryShareAddPctPoints, 0, 100);
  }

  return implied;
}
