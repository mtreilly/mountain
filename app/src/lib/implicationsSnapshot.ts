import type { ScenarioId } from "./implicationsScenarios";
import type { TemplateId } from "./templatePaths";

export type PopulationVariant = "medium" | "low" | "high";
export type PowerMixKey = "solar" | "wind" | "nuclear" | "coal";

export type SourceReference = {
  indicator: string;
  source: string;
  sourceCode: string | null;
  sourceVintage: string | null;
  observedYear: number | null;
};

export type ObservedValue = {
  value: number;
  year: number;
  unit: string;
  source: string;
  sourceCode: string | null;
  sourceVintage: string | null;
};

export type DerivedValue = {
  value: number;
  year: number;
  unit: string;
};

export type ImplicationAssumptions = {
  solarCf: number;
  windCf: number;
  nuclearCf: number;
  coalCf: number;
  nuclearPlantGw: number;
  coalPlantGw: number;
  panelWatts: number;
  windTurbineMw: number;
  householdSize: number;
  gridLossPct: number;
  netImportsPct: number;
};

export const DEFAULT_IMPLICATION_ASSUMPTIONS: ImplicationAssumptions = {
  solarCf: 0.2,
  windCf: 0.35,
  nuclearCf: 0.9,
  coalCf: 0.6,
  nuclearPlantGw: 1,
  coalPlantGw: 1,
  panelWatts: 400,
  windTurbineMw: 3,
  householdSize: 4,
  gridLossPct: 10,
  netImportsPct: 0,
};

export type ImplicationsControlsState = {
  template: TemplateId;
  horizonYears: number;
  scenario: ScenarioId | "custom";
  populationVariant: PopulationVariant;
  assumptions: ImplicationAssumptions;
  mix: Record<PowerMixKey, number>;
};

export const DEFAULT_IMPLICATION_CONTROLS: ImplicationsControlsState = {
  template: "china",
  horizonYears: 25,
  scenario: "baseline",
  populationVariant: "medium",
  assumptions: DEFAULT_IMPLICATION_ASSUMPTIONS,
  mix: { solar: 60, wind: 30, nuclear: 10, coal: 0 },
};

export type SnapshotWarningCode =
  | "missing_current_demand"
  | "missing_current_generation"
  | "population_year_unavailable"
  | "baseline_year_gap"
  | "negative_generation_gap";

export type SnapshotWarning = {
  code: SnapshotWarningCode;
  message: string;
};

export type AnnualEnergyEquivalent = {
  installedGW: number;
  referenceUnits: number;
  referenceUnitLabel: string;
  capacityFactor: number;
};

export type ImplicationsSnapshot = {
  schemaVersion: 1;
  country: { iso3: string; name: string };
  horizon: { baseYear: number; years: number; targetYear: number };
  assumptions: ImplicationsControlsState;
  gdp: {
    perCapitaCurrent: ObservedValue;
    perCapitaFuture: DerivedValue;
    totalCurrent: DerivedValue;
    totalFuture: DerivedValue;
  };
  population: {
    current: ObservedValue;
    future: ObservedValue;
    variant: PopulationVariant;
  };
  electricity: {
    usePerCapitaCurrent: ObservedValue | null;
    usePerCapitaFuture: DerivedValue | null;
    endUseDemandCurrentTWh: DerivedValue | null;
    endUseDemandFutureTWh: DerivedValue | null;
    endUseDemandChangeTWh: DerivedValue | null;
    grossSupplyRequiredFutureTWh: DerivedValue | null;
    importsFutureTWh: DerivedValue | null;
    domesticGenerationRequiredFutureTWh: DerivedValue | null;
    domesticGenerationObservedCurrentTWh: ObservedValue | null;
    domesticGenerationGapTWh: DerivedValue | null;
    newDomesticGenerationTWh: DerivedValue | null;
    newDomesticGenerationAverageGW: DerivedValue | null;
    annualEnergyEquivalents: Record<PowerMixKey, AnnualEnergyEquivalent> | null;
  };
  provenance: SourceReference[];
  warnings: SnapshotWarning[];
};

export type BuildImplicationsSnapshotInput = {
  country: { iso3: string; name: string };
  gdpPerCapitaCurrent: ObservedValue;
  gdpPerCapitaGrowthRate: number;
  populationCurrent: ObservedValue;
  populationFuture: ObservedValue;
  electricityUsePerCapitaCurrent: ObservedValue | null;
  populationAtElectricityUseYear: ObservedValue | null;
  electricityUsePerCapitaFuture: number | null;
  electricityGenerationCurrent: ObservedValue | null;
  controls: ImplicationsControlsState;
  provenance?: SourceReference[];
};

const HOURS_PER_YEAR = 8760;
const TWH_PER_GWH = 1000;
const KWH_PER_TWH = 1e9;

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`);
  return value;
}

function validateObserved(observed: ObservedValue, label: string) {
  finiteNonNegative(observed.value, `${label}.value`);
  if (!Number.isInteger(observed.year)) throw new Error(`${label}.year must be an integer`);
}

function validateControls(controls: ImplicationsControlsState) {
  if (!Number.isInteger(controls.horizonYears) || controls.horizonYears < 1) {
    throw new Error("horizonYears must be a positive integer");
  }
  const a = controls.assumptions;
  if (!Number.isFinite(a.gridLossPct) || a.gridLossPct < 0 || a.gridLossPct >= 100) {
    throw new Error("gridLossPct must be in [0, 100)");
  }
  if (!Number.isFinite(a.netImportsPct) || a.netImportsPct < -50 || a.netImportsPct > 50) {
    throw new Error("netImportsPct must be in [-50, 50]");
  }
  for (const [key, cf] of Object.entries({
    solar: a.solarCf,
    wind: a.windCf,
    nuclear: a.nuclearCf,
    coal: a.coalCf,
  })) {
    if (!Number.isFinite(cf) || cf <= 0 || cf > 1) {
      throw new Error(`${key} capacity factor must be in (0, 1]`);
    }
  }
  for (const [key, size] of Object.entries({
    nuclearPlantGw: a.nuclearPlantGw,
    coalPlantGw: a.coalPlantGw,
    panelWatts: a.panelWatts,
    windTurbineMw: a.windTurbineMw,
    householdSize: a.householdSize,
  })) {
    if (!Number.isFinite(size) || size <= 0) throw new Error(`${key} must be positive`);
  }
  for (const [key, share] of Object.entries(controls.mix)) {
    if (!Number.isFinite(share) || share < 0) throw new Error(`${key} mix must be non-negative`);
  }
}

function derived(value: number, year: number, unit: string): DerivedValue {
  return { value, year, unit };
}

function technologyEquivalent(
  annualTWh: number,
  capacityFactor: number,
  referenceUnitGW: number,
  referenceUnitLabel: string,
): AnnualEnergyEquivalent {
  const installedGW = annualTWh / (8.76 * capacityFactor);
  return {
    installedGW,
    referenceUnits: installedGW / referenceUnitGW,
    referenceUnitLabel,
    capacityFactor,
  };
}

export function buildImplicationsSnapshot(
  input: BuildImplicationsSnapshotInput,
): ImplicationsSnapshot {
  validateObserved(input.gdpPerCapitaCurrent, "gdpPerCapitaCurrent");
  validateObserved(input.populationCurrent, "populationCurrent");
  validateObserved(input.populationFuture, "populationFuture");
  validateControls(input.controls);
  if (!Number.isFinite(input.gdpPerCapitaGrowthRate) || input.gdpPerCapitaGrowthRate <= -1) {
    throw new Error("gdpPerCapitaGrowthRate must be finite and greater than -1");
  }

  const baseYear = input.gdpPerCapitaCurrent.year;
  const targetYear = baseYear + input.controls.horizonYears;
  if (input.populationFuture.year !== targetYear) {
    throw new Error(`population projection is for ${input.populationFuture.year}, expected ${targetYear}`);
  }

  const futureGdpPerCapita =
    input.gdpPerCapitaCurrent.value *
    Math.pow(1 + input.gdpPerCapitaGrowthRate, input.controls.horizonYears);
  const totalGdpCurrent = input.gdpPerCapitaCurrent.value * input.populationCurrent.value;
  const totalGdpFuture = futureGdpPerCapita * input.populationFuture.value;
  const warnings: SnapshotWarning[] = [];

  let currentDemand: DerivedValue | null = null;
  if (input.electricityUsePerCapitaCurrent && input.populationAtElectricityUseYear) {
    validateObserved(input.electricityUsePerCapitaCurrent, "electricityUsePerCapitaCurrent");
    validateObserved(input.populationAtElectricityUseYear, "populationAtElectricityUseYear");
    if (input.electricityUsePerCapitaCurrent.year !== input.populationAtElectricityUseYear.year) {
      throw new Error("current electricity use and population must use the same observation year");
    }
    currentDemand = derived(
      (input.electricityUsePerCapitaCurrent.value * input.populationAtElectricityUseYear.value) /
        KWH_PER_TWH,
      input.electricityUsePerCapitaCurrent.year,
      "TWh/year",
    );
  } else {
    warnings.push({
      code: "missing_current_demand",
      message: "Current end-use demand is unavailable because an aligned observation is missing.",
    });
  }

  const futureUse =
    input.electricityUsePerCapitaFuture != null
      ? finiteNonNegative(input.electricityUsePerCapitaFuture, "electricityUsePerCapitaFuture")
      : null;
  const futureDemand =
    futureUse == null
      ? null
      : derived((futureUse * input.populationFuture.value) / KWH_PER_TWH, targetYear, "TWh/year");
  const demandChange =
    currentDemand && futureDemand
      ? derived(futureDemand.value - currentDemand.value, targetYear, "TWh/year")
      : null;

  const lossFraction = input.controls.assumptions.gridLossPct / 100;
  const importShare = input.controls.assumptions.netImportsPct / 100;
  const grossSupply = futureDemand
    ? derived(futureDemand.value / (1 - lossFraction), targetYear, "TWh/year")
    : null;
  const imports = grossSupply
    ? derived(grossSupply.value * importShare, targetYear, "TWh/year")
    : null;
  const domesticRequired = grossSupply
    ? derived(grossSupply.value * (1 - importShare), targetYear, "TWh/year")
    : null;

  if (input.electricityGenerationCurrent) {
    validateObserved(input.electricityGenerationCurrent, "electricityGenerationCurrent");
  } else {
    warnings.push({
      code: "missing_current_generation",
      message: "New domestic generation is unavailable because observed generation is missing.",
    });
  }

  if (
    currentDemand &&
    input.electricityGenerationCurrent &&
    Math.abs(currentDemand.year - input.electricityGenerationCurrent.year) > 3
  ) {
    warnings.push({
      code: "baseline_year_gap",
      message: `Demand (${currentDemand.year}) and generation (${input.electricityGenerationCurrent.year}) baselines differ by more than three years.`,
    });
  }

  const gap =
    domesticRequired && input.electricityGenerationCurrent
      ? derived(
          domesticRequired.value - input.electricityGenerationCurrent.value,
          targetYear,
          "TWh/year",
        )
      : null;
  if (gap && gap.value < 0) {
    warnings.push({
      code: "negative_generation_gap",
      message: "Observed generation exceeds the scenario's future domestic-generation requirement.",
    });
  }
  const buildout = gap ? derived(Math.max(0, gap.value), targetYear, "TWh/year") : null;
  const averageGW = buildout
    ? derived((buildout.value * TWH_PER_GWH) / HOURS_PER_YEAR, targetYear, "GW average")
    : null;

  const a = input.controls.assumptions;
  const equivalents = buildout
    ? {
        solar: technologyEquivalent(
          buildout.value,
          a.solarCf,
          a.panelWatts / 1e9,
          `${a.panelWatts} W panel`,
        ),
        wind: technologyEquivalent(
          buildout.value,
          a.windCf,
          a.windTurbineMw / 1000,
          `${a.windTurbineMw} MW turbine`,
        ),
        nuclear: technologyEquivalent(
          buildout.value,
          a.nuclearCf,
          a.nuclearPlantGw,
          `${a.nuclearPlantGw} GW unit`,
        ),
        coal: technologyEquivalent(
          buildout.value,
          a.coalCf,
          a.coalPlantGw,
          `${a.coalPlantGw} GW unit`,
        ),
      }
    : null;

  return {
    schemaVersion: 1,
    country: input.country,
    horizon: { baseYear, years: input.controls.horizonYears, targetYear },
    assumptions: input.controls,
    gdp: {
      perCapitaCurrent: input.gdpPerCapitaCurrent,
      perCapitaFuture: derived(futureGdpPerCapita, targetYear, input.gdpPerCapitaCurrent.unit),
      totalCurrent: derived(totalGdpCurrent, input.populationCurrent.year, "constant PPP int$"),
      totalFuture: derived(totalGdpFuture, targetYear, "constant PPP int$"),
    },
    population: {
      current: input.populationCurrent,
      future: input.populationFuture,
      variant: input.controls.populationVariant,
    },
    electricity: {
      usePerCapitaCurrent: input.electricityUsePerCapitaCurrent,
      usePerCapitaFuture:
        futureUse == null ? null : derived(futureUse, targetYear, "kWh/person/year"),
      endUseDemandCurrentTWh: currentDemand,
      endUseDemandFutureTWh: futureDemand,
      endUseDemandChangeTWh: demandChange,
      grossSupplyRequiredFutureTWh: grossSupply,
      importsFutureTWh: imports,
      domesticGenerationRequiredFutureTWh: domesticRequired,
      domesticGenerationObservedCurrentTWh: input.electricityGenerationCurrent,
      domesticGenerationGapTWh: gap,
      newDomesticGenerationTWh: buildout,
      newDomesticGenerationAverageGW: averageGW,
      annualEnergyEquivalents: equivalents,
    },
    provenance: input.provenance ?? [],
    warnings,
  };
}
