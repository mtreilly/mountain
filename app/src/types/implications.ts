// Type definitions for Implications Panel cards

export interface TotalValue {
  unit: string;
  value: number;
}

export interface GdpData {
  gdpTotalCurrent: TotalValue | null;
  gdpTotalFuture: TotalValue | null;
  popCurrent: number | null;
  popFuture: number | null;
}

export interface ElectricityDemandData {
  demandCurrentTWh: number | null;
  demandFutureTWh: number | null;
  demandDeltaTWh: number | null;
  requiredDomesticGenerationFutureTWh: number | null;
  buildoutDeltaTWh: number | null;
  demandDeltaAvgGW: number | null;
  buildoutDeltaAvgGW: number | null;
  assumptions: {
    gridLossPct: number;
    netImportsPct: number;
  };
}

export interface ObservedElectricity {
  year: number;
  totalTWh: number;
  totalSourceVintage: string | null;
  bySourceTWh: {
    solar: number | null;
    wind: number | null;
    coal: number | null;
    nuclear: number | null;
  };
  shares: {
    solar: number | null;
    wind: number | null;
    coal: number | null;
    nuclear: number | null;
  };
}

export interface TechEquivalents {
  deltaTWh: number;
  deltaAvgGW: number | null;
  nuclear: {
    plants: number;
    gw: number;
  };
  coal: {
    plants: number;
    gw: number;
  };
  solar: {
    gw: number;
    panels: number | null;
  };
  wind: {
    gw: number;
    turbines: number | null;
  };
  assumptions: {
    nuclearCf: number;
    coalCf: number;
    solarCf: number;
    windCf: number;
    panelWatts: number;
    windTurbineMw: number;
  };
}

export interface BaselineMultipliers {
  kind: "reported" | "inferred";
  year: number;
  ratio: {
    solar: number | null;
    wind: number | null;
    coal: number | null;
    nuclear: number | null;
  };
}

export type PowerMixKey = "solar" | "wind" | "nuclear" | "coal";

export interface MixBuildout {
  deltaTWh: number;
  sum: number;
  fractions: Record<PowerMixKey, number>;
  percent: Record<PowerMixKey, number>;
  tech: Record<
    PowerMixKey,
    {
      share: number;
      twh: number;
      gw: number;
      perYear: {
        twh: number;
        gw: number;
      };
      equivalents: {
        plants: number | null;
        panels: number | null;
        turbines: number | null;
      };
      multiplier: {
        capacityX: number | null;
        generationX: number | null;
      };
      pace: {
        max5yTwhPerYear: number | null;
        paceX: number | null;
      };
    }
  >;
  baselineKind: "reported" | "inferred";
  assumptions: {
    solarCf: number;
    windCf: number;
    nuclearCf: number;
    coalCf: number;
    panelWatts: number;
    windTurbineMw: number;
  };
}

export interface ElectricityMixData {
  observedMix: ObservedElectricity | null;
  techEquivalents: TechEquivalents | null;
  baselineMultipliers: BaselineMultipliers | null;
  mixBuildout: MixBuildout | null;
}

export interface ElectricityAssumption {
  solarCf: number;
  windCf: number;
  nuclearCf: number;
  coalCf: number;
  panelWatts: number;
  windTurbineMw: number;
  householdSize: number;
  gridLossPct: number;
  netImportsPct: number;
}

export interface UrbanizationData {
  currentPersons: number | null;
  futurePersons: number | null;
  deltaPersons: number | null;
  homesNeeded: number | null;
  householdSize: number;
  yearsToProject: number;
}

export interface Co2Data {
  currentMt: number | null;
  futureMt: number | null;
}
