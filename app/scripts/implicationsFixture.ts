import {
  buildImplicationsSnapshot,
  DEFAULT_IMPLICATION_CONTROLS,
  type ObservedValue,
} from "../src/lib/implicationsSnapshot";

function observed(
  value: number,
  year: number,
  unit: string,
  source: string,
  sourceCode: string,
): ObservedValue {
  return { value, year, unit, source, sourceCode, sourceVintage: `${sourceCode}@fixture` };
}

export function fixtureImplicationsSnapshot(targetYear = 2045) {
  const baseYear = 2023;
  return buildImplicationsSnapshot({
    country: { iso3: "NGA", name: "Nigeria" },
    gdpPerCapitaCurrent: observed(5400, baseYear, "constant PPP int$", "Penn World Table", "pwt11"),
    gdpPerCapitaGrowthRate: 0.03,
    populationCurrent: observed(
      223_800_000,
      baseYear,
      "persons",
      "UN World Population Prospects",
      "WPP2024",
    ),
    populationFuture: observed(
      300_000_000,
      targetYear,
      "persons",
      "UN World Population Prospects",
      "WPP2024",
    ),
    electricityUsePerCapitaCurrent: observed(
      250,
      2022,
      "kWh/person/year",
      "World Bank",
      "EG.USE.ELEC.KH.PC",
    ),
    populationAtElectricityUseYear: observed(
      200_000_000,
      2022,
      "persons",
      "UN World Population Prospects",
      "WPP2024",
    ),
    electricityUsePerCapitaFuture: 1200,
    electricityGenerationCurrent: observed(
      40,
      2023,
      "TWh/year",
      "Our World in Data",
      "electricity_generation",
    ),
    controls: {
      ...DEFAULT_IMPLICATION_CONTROLS,
      horizonYears: targetYear - baseYear,
      assumptions: {
        ...DEFAULT_IMPLICATION_CONTROLS.assumptions,
        gridLossPct: 0,
      },
    },
    provenance: [
      {
        indicator: "GDP per capita (PPP)",
        source: "Penn World Table",
        sourceCode: "pwt11",
        sourceVintage: "pwt11@fixture",
        observedYear: 2023,
      },
      {
        indicator: "Population",
        source: "UN World Population Prospects",
        sourceCode: "WPP2024",
        sourceVintage: "un-wpp@2024",
        observedYear: targetYear,
      },
      {
        indicator: "Electric power consumption per capita",
        source: "World Bank",
        sourceCode: "EG.USE.ELEC.KH.PC",
        sourceVintage: "world-bank@fixture",
        observedYear: 2022,
      },
      {
        indicator: "Electricity generation",
        source: "Our World in Data",
        sourceCode: "electricity_generation",
        sourceVintage: "owid@fixture",
        observedYear: 2023,
      },
    ],
  });
}
