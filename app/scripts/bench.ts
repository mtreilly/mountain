import { strict as assert } from "node:assert";
import { performance } from "node:perf_hooks";
import { generateToolCitation, type CitationContext } from "../src/lib/citations";
import { generateProjection } from "../src/lib/convergence";
import { toObservedCsv, toProjectionCsv } from "../src/lib/dataExport";
import { generateHistoricalCardSvg } from "../src/lib/historicalCardSvg";
import { generateImplicationsCardSvg } from "../src/lib/implicationsCardSvg";
import { computeTotals } from "../src/lib/implicationsMath";
import { ALL_TL2_REGIONS, getLatestRegionData, getRegionByCode } from "../src/lib/oecdRegions";
import { calculateSensitivityScenarios } from "../src/lib/sensitivityAnalysis";
import { generateSensitivityCardSvg } from "../src/lib/sensitivityCardSvg";
import { generateShareCardSvg } from "../src/lib/shareCardSvg";
import { parseShareStateFromSearch, toSearchString } from "../src/lib/shareState";
import { generateCaptions } from "../src/lib/threadGenerator";
import type { Indicator } from "../src/types";

function bench(name: string, fn: () => void, budgetMs: number, iterations = 200) {
  for (let i = 0; i < 20; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  assert.ok(median < budgetMs, `${name}: ${median.toFixed(2)}ms exceeds ${budgetMs}ms budget`);
  process.stdout.write(`ok - bench ${name}: ${median.toFixed(2)}ms (budget: ${budgetMs}ms)\n`);
}

const state = parseShareStateFromSearch(
  "?chaser=NGA&target=USA&indicator=GDP_PCAP_PPP&cg=0.030&tg=0.010&tmode=growing&baseYear=2023&view=chart&adjC=0&adjT=0&goal=35&ms=0&tpl=us&ih=40&impCard=co2&impElecMode=mix",
);

const indicator: Indicator = {
  code: "GDP_PCAP_PPP",
  name: "GDP per capita (PPP)",
  description: "GDP per capita, PPP (constant 2021 international $)",
  unit: "constant 2021 int$",
  source: "World Bank",
  category: "economic",
};

const observed50 = {
  NGA: Array.from({ length: 50 }, (_, i) => ({ year: 1974 + i, value: 1200 + i * 80 })),
  USA: Array.from({ length: 50 }, (_, i) => ({ year: 1974 + i, value: 16000 + i * 1100 })),
};

const projection100 = Array.from({ length: 100 }, (_, i) => ({
  year: state.baseYear + i,
  chaser: Math.round(5400 * Math.pow(1.03, i)),
  target: Math.round(68000 * Math.pow(1.01, i)),
}));

const shareCardParams = {
  chaserName: "Nigeria",
  targetName: "United States",
  chaserCode: "NGA",
  targetCode: "USA",
  metricLabel: "GDP per capita (PPP)",
  metricUnit: "constant 2021 int$",
  projection: projection100,
  convergenceYear: 2120,
  yearsToConvergence: 97,
  currentGap: projection100[0].target / projection100[0].chaser,
  chaserGrowth: 0.03,
  targetGrowth: 0.01,
  targetMode: "growing" as const,
  theme: "light" as const,
};

const sensitivity = calculateSensitivityScenarios({
  chaserValue: 5400,
  targetValue: 68000,
  chaserGrowthRate: 0.03,
  targetGrowthRate: 0.01,
  baseYear: 2023,
});

const citationCtx: CitationContext = {
  toolName: "Convergence Explorer",
  toolUrl: "https://convergence.example.com",
  accessDate: new Date("2024-01-15T00:00:00.000Z"),
  chaserName: "Nigeria",
  chaserIso: "NGA",
  targetName: "United States",
  targetIso: "USA",
  indicatorName: "GDP per capita (PPP)",
  indicatorCode: "GDP_PCAP_PPP",
  dataSource: "World Bank",
  dataSourceCode: "NY.GDP.PCAP.PP.KD",
  state,
};

function benchmarkGenerateThreadArtifacts() {
  const mainSvg = generateShareCardSvg(shareCardParams);
  const sensitivitySvg = generateSensitivityCardSvg({
    chaserName: "Nigeria",
    targetName: "United States",
    chaserValue: 5400,
    targetValue: 68000,
    sensitivity,
    baseYear: 2023,
    theme: "light",
  });
  const historicalSvg = generateHistoricalCardSvg({
    chaserName: "Nigeria",
    targetName: "United States",
    historicalData: {
      chaserStart: { year: 2000, value: 3400 },
      chaserCurrent: { year: 2023, value: 5400 },
      targetStart: { year: 2000, value: 42000 },
      targetCurrent: { year: 2023, value: 68000 },
    },
    theme: "light",
  });
  const implicationsSvg = generateImplicationsCardSvg({
    chaserName: "Nigeria",
    implicationsData: {
      electricityDeltaTWh: 320,
      nuclearPlants: 22,
      urbanDeltaPersons: 48_000_000,
      homesNeeded: 10_500_000,
      co2DeltaMt: 95,
      gdpCurrent: 1.3e12,
      gdpFuture: 4.9e12,
    },
    horizonYear: 2045,
    theme: "light",
  });

  const captions = generateCaptions({
    chaserName: "Nigeria",
    targetName: "United States",
    yearsToConvergence: 97,
    convergenceYear: 2120,
    chaserGrowthRate: 0.03,
    targetGrowthRate: 0.01,
    optimisticYears: 77,
    pessimisticYears: 127,
    historicalData: {
      chaserStart: { year: 2000, value: 3400 },
      chaserCurrent: { year: 2023, value: 5400 },
      targetStart: { year: 2000, value: 42000 },
      targetCurrent: { year: 2023, value: 68000 },
    },
    implicationsData: {
      electricityDeltaTWh: 320,
      nuclearPlants: 22,
      urbanDeltaPersons: 48_000_000,
      homesNeeded: 10_500_000,
      co2DeltaMt: 95,
      gdpCurrent: 1.3e12,
      gdpFuture: 4.9e12,
    },
    appUrl: "https://convergence.example.com",
  });

  if (
    mainSvg.length === 0 ||
    sensitivitySvg.length === 0 ||
    historicalSvg.length === 0 ||
    implicationsSvg.length === 0 ||
    captions.length !== 4
  ) {
    throw new Error("Thread artifacts generation failed");
  }
}

function run() {
  bench("generateProjection (100y)", () => {
    generateProjection(5400, 68000, 0.03, 2023, 100);
  }, 5);

  bench("parseShareStateFromSearch (full URL)", () => {
    parseShareStateFromSearch(
      "?chaser=NGA&target=USA&indicator=GDP_PCAP_PPP&cg=0.030&tg=0.010&tmode=growing&baseYear=2023&view=chart&adjC=0&adjT=0&goal=35&ms=0&tpl=us&ih=40&impCard=co2&impElecMode=mix&mode=regions&cr=UKC&tr=UKI",
    );
  }, 1);

  bench("toSearchString (full state)", () => {
    toSearchString(state);
  }, 1);

  bench("toObservedCsv (50y observed)", () => {
    toObservedCsv({
      state,
      indicator,
      countriesByIso3: {
        NGA: { name: "Nigeria" },
        USA: { name: "United States" },
      },
      data: observed50,
      toolUrl: "https://convergence.example.com",
    });
  }, 2);

  bench("toProjectionCsv (100y projected)", () => {
    toProjectionCsv({
      state,
      indicator,
      projection: projection100,
      chaserName: "Nigeria",
      targetName: "United States",
      toolUrl: "https://convergence.example.com",
    });
  }, 3);

  bench("generateShareCardSvg", () => {
    generateShareCardSvg(shareCardParams);
  }, 50);

  bench("generateThread artifacts (4 cards + captions)", benchmarkGenerateThreadArtifacts, 100);

  bench("computeTotals", () => {
    computeTotals({
      code: "ELECTRICITY_USE_PCAP",
      currentMetric: 1200,
      impliedMetric: 2600,
      popCurrent: 220_000_000,
      popFuture: 320_000_000,
      gdpPcapCurrent: 5400,
      gdpPcapFuture: 13000,
    });
  }, 5);

  bench("OECD region lookup (all regions)", () => {
    for (const region of ALL_TL2_REGIONS) {
      const metadata = getRegionByCode(region.code);
      const latest = getLatestRegionData(region.code);
      if (!metadata) throw new Error(`Missing metadata for ${region.code}`);
      void latest;
    }
  }, 1);

  bench("citation generation", () => {
    generateToolCitation(citationCtx, "bibtex");
  }, 2);
}

run();
