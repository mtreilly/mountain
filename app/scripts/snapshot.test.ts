import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type CitationContext, generateToolCitation } from "../src/lib/citations";
import { generateProjection } from "../src/lib/convergence";
import { toObservedCsv, toProjectionCsv, toReportJson } from "../src/lib/dataExport";
import { generateHistoricalCardSvg } from "../src/lib/historicalCardSvg";
import { generateImplicationsCardSvg } from "../src/lib/implicationsCardSvg";
import { calculateSensitivityScenarios } from "../src/lib/sensitivityAnalysis";
import { generateSensitivityCardSvg } from "../src/lib/sensitivityCardSvg";
import {
  generateShareCardSvg,
  SHARE_CARD_SIZES,
  type ShareCardParams,
} from "../src/lib/shareCardSvg";
import { parseShareStateFromSearch } from "../src/lib/shareState";
import { generateCaptions } from "../src/lib/threadGenerator";
import type { Indicator } from "../src/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assertSnapshot(name: string, content: string) {
  const dir = path.join(__dirname, "__snapshots__");
  const file = path.join(dir, `${name}.snap`);
  if (process.argv.includes("--update") || !fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, content, "utf-8");
    return;
  }
  const existing = fs.readFileSync(file, "utf-8");
  assert.equal(content, existing, `Snapshot mismatch: ${name}`);
}

function withFixedDate<T>(dateIso: string, fn: () => T): T {
  const RealDate = Date;

  class FixedDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(dateIso);
        return;
      }
      super(...args);
    }

    static now() {
      return new RealDate(dateIso).getTime();
    }

    static parse = RealDate.parse;
    static UTC = RealDate.UTC;
  }

  (globalThis as { Date: typeof Date }).Date = FixedDate as unknown as typeof Date;
  try {
    return fn();
  } finally {
    (globalThis as { Date: typeof Date }).Date = RealDate;
  }
}

function fixtureState() {
  return parseShareStateFromSearch(
    "?chaser=NGA&target=USA&indicator=GDP_PCAP_PPP&cg=0.030&tg=0.010&tmode=growing&baseYear=2023",
  );
}

function fixtureIndicator(): Indicator {
  return {
    code: "GDP_PCAP_PPP",
    name: "GDP per capita (PPP)",
    description: "GDP per capita, PPP (constant 2021 international $)",
    unit: "constant 2021 int$",
    source: "World Bank",
    category: "economic",
  };
}

function fixtureObservedSeries() {
  return {
    NGA: [
      { year: 2014, value: 4800 },
      { year: 2015, value: 4900 },
      { year: 2016, value: 5000 },
      { year: 2017, value: 5050 },
      { year: 2018, value: 5100 },
      { year: 2019, value: 5150 },
      { year: 2020, value: 5000 },
      { year: 2021, value: 5100 },
      { year: 2022, value: 5250 },
      { year: 2023, value: 5400 },
    ],
    USA: [
      { year: 2014, value: 56000 },
      { year: 2015, value: 57000 },
      { year: 2016, value: 58000 },
      { year: 2017, value: 59500 },
      { year: 2018, value: 61000 },
      { year: 2019, value: 62500 },
      { year: 2020, value: 61000 },
      { year: 2021, value: 64000 },
      { year: 2022, value: 66000 },
      { year: 2023, value: 68000 },
    ],
  };
}

function fixtureProjection() {
  const startYear = 2023;
  const years = 20;
  const chaser0 = 5400;
  const target0 = 68000;
  const chaserGrowth = 0.03;
  const targetGrowth = 0.01;

  return Array.from({ length: years }, (_, i) => ({
    year: startYear + i,
    chaser: Math.round(chaser0 * Math.pow(1 + chaserGrowth, i)),
    target: Math.round(target0 * Math.pow(1 + targetGrowth, i)),
  }));
}

function fixtureShareCardParams(
  theme: "light" | "dark",
  size: "twitter" | "linkedin",
): ShareCardParams {
  const projection = fixtureProjection();
  const latest = projection[0];
  const gap = latest.target / latest.chaser;

  return {
    chaserName: "Nigeria",
    targetName: "United States",
    chaserCode: "NGA",
    targetCode: "USA",
    metricLabel: "GDP per capita (PPP)",
    metricUnit: "constant 2021 int$",
    projection,
    convergenceYear: 2120,
    yearsToConvergence: 97,
    currentGap: gap,
    chaserGrowth: 0.03,
    targetGrowth: 0.01,
    targetMode: "growing",
    theme,
    dimensions: SHARE_CARD_SIZES[size],
    siteUrl: "convergence.example.com",
    dataSource: "World Bank",
  };
}

function fixtureCitationContext(): CitationContext {
  return {
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
    state: fixtureState(),
  };
}

function testShareCardSnapshots() {
  const twitter = generateShareCardSvg(fixtureShareCardParams("light", "twitter"));
  assertSnapshot("shareCard-twitter.svg", twitter);

  const linkedin = generateShareCardSvg(fixtureShareCardParams("light", "linkedin"));
  assertSnapshot("shareCard-linkedin.svg", linkedin);
}

function testHistoricalCardSnapshot() {
  const svg = generateHistoricalCardSvg({
    chaserName: "Nigeria",
    targetName: "United States",
    historicalData: {
      chaserStart: { year: 2000, value: 3400 },
      chaserCurrent: { year: 2023, value: 5400 },
      targetStart: { year: 2000, value: 42000 },
      targetCurrent: { year: 2023, value: 68000 },
    },
    theme: "light",
    siteUrl: "convergence.example.com",
    dataSource: "World Bank",
  });
  assertSnapshot("historicalCard.svg", svg);
}

function testImplicationsCardSnapshot() {
  const svg = generateImplicationsCardSvg({
    chaserName: "Nigeria",
    implicationsData: {
      electricityDeltaTWh: 320,
      nuclearPlants: 22,
      gdpCurrent: 1.3e12,
      gdpFuture: 4.9e12,
    },
    horizonYear: 2045,
    theme: "light",
    siteUrl: "convergence.example.com",
    dataSource: "World Bank",
  });
  assertSnapshot("implicationsCard.svg", svg);
}

function testSensitivityCardSnapshot() {
  const sensitivity = calculateSensitivityScenarios({
    chaserValue: 5400,
    targetValue: 68000,
    chaserGrowthRate: 0.03,
    targetGrowthRate: 0.01,
    baseYear: 2023,
    delta: 0.01,
  });

  const svg = generateSensitivityCardSvg({
    chaserName: "Nigeria",
    targetName: "United States",
    chaserValue: 5400,
    targetValue: 68000,
    sensitivity,
    baseYear: 2023,
    theme: "light",
    siteUrl: "convergence.example.com",
    dataSource: "World Bank",
  });
  assertSnapshot("sensitivityCard.svg", svg);
}

function testObservedCsvSnapshot() {
  const state = fixtureState();
  const csv = withFixedDate("2024-01-15T00:00:00.000Z", () =>
    toObservedCsv({
      state,
      indicator: fixtureIndicator(),
      countriesByIso3: {
        NGA: { name: "Nigeria" },
        USA: { name: "United States" },
      },
      data: fixtureObservedSeries(),
      toolUrl: "https://convergence.example.com",
    }),
  );
  assertSnapshot("export-observed.csv", csv);
}

function testProjectedCsvSnapshot() {
  const state = fixtureState();
  const csv = withFixedDate("2024-01-15T00:00:00.000Z", () =>
    toProjectionCsv({
      state,
      indicator: fixtureIndicator(),
      projection: fixtureProjection(),
      chaserName: "Nigeria",
      targetName: "United States",
      toolUrl: "https://convergence.example.com",
    }),
  );
  assertSnapshot("export-projected.csv", csv);
}

function testReportJsonSnapshot() {
  const state = fixtureState();
  const projection = fixtureProjection();
  const observed = fixtureObservedSeries();
  const yearsToConvergence = 97;

  const json = withFixedDate("2024-01-15T00:00:00.000Z", () =>
    toReportJson({
      state,
      indicator: fixtureIndicator(),
      countriesByIso3: {
        NGA: { name: "Nigeria" },
        USA: { name: "United States" },
      },
      observed,
      projection,
      derived: {
        yearsToConvergence,
        convergenceYear: state.baseYear + yearsToConvergence,
        gap: projection[0].target / projection[0].chaser,
      },
      toolUrl: "https://convergence.example.com",
    }),
  );
  assertSnapshot("export-report.json", json);
}

function testCitationSnapshots() {
  const ctx = fixtureCitationContext();
  assertSnapshot("citation-bibtex", generateToolCitation(ctx, "bibtex"));
  assertSnapshot("citation-apa", generateToolCitation(ctx, "apa"));
}

function testThreadCaptionsSnapshot() {
  const projection = generateProjection(5400, 68000, 0.03, 2023, 150);
  const yearsToConvergence = projection.length - 1;

  const captions = generateCaptions({
    chaserName: "Nigeria",
    targetName: "United States",
    yearsToConvergence,
    convergenceYear: 2023 + yearsToConvergence,
    chaserGrowthRate: 0.03,
    targetGrowthRate: 0.01,
    optimisticYears: Math.max(0, yearsToConvergence - 20),
    pessimisticYears: yearsToConvergence + 30,
    historicalData: {
      chaserStart: { year: 2000, value: 3400 },
      chaserCurrent: { year: 2023, value: 5400 },
      targetStart: { year: 2000, value: 42000 },
      targetCurrent: { year: 2023, value: 68000 },
    },
    implicationsData: {
      electricityDeltaTWh: 320,
      nuclearPlants: 22,
      gdpCurrent: 1.3e12,
      gdpFuture: 4.9e12,
    },
    appUrl: "https://convergence.example.com?chaser=NGA&target=USA&indicator=GDP_PCAP_PPP",
  });

  assertSnapshot("thread-captions", captions.join("\n\n"));
}

async function run() {
  const tests = [
    ["snapshot: share card svg (twitter/linkedin)", testShareCardSnapshots],
    ["snapshot: historical card svg", testHistoricalCardSnapshot],
    ["snapshot: implications card svg", testImplicationsCardSnapshot],
    ["snapshot: sensitivity card svg", testSensitivityCardSnapshot],
    ["snapshot: observed csv", testObservedCsvSnapshot],
    ["snapshot: projected csv", testProjectedCsvSnapshot],
    ["snapshot: report json", testReportJsonSnapshot],
    ["snapshot: citations", testCitationSnapshots],
    ["snapshot: thread captions", testThreadCaptionsSnapshot],
  ] as const;

  for (const [name, fn] of tests) {
    try {
      await fn();
      process.stdout.write(`ok - ${name}\n`);
    } catch (err) {
      process.stderr.write(`not ok - ${name}\n`);
      throw err;
    }
  }
}

await run();
