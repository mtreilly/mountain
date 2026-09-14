import { describe, expect, it } from "vitest";
import {
  type BuildImplicationsSnapshotInput,
  buildImplicationsSnapshot,
  DEFAULT_IMPLICATION_CONTROLS,
  type ObservedValue,
} from "./implicationsSnapshot";

function observed(value: number, year: number, unit: string, source = "Fixture"): ObservedValue {
  return {
    value,
    year,
    unit,
    source,
    sourceCode: null,
    sourceVintage: "fixture@1",
  };
}

function fixture(overrides: Partial<BuildImplicationsSnapshotInput> = {}) {
  return {
    country: { iso3: "NGA", name: "Nigeria" },
    gdpPerCapitaCurrent: observed(10_000, 2023, "constant PPP int$", "PWT"),
    gdpPerCapitaGrowthRate: 0.04,
    populationCurrent: observed(200_000_000, 2023, "persons", "UN WPP"),
    populationFuture: observed(250_000_000, 2048, "persons", "UN WPP"),
    electricityUsePerCapitaCurrent: observed(250, 2022, "kWh/person/year", "World Bank"),
    populationAtElectricityUseYear: observed(200_000_000, 2022, "persons", "UN WPP"),
    electricityUsePerCapitaFuture: 400,
    electricityGenerationCurrent: observed(40, 2023, "TWh/year", "OWID"),
    controls: {
      ...DEFAULT_IMPLICATION_CONTROLS,
      assumptions: {
        ...DEFAULT_IMPLICATION_CONTROLS.assumptions,
        gridLossPct: 10,
        netImportsPct: 10,
      },
    },
    ...overrides,
  } satisfies BuildImplicationsSnapshotInput;
}

describe("buildImplicationsSnapshot", () => {
  it("calculates the canonical electricity waterfall exactly", () => {
    const snapshot = buildImplicationsSnapshot(fixture());

    expect(snapshot.horizon).toEqual({ baseYear: 2023, years: 25, targetYear: 2048 });
    expect(snapshot.electricity.endUseDemandCurrentTWh?.value).toBe(50);
    expect(snapshot.electricity.endUseDemandFutureTWh?.value).toBe(100);
    expect(snapshot.electricity.endUseDemandChangeTWh?.value).toBe(50);
    expect(snapshot.electricity.grossSupplyRequiredFutureTWh?.value).toBeCloseTo(
      111.11111111111111,
      12,
    );
    expect(snapshot.electricity.importsFutureTWh?.value).toBeCloseTo(11.11111111111111, 12);
    expect(snapshot.electricity.domesticGenerationRequiredFutureTWh?.value).toBe(100);
    expect(snapshot.electricity.domesticGenerationGapTWh?.value).toBe(60);
    expect(snapshot.electricity.newDomesticGenerationTWh?.value).toBe(60);
    expect(snapshot.electricity.newDomesticGenerationAverageGW?.value).toBeCloseTo(
      6.8493150684931505,
      12,
    );
    expect(snapshot.electricity.annualEnergyEquivalents?.nuclear.referenceUnits).toBeCloseTo(
      7.6103500761035,
      12,
    );
  });

  it("uses the same annual energy for every technology equivalent", () => {
    const snapshot = buildImplicationsSnapshot(fixture());
    const equivalents = snapshot.electricity.annualEnergyEquivalents;
    expect(equivalents).not.toBeNull();
    const assumptions = snapshot.assumptions.assumptions;

    expect(equivalents!.solar.installedGW * 8.76 * assumptions.solarCf).toBeCloseTo(60, 12);
    expect(equivalents!.wind.installedGW * 8.76 * assumptions.windCf).toBeCloseTo(60, 12);
    expect(equivalents!.nuclear.installedGW * 8.76 * assumptions.nuclearCf).toBeCloseTo(60, 12);
    expect(equivalents!.coal.installedGW * 8.76 * assumptions.coalCf).toBeCloseTo(60, 12);
  });

  it("preserves a signed surplus but exposes zero buildout", () => {
    const snapshot = buildImplicationsSnapshot(
      fixture({ electricityGenerationCurrent: observed(120, 2023, "TWh/year") }),
    );

    expect(snapshot.electricity.domesticGenerationGapTWh?.value).toBe(-20);
    expect(snapshot.electricity.newDomesticGenerationTWh?.value).toBe(0);
    expect(snapshot.warnings.map((warning) => warning.code)).toContain("negative_generation_gap");
  });

  it("requires population aligned to the electricity-use year", () => {
    expect(() =>
      buildImplicationsSnapshot(
        fixture({ populationAtElectricityUseYear: observed(200_000_000, 2021, "persons") }),
      ),
    ).toThrow(/same observation year/);
  });

  it("requires a UN population point for the exact target year", () => {
    expect(() =>
      buildImplicationsSnapshot(
        fixture({ populationFuture: observed(250_000_000, 2049, "persons") }),
      ),
    ).toThrow(/expected 2048/);
  });

  it("changes population-dependent results without changing current demand", () => {
    const medium = buildImplicationsSnapshot(fixture());
    const low = buildImplicationsSnapshot(
      fixture({
        populationFuture: observed(225_000_000, 2048, "persons"),
        controls: { ...fixture().controls, populationVariant: "low" },
      }),
    );

    expect(low.electricity.endUseDemandCurrentTWh?.value).toBe(
      medium.electricity.endUseDemandCurrentTWh?.value,
    );
    expect(low.electricity.endUseDemandFutureTWh?.value).toBe(90);
    expect(low.population.variant).toBe("low");
  });

  it("rejects invalid physical assumptions", () => {
    expect(() =>
      buildImplicationsSnapshot(
        fixture({
          controls: {
            ...fixture().controls,
            assumptions: { ...fixture().controls.assumptions, nuclearCf: 0 },
          },
        }),
      ),
    ).toThrow(/capacity factor/);
  });
});
