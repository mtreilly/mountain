import { strict as assert } from "node:assert";
import { generateShareCardPng, svgStringToPngBlob } from "../src/lib/chartExport";
import {
  buildPermalink,
  type CitationContext,
  createCitationContext,
  generateDataSourceCitation,
  generateFullCitation,
  generateToolCitation,
  getAllCitationFormats,
} from "../src/lib/citations";
import { toObservedCsv, toProjectionCsv } from "../src/lib/dataExport";
import {
  getDataSourceBaseUrl,
  getDataSourceLicense,
  getDataSourceUrl,
  getWorldBankUrl,
} from "../src/lib/dataSourceUrls";
import { calculateCagr, computeTotals, projectValue } from "../src/lib/implicationsMath";
import {
  calculateSensitivityScenarios,
  generateSensitivityProjection,
} from "../src/lib/sensitivityAnalysis";
import { getShareCardFilename, type ShareCardParams } from "../src/lib/shareCardSvg";
import {
  parseEmbedParams,
  parseShareStateFromSearch,
  toSearchString,
  toSyncedSearchString,
} from "../src/lib/shareState";

function createShareCardParams(theme: "light" | "dark" = "light"): ShareCardParams {
  return {
    chaserName: "Nigeria",
    targetName: "Ireland",
    chaserCode: "NGA",
    targetCode: "IRL",
    metricLabel: "GDP per capita (PPP)",
    projection: [
      { year: 2023, chaser: 5200, target: 89000 },
      { year: 2024, chaser: 5382, target: 90335 },
      { year: 2025, chaser: 5570, target: 91690 },
    ],
    convergenceYear: 2080,
    yearsToConvergence: 57,
    currentGap: 17.1,
    chaserGrowth: 0.035,
    targetGrowth: 0.015,
    targetMode: "growing",
    theme,
  };
}

function installCanvasDomStubs(options?: { decodeReject?: boolean }) {
  const g = globalThis as {
    Image?: typeof Image;
    document?: Document;
  };
  const originalImage = g.Image;
  const originalDocument = g.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const revoked: string[] = [];
  const drawCalls: Array<{ args: unknown[] }> = [];
  const scaleCalls: Array<{ x: number; y: number }> = [];

  const ctx = {
    scale(x: number, y: number) {
      scaleCalls.push({ x, y });
    },
    drawImage(...args: unknown[]) {
      drawCalls.push({ args });
    },
    fillRect() {
      // no-op for canvas mock
    },
    fillStyle: "white",
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext(kind: string) {
      if (kind !== "2d") return null;
      return ctx;
    },
    toBlob(callback: (blob: Blob | null) => void, type?: string) {
      callback(new Blob(["png"], { type: type ?? "image/png" }));
    },
  };

  class FakeImage {
    decoding = "async";
    src = "";

    async decode() {
      if (options?.decodeReject) {
        throw new Error("Invalid SVG");
      }
    }
  }

  URL.createObjectURL = (() => "blob:test") as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string | URL) => {
    revoked.push(String(url));
  }) as typeof URL.revokeObjectURL;
  g.Image = FakeImage as unknown as typeof Image;
  g.document = {
    createElement(tag: string) {
      if (tag === "canvas") {
        return canvas as unknown as HTMLElement;
      }
      throw new Error(`Unexpected element request: ${tag}`);
    },
  } as unknown as Document;

  return {
    canvas,
    revoked,
    drawCalls,
    scaleCalls,
    restore() {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      g.Image = originalImage;
      g.document = originalDocument;
    },
  };
}

function testShareStateRoundtrip() {
  const parsed = parseShareStateFromSearch(
    "?chaser=nga&target=irl&indicator=gdp_pcap_ppp&cg=0.0351&tg=0.0154&tmode=growing&baseYear=2023&view=table",
  );

  assert.equal(parsed.chaser, "NGA");
  assert.equal(parsed.target, "IRL");
  assert.equal(parsed.indicator, "GDP_PCAP_PPP");
  assert.equal(parsed.view, "table");
  assert.equal(parsed.baseYear, 2023);
  assert.equal(parsed.tmode, "growing");
  assert.equal(parsed.cg.toFixed(3), "0.035");
  assert.equal(parsed.tg.toFixed(3), "0.015");

  const s = toSearchString(parsed);
  assert.ok(s.includes("chaser=NGA"));
  assert.ok(s.includes("target=IRL"));
  assert.ok(s.includes("indicator=GDP_PCAP_PPP"));
}

function testStaticTargetForcesTgZero() {
  const parsed = parseShareStateFromSearch(
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=static&baseYear=2023",
  );
  assert.equal(parsed.tmode, "static");
  assert.equal(parsed.tg, 0);
  assert.ok(toSearchString(parsed).includes("tg=0"));
}

function testEmbedUrlSyncPreservesEmbedParams() {
  const search =
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tmode=growing&tg=0.015&baseYear=2023&embed=true&interactive=false&embedTheme=dark&h=500";
  const state = parseShareStateFromSearch(search);
  const embedParams = parseEmbedParams(search);

  assert.equal(embedParams.embed, true);
  assert.equal(embedParams.interactive, false);
  assert.equal(embedParams.embedTheme, "dark");
  assert.equal(embedParams.height, 500);

  const synced = toSyncedSearchString(state, embedParams);
  assert.ok(synced.includes("embed=true"));
  assert.ok(synced.includes("interactive=false"));
  assert.ok(synced.includes("embedTheme=dark"));
  assert.ok(synced.includes("h=500"));

  const nonEmbed = toSyncedSearchString(state, { embed: false });
  assert.equal(nonEmbed, toSearchString(state));
}

function testShareStateParsingBranchesAndDefaults() {
  const parsed = parseShareStateFromSearch(
    "?mode=regions&cr=us-ca&tr=ukc&impCard=elec-demand&impElecMode=mix&tpl=EU&view=table&goal=999&ih=-50&adjC=0&adjT=0&ms=0",
  );
  assert.equal(parsed.mode, "regions");
  assert.equal(parsed.cr, "US-CA");
  assert.equal(parsed.tr, "UKC");
  assert.equal(parsed.impCard, "elec-demand");
  assert.equal(parsed.impElecMode, "mix");
  assert.equal(parsed.tpl, "eu");
  assert.equal(parsed.view, "table");
  assert.equal(parsed.goal, 150);
  assert.equal(parsed.ih, 1);
  assert.equal(parsed.adjC, false);
  assert.equal(parsed.adjT, false);
  assert.equal(parsed.ms, false);

  const serialized = toSearchString(parsed);
  assert.ok(serialized.includes("mode=regions"));
  assert.ok(serialized.includes("cr=US-CA"));
  assert.ok(serialized.includes("tr=UKC"));
  assert.ok(serialized.includes("impCard=elec-demand"));
  assert.ok(serialized.includes("impElecMode=mix"));
  assert.ok(serialized.includes("tpl=eu"));
  assert.ok(serialized.includes("goal=150"));
  assert.ok(serialized.includes("ih=1"));
  assert.ok(serialized.includes("adjC=0"));
  assert.ok(serialized.includes("adjT=0"));
  assert.ok(serialized.includes("ms=0"));
  assert.ok(serialized.includes("view=table"));
}

function testShareStateInvalidInputsFallBackSafely() {
  const parsed = parseShareStateFromSearch(
    "?chaser=%20nga%20&target=%20irl%20&indicator=%20gdp_pcap_ppp%20&mode=regions&cr=??&tr=%%%&tpl=bad&impCard=bad&impElecMode=bad&view=grid&tmode=static&tg=0.123",
  );
  assert.equal(parsed.chaser, "NGA");
  assert.equal(parsed.target, "IRL");
  assert.equal(parsed.indicator, "GDP_PCAP_PPP");
  assert.equal(parsed.tmode, "static");
  assert.equal(parsed.tg, 0);
  assert.equal(parsed.mode, "regions");
  assert.equal(parsed.cr, "UKC");
  assert.equal(parsed.tr, "UKI");
  assert.equal(parsed.tpl, "china");
  assert.equal(parsed.impCard, "gdp");
  assert.equal(parsed.impElecMode, "compare");
  assert.equal(parsed.view, "chart");

  const countriesMode = parseShareStateFromSearch("?mode=countries&cr=UKC&tr=UKI");
  const countriesSearch = toSearchString(countriesMode);
  assert.ok(!countriesSearch.includes("mode=regions"));
  assert.ok(!countriesSearch.includes("cr="));
  assert.ok(!countriesSearch.includes("tr="));
}

function testEmbedParsingDefaultsAndClamps() {
  const defaults = parseEmbedParams("?embed=true");
  assert.equal(defaults.embed, true);
  assert.equal(defaults.interactive, true);
  assert.equal(defaults.embedTheme, "auto");
  assert.equal(defaults.height, 400);

  const explicit = parseEmbedParams("?embed=true&interactive=false&embedTheme=LIGHT&h=1200");
  assert.equal(explicit.embed, true);
  assert.equal(explicit.interactive, false);
  assert.equal(explicit.embedTheme, "light");
  assert.equal(explicit.height, 800);

  const clampedLow = parseEmbedParams("?embed=true&h=100");
  assert.equal(clampedLow.height, 320);
}

function testCsvExports() {
  const state = parseShareStateFromSearch(
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=growing&baseYear=2023",
  );

  const observedCsv = toObservedCsv({
    state,
    indicator: {
      code: "GDP_PCAP_PPP",
      name: "GDP per capita (PPP)",
      description: null,
      unit: "constant 2021 int$",
      source: "World Bank",
      category: "economic",
    },
    countriesByIso3: { NGA: { name: "Nigeria" }, IRL: { name: "Ireland" } },
    data: {
      NGA: [{ year: 2023, value: 5200 }],
      IRL: [{ year: 2023, value: 89000 }],
    },
  });
  // CSV now starts with citation header comments
  assert.ok(observedCsv.startsWith("# Convergence Explorer Data Export"));
  assert.ok(observedCsv.includes("# Comparison: Nigeria → Ireland"));
  assert.ok(observedCsv.includes("# Data Source: World Bank"));
  assert.ok(observedCsv.includes("country_iso3,country_name,indicator"));
  assert.ok(observedCsv.includes("NGA,Nigeria,GDP_PCAP_PPP"));
  assert.ok(observedCsv.includes("IRL,Ireland,GDP_PCAP_PPP"));

  const projectionCsv = toProjectionCsv({
    state,
    indicator: {
      code: "GDP_PCAP_PPP",
      name: "GDP per capita (PPP)",
      description: null,
      unit: "constant 2021 int$",
      source: "World Bank",
      category: "economic",
    },
    projection: [{ year: 2023, chaser: 5200, target: 89000 }],
    chaserName: "Nigeria",
    targetName: "Ireland",
  });
  // CSV now starts with citation header comments
  assert.ok(projectionCsv.startsWith("# Convergence Explorer Data Export"));
  assert.ok(projectionCsv.includes("year,chaser_iso3,chaser_value"));
  assert.ok(projectionCsv.includes("2023,NGA,5200,IRL,89000"));
}

function testImplicationsMath() {
  const projected = projectValue(100, 0.02, 10);
  assert.ok(Math.abs(projected - 121.89944199947573) < 1e-9);

  const cagr = calculateCagr({
    series: [
      { year: 2010, value: 100 },
      { year: 2020, value: 200 },
    ],
    lookbackYears: 10,
  });
  assert.ok(cagr != null);
  assert.ok(Math.abs((cagr as number) - (Math.pow(2, 1 / 10) - 1)) < 1e-12);

  const electricity = computeTotals({
    code: "ELECTRICITY_USE_PCAP",
    currentMetric: 1000,
    impliedMetric: 2000,
    popCurrent: 1_000_000,
    popFuture: 1_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(electricity.currentTotal?.unit, "TWh");
  assert.ok(Math.abs((electricity.currentTotal?.value ?? 0) - 1) < 1e-12);
  assert.ok(Math.abs((electricity.impliedTotal?.value ?? 0) - 2) < 1e-12);

  const co2 = computeTotals({
    code: "CO2_PCAP",
    currentMetric: 2,
    impliedMetric: 3,
    popCurrent: 1_000_000,
    popFuture: 2_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(co2.currentTotal?.unit, "MtCO2");
  assert.ok(Math.abs((co2.currentTotal?.value ?? 0) - 2) < 1e-12);
  assert.ok(Math.abs((co2.impliedTotal?.value ?? 0) - 6) < 1e-12);

  const urban = computeTotals({
    code: "URBAN_POP_PCT",
    currentMetric: 50,
    impliedMetric: 60,
    popCurrent: 1_000_000,
    popFuture: 2_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(urban.currentTotal?.unit, "persons");
  assert.equal(Math.round(urban.currentTotal?.value ?? 0), 500_000);
  assert.equal(Math.round(urban.impliedTotal?.value ?? 0), 1_200_000);

  const industry = computeTotals({
    code: "INDUSTRY_VA_PCT_GDP",
    currentMetric: 20,
    impliedMetric: 10,
    popCurrent: 1_000_000,
    popFuture: 2_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(industry.currentTotal?.unit, "int$");
  assert.equal(industry.currentTotal?.value, 0.2 * 10_000 * 1_000_000);
  assert.equal(industry.impliedTotal?.value, 0.1 * 20_000 * 2_000_000);
}

function testImplicationsMathGuardsAndClamps() {
  assert.equal(calculateCagr({ series: [], lookbackYears: 10 }), null);
  assert.equal(
    calculateCagr({
      series: [{ year: 2023, value: 0 }],
      lookbackYears: 10,
    }),
    null,
  );
  assert.equal(
    calculateCagr({
      series: [
        { year: 2023, value: 100 },
        { year: 2023, value: 120 },
      ],
      lookbackYears: 10,
    }),
    null,
  );

  const unsorted = calculateCagr({
    series: [
      { year: 2020, value: 121 },
      { year: 2010, value: 100 },
    ],
    lookbackYears: 10,
  });
  assert.ok(unsorted != null);
  assert.ok(Math.abs((unsorted as number) - 0.019244876491456564) < 1e-12);

  const missingPop = computeTotals({
    code: "ENERGY_USE_PCAP",
    currentMetric: 1000,
    impliedMetric: 2000,
    popCurrent: null,
    popFuture: 1_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.deepEqual(missingPop, { currentTotal: null, impliedTotal: null });

  const negativePerCap = computeTotals({
    code: "CO2_PCAP",
    currentMetric: -5,
    impliedMetric: -3,
    popCurrent: 1_000_000,
    popFuture: 1_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(negativePerCap.currentTotal?.unit, "MtCO2");
  assert.equal(negativePerCap.currentTotal?.value, 0);
  assert.equal(negativePerCap.impliedTotal?.value, 0);
}

function testImplicationsMathCagrLookbackSelection() {
  const cagrUsingLookbackPoint = calculateCagr({
    series: [
      { year: 2000, value: 100 },
      { year: 2010, value: 150 },
      { year: 2020, value: 300 },
    ],
    lookbackYears: 5,
  });
  assert.ok(cagrUsingLookbackPoint != null);
  // targetYear=2015 should select 2010, so CAGR=(300/150)^(1/10)-1
  assert.ok(Math.abs((cagrUsingLookbackPoint as number) - (Math.pow(2, 1 / 10) - 1)) < 1e-12);

  const cagrFallbackEarliest = calculateCagr({
    series: [
      { year: 2018, value: 100 },
      { year: 2020, value: 121 },
    ],
    lookbackYears: 20,
  });
  assert.ok(cagrFallbackEarliest != null);
  assert.ok(Math.abs((cagrFallbackEarliest as number) - 0.1) < 1e-12);

  const invalidEarlier = calculateCagr({
    series: [
      { year: 2010, value: Number.NaN },
      { year: 2020, value: 200 },
    ],
    lookbackYears: 10,
  });
  assert.equal(invalidEarlier, null);
}

function testImplicationsMathComputeTotalsByCode() {
  const energy = computeTotals({
    code: "ENERGY_USE_PCAP",
    currentMetric: 1000,
    impliedMetric: 2000,
    popCurrent: 2_000_000,
    popFuture: 3_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 12_000,
  });
  assert.equal(energy.currentTotal?.unit, "toe");
  assert.equal(energy.currentTotal?.value, 2_000_000);
  assert.equal(energy.impliedTotal?.value, 6_000_000);

  const electricityPartialMetric = computeTotals({
    code: "ELECTRICITY_USE_PCAP",
    currentMetric: null,
    impliedMetric: 1500,
    popCurrent: 1_000_000,
    popFuture: 2_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(electricityPartialMetric.currentTotal, null);
  assert.equal(electricityPartialMetric.impliedTotal?.unit, "TWh");
  assert.equal(electricityPartialMetric.impliedTotal?.value, 3);

  const urbanClamped = computeTotals({
    code: "URBAN_POP_PCT",
    currentMetric: 120,
    impliedMetric: -20,
    popCurrent: 1_000_000,
    popFuture: 2_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.equal(urbanClamped.currentTotal?.unit, "persons");
  assert.equal(urbanClamped.currentTotal?.value, 1_000_000);
  assert.equal(urbanClamped.impliedTotal?.value, 0);

  const industryMissingCurrentPop = computeTotals({
    code: "INDUSTRY_VA_PCT_GDP",
    currentMetric: 30,
    impliedMetric: 40,
    popCurrent: null,
    popFuture: 2_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.deepEqual(industryMissingCurrentPop, { currentTotal: null, impliedTotal: null });

  const industryMissingFuturePop = computeTotals({
    code: "CAPITAL_FORMATION_PCT_GDP",
    currentMetric: 30,
    impliedMetric: 40,
    popCurrent: 1_000_000,
    popFuture: null,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 20_000,
  });
  assert.deepEqual(industryMissingFuturePop, { currentTotal: null, impliedTotal: null });

  const unknownCode = computeTotals({
    code: "GDP_PCAP_PPP",
    currentMetric: 1,
    impliedMetric: 1,
    popCurrent: 1_000_000,
    popFuture: 1_000_000,
    gdpPcapCurrent: 10_000,
    gdpPcapFuture: 10_000,
  });
  assert.deepEqual(unknownCode, { currentTotal: null, impliedTotal: null });
}

function testImplicationsMathNullHandlingMatrix() {
  const perCapCodes = [
    "ENERGY_USE_PCAP",
    "ELECTRICITY_USE_PCAP",
    "CO2_PCAP",
    "URBAN_POP_PCT",
  ] as const;
  for (const code of perCapCodes) {
    const missingCurrentPop = computeTotals({
      code,
      currentMetric: 10,
      impliedMetric: 20,
      popCurrent: null,
      popFuture: 1_000_000,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.deepEqual(missingCurrentPop, { currentTotal: null, impliedTotal: null });

    const missingFuturePop = computeTotals({
      code,
      currentMetric: 10,
      impliedMetric: 20,
      popCurrent: 1_000_000,
      popFuture: null,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.deepEqual(missingFuturePop, { currentTotal: null, impliedTotal: null });

    const missingCurrentMetric = computeTotals({
      code,
      currentMetric: null,
      impliedMetric: 20,
      popCurrent: 1_000_000,
      popFuture: 1_000_000,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.equal(missingCurrentMetric.currentTotal, null);
    assert.ok(missingCurrentMetric.impliedTotal != null);

    const missingImpliedMetric = computeTotals({
      code,
      currentMetric: 10,
      impliedMetric: null,
      popCurrent: 1_000_000,
      popFuture: 1_000_000,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.ok(missingImpliedMetric.currentTotal != null);
    assert.equal(missingImpliedMetric.impliedTotal, null);
  }

  const gdpCodes = ["INDUSTRY_VA_PCT_GDP", "CAPITAL_FORMATION_PCT_GDP"] as const;
  for (const code of gdpCodes) {
    const missingCurrentPop = computeTotals({
      code,
      currentMetric: 10,
      impliedMetric: 20,
      popCurrent: null,
      popFuture: 1_000_000,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.deepEqual(missingCurrentPop, { currentTotal: null, impliedTotal: null });

    const missingFuturePop = computeTotals({
      code,
      currentMetric: 10,
      impliedMetric: 20,
      popCurrent: 1_000_000,
      popFuture: null,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.deepEqual(missingFuturePop, { currentTotal: null, impliedTotal: null });

    const missingCurrentMetric = computeTotals({
      code,
      currentMetric: null,
      impliedMetric: 20,
      popCurrent: 1_000_000,
      popFuture: 1_000_000,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.equal(missingCurrentMetric.currentTotal, null);
    assert.ok(missingCurrentMetric.impliedTotal != null);

    const missingImpliedMetric = computeTotals({
      code,
      currentMetric: 10,
      impliedMetric: null,
      popCurrent: 1_000_000,
      popFuture: 1_000_000,
      gdpPcapCurrent: 10_000,
      gdpPcapFuture: 20_000,
    });
    assert.ok(missingImpliedMetric.currentTotal != null);
    assert.equal(missingImpliedMetric.impliedTotal, null);
  }
}

function testSensitivityEdgeCases() {
  const alreadyConverged = calculateSensitivityScenarios({
    chaserValue: 100,
    targetValue: 100,
    chaserGrowthRate: 0.05,
    targetGrowthRate: 0.01,
    baseYear: 2023,
    delta: 0.01,
  });
  assert.equal(alreadyConverged.baseline.yearsToConvergence, 0);
  assert.equal(alreadyConverged.baseline.convergenceYear, 2023);

  const neverConverges = calculateSensitivityScenarios({
    chaserValue: 50,
    targetValue: 100,
    chaserGrowthRate: 0.01,
    targetGrowthRate: 0.02,
    baseYear: 2023,
    delta: 0.01,
  });
  assert.equal(neverConverges.baseline.yearsToConvergence, null);
  assert.equal(neverConverges.optimistic.yearsToConvergence, null);
  assert.equal(neverConverges.pessimistic.yearsToConvergence, null);

  const immediate = generateSensitivityProjection(100, 100, 0.03, 0.01, 2020, 50);
  assert.equal(immediate.length, 1);
  assert.equal(immediate[0].year, 2020);
}

// === Citation Tests ===

function createTestCitationContext(): CitationContext {
  const state = parseShareStateFromSearch(
    "?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&cg=0.05&tg=0.03&tmode=growing&baseYear=2023",
  );
  return {
    toolName: "Convergence Explorer",
    toolUrl: "https://convergence.example.com",
    accessDate: new Date("2024-01-15"),
    chaserName: "India",
    chaserIso: "IND",
    targetName: "China",
    targetIso: "CHN",
    indicatorName: "GDP per capita (PPP)",
    indicatorCode: "GDP_PCAP_PPP",
    dataSource: "World Bank",
    dataSourceCode: "NY.GDP.PCAP.PP.KD",
    state,
  };
}

function testBibtexCitation() {
  const ctx = createTestCitationContext();
  const citation = generateToolCitation(ctx, "bibtex");

  // Check structure
  assert.ok(citation.startsWith("@misc{convergence2024indchn,"));
  assert.ok(citation.includes("title = {Convergence Explorer:"));
  assert.ok(citation.includes("India to China: GDP per capita (PPP) convergence analysis"));
  assert.ok(citation.includes("url = {https://convergence.example.com"));
  assert.ok(citation.includes("urldate = {2024-01-15}"));
  assert.ok(citation.includes("}"));
}

function testApaCitation() {
  const ctx = createTestCitationContext();
  const citation = generateToolCitation(ctx, "apa");

  assert.ok(citation.includes("Convergence Explorer. (n.d.)."));
  assert.ok(citation.includes("India to China: GDP per capita (PPP) convergence analysis"));
  assert.ok(citation.includes("Retrieved January 15, 2024"));
  assert.ok(citation.includes("https://convergence.example.com"));
}

function testChicagoCitation() {
  const ctx = createTestCitationContext();
  const citation = generateToolCitation(ctx, "chicago");

  assert.ok(citation.startsWith('"India to China: GDP per capita (PPP) convergence analysis."'));
  assert.ok(citation.includes("Convergence Explorer."));
  assert.ok(citation.includes("Accessed January 15, 2024"));
  assert.ok(citation.includes("https://convergence.example.com"));
}

function testPlaintextCitation() {
  const ctx = createTestCitationContext();
  const citation = generateToolCitation(ctx, "plaintext");

  assert.ok(
    citation.includes(
      "Convergence Explorer - India to China: GDP per capita (PPP) convergence analysis",
    ),
  );
  assert.ok(citation.includes("URL: https://convergence.example.com"));
  assert.ok(citation.includes("Accessed: January 15, 2024"));
}

function testDataSourceCitation() {
  const bibtex = generateDataSourceCitation(
    "World Bank",
    "NY.GDP.PCAP.PP.KD",
    "GDP per capita (PPP)",
    "GDP_PCAP_PPP",
    new Date("2024-01-15"),
    "bibtex",
  );

  assert.ok(bibtex.startsWith("@misc{worldbank2024gdppcapppp,"));
  assert.ok(bibtex.includes("author = {{World Bank}}"));
  assert.ok(bibtex.includes("title = {GDP per capita (PPP)}"));
  assert.ok(bibtex.includes("url = {https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD}"));

  const apa = generateDataSourceCitation(
    "World Bank",
    "NY.GDP.PCAP.PP.KD",
    "GDP per capita (PPP)",
    "GDP_PCAP_PPP",
    new Date("2024-01-15"),
    "apa",
  );
  assert.ok(apa.includes("World Bank. (2024). GDP per capita (PPP) [Data set]."));
}

function testFullCitation() {
  const ctx = createTestCitationContext();
  const full = generateFullCitation(ctx, "bibtex");

  // Should contain both tool and data source citations
  assert.ok(full.includes("@misc{convergence2024indchn,"));
  assert.ok(full.includes("@misc{worldbank2024gdppcapppp,"));
}

function testBuildPermalink() {
  const state = parseShareStateFromSearch(
    "?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&cg=0.05&tg=0.03&tmode=growing&baseYear=2023",
  );
  const permalink = buildPermalink("https://example.com", state);

  assert.ok(permalink.startsWith("https://example.com?"));
  assert.ok(permalink.includes("chaser=IND"));
  assert.ok(permalink.includes("target=CHN"));
  assert.ok(permalink.includes("v=1")); // Version param for URL stability
}

function testCreateCitationContext() {
  const state = parseShareStateFromSearch(
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=growing&baseYear=2023",
  );

  const ctx = createCitationContext({
    state,
    indicator: {
      code: "GDP_PCAP_PPP",
      name: "GDP per capita (PPP)",
      description: null,
      unit: "constant 2021 int$",
      source: "World Bank",
      category: "economic",
    },
    chaserName: "Nigeria",
    targetName: "Ireland",
    toolUrl: "https://test.com",
    accessDate: new Date("2024-06-01"),
  });

  assert.equal(ctx.chaserName, "Nigeria");
  assert.equal(ctx.targetName, "Ireland");
  assert.equal(ctx.chaserIso, "NGA");
  assert.equal(ctx.targetIso, "IRL");
  assert.equal(ctx.indicatorName, "GDP per capita (PPP)");
  assert.equal(ctx.dataSource, "World Bank");
  assert.equal(ctx.toolUrl, "https://test.com");
}

function testGetAllCitationFormats() {
  const ctx = createTestCitationContext();
  const formats = getAllCitationFormats(ctx);

  assert.ok("bibtex" in formats);
  assert.ok("apa" in formats);
  assert.ok("chicago" in formats);
  assert.ok("plaintext" in formats);

  // Each format should be a non-empty string
  assert.ok(formats.bibtex.length > 0);
  assert.ok(formats.apa.length > 0);
  assert.ok(formats.chicago.length > 0);
  assert.ok(formats.plaintext.length > 0);
}

function testBibtexEscaping() {
  // Test that special characters are escaped in BibTeX
  const ctx = createTestCitationContext();
  ctx.chaserName = "Country & Territory";
  ctx.indicatorName = "GDP 100% growth";

  const citation = generateToolCitation(ctx, "bibtex");

  // & should be escaped
  assert.ok(citation.includes("Country \\& Territory"));
  // % should be escaped
  assert.ok(citation.includes("GDP 100\\% growth"));
}

function testNullDataSource() {
  const ctx = createTestCitationContext();
  ctx.dataSource = null;
  ctx.dataSourceCode = null;

  const full = generateFullCitation(ctx, "bibtex");

  // Should only have tool citation, no data source citation
  assert.ok(full.includes("@misc{convergence2024indchn,"));
  assert.ok(!full.includes("worldbank"));
}

// === Data Source URL Tests ===

function testDataSourceUrls() {
  // World Bank
  const wbUrl = getDataSourceUrl("World Bank", "NY.GDP.PCAP.PP.KD");
  assert.equal(wbUrl, "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD");

  // World Bank without code
  const wbBaseUrl = getDataSourceUrl("World Bank", null);
  assert.equal(wbBaseUrl, "https://data.worldbank.org");

  // UNDP (no code needed)
  const undpUrl = getDataSourceUrl("UNDP", null);
  assert.equal(undpUrl, "https://hdr.undp.org/data-center/human-development-index");

  // Penn World Table
  const pwtUrl = getDataSourceUrl("Penn World Table", "pwt11.0:rgdpe/pop");
  assert.equal(pwtUrl, "https://doi.org/10.34894/FABVLR");

  // Our World in Data with special format
  const owidUrl = getDataSourceUrl("Our World in Data", "owid-co2-data:co2_per_capita");
  assert.equal(owidUrl, "https://github.com/owid/co2-data");

  // Unknown source
  const unknownUrl = getDataSourceUrl("Unknown Source", "CODE");
  assert.equal(unknownUrl, null);
}

function testDataSourceBaseUrls() {
  assert.equal(getDataSourceBaseUrl("World Bank"), "https://data.worldbank.org");
  assert.equal(getDataSourceBaseUrl("Penn World Table"), "https://doi.org/10.34894/FABVLR");
  assert.equal(getDataSourceBaseUrl("UNDP"), "https://hdr.undp.org/data-center");
  assert.equal(getDataSourceBaseUrl("Our World in Data"), "https://ourworldindata.org");
  assert.equal(getDataSourceBaseUrl("Unknown"), null);
}

function testWorldBankUrls() {
  const gdpUrl = getWorldBankUrl("GDP_PCAP_PPP");
  assert.equal(gdpUrl, "https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD");

  const popUrl = getWorldBankUrl("POPULATION");
  assert.equal(popUrl, "https://data.worldbank.org/indicator/SP.POP.TOTL");

  const unknownUrl = getWorldBankUrl("UNKNOWN_INDICATOR");
  assert.equal(unknownUrl, null);
}

function testDataSourceLicenses() {
  const wbLicense = getDataSourceLicense("World Bank");
  assert.equal(wbLicense?.name, "CC-BY 4.0");
  assert.ok(wbLicense?.url.includes("worldbank.org"));

  const undpLicense = getDataSourceLicense("UNDP");
  assert.equal(undpLicense?.name, "CC-BY 3.0 IGO");

  const pwtLicense = getDataSourceLicense("Penn World Table");
  assert.equal(pwtLicense?.name, "CC-BY 4.0");
  assert.ok(pwtLicense?.url.includes("creativecommons.org"));

  const owidLicense = getDataSourceLicense("Our World in Data");
  assert.equal(owidLicense?.name, "CC-BY 4.0");

  const unknownLicense = getDataSourceLicense("Unknown");
  assert.equal(unknownLicense, null);
}

async function testChartExportSvgStringToPngRespectsDimensions() {
  const stubs = installCanvasDomStubs();
  try {
    const blob = await svgStringToPngBlob(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8"></svg>',
      { width: 1200, height: 627 },
      2,
    );

    assert.equal(blob.type, "image/png");
    assert.equal(stubs.canvas.width, 2400);
    assert.equal(stubs.canvas.height, 1254);
    assert.equal(stubs.scaleCalls.length, 1);
    assert.deepEqual(stubs.scaleCalls[0], { x: 2, y: 2 });
    assert.equal(stubs.drawCalls.length, 1);
    assert.equal(stubs.drawCalls[0].args[3], 1200);
    assert.equal(stubs.drawCalls[0].args[4], 627);
    assert.deepEqual(stubs.revoked, ["blob:test"]);
  } finally {
    stubs.restore();
  }
}

async function testChartExportInvalidSvgFailsGracefully() {
  const stubs = installCanvasDomStubs({ decodeReject: true });
  try {
    await assert.rejects(
      () => svgStringToPngBlob("<svg><invalid></svg>", { width: 100, height: 50 }, 2),
      /Invalid SVG/,
    );
    assert.deepEqual(stubs.revoked, ["blob:test"]);
  } finally {
    stubs.restore();
  }
}

async function testChartExportGenerateShareCardPngUsesRequestedSize() {
  const stubs = installCanvasDomStubs();
  try {
    const blob = await generateShareCardPng(createShareCardParams("dark"), "linkedin");
    assert.equal(blob.type, "image/png");
    assert.equal(stubs.canvas.width, 2400);
    assert.equal(stubs.canvas.height, 1254);
    assert.equal(stubs.drawCalls.length, 1);
    assert.equal(stubs.drawCalls[0].args[3], 1200);
    assert.equal(stubs.drawCalls[0].args[4], 627);
  } finally {
    stubs.restore();
  }
}

function testShareCardFilenamePattern() {
  const filename = getShareCardFilename(createShareCardParams("dark"), "twitter");
  assert.ok(filename.endsWith(".png"));
  assert.ok(filename.includes("convergence-NGA-IRL-twitter-dark-"));
  assert.ok(/\d{4}-\d{2}-\d{2}\.png$/.test(filename));
}

async function run() {
  const tests = [
    ["shareState roundtrip", testShareStateRoundtrip],
    ["tmode static forces tg=0", testStaticTargetForcesTgZero],
    ["embed mode preserves embed params", testEmbedUrlSyncPreservesEmbedParams],
    ["shareState parsing branches and defaults", testShareStateParsingBranchesAndDefaults],
    ["shareState invalid inputs fallback", testShareStateInvalidInputsFallBackSafely],
    ["embed params default and clamping", testEmbedParsingDefaultsAndClamps],
    ["csv exports", testCsvExports],
    ["implications math", testImplicationsMath],
    ["implications math guards and clamping", testImplicationsMathGuardsAndClamps],
    ["implications math cagr lookback selection", testImplicationsMathCagrLookbackSelection],
    ["implications math totals by code", testImplicationsMathComputeTotalsByCode],
    ["implications math null handling matrix", testImplicationsMathNullHandlingMatrix],
    ["sensitivity edge cases", testSensitivityEdgeCases],
    // Citation tests
    ["citations: bibtex format", testBibtexCitation],
    ["citations: apa format", testApaCitation],
    ["citations: chicago format", testChicagoCitation],
    ["citations: plaintext format", testPlaintextCitation],
    ["citations: data source citation", testDataSourceCitation],
    ["citations: full citation", testFullCitation],
    ["citations: build permalink", testBuildPermalink],
    ["citations: create context", testCreateCitationContext],
    ["citations: get all formats", testGetAllCitationFormats],
    ["citations: bibtex escaping", testBibtexEscaping],
    ["citations: null data source", testNullDataSource],
    // Data source URL tests
    ["dataSourceUrls: get urls", testDataSourceUrls],
    ["dataSourceUrls: base urls", testDataSourceBaseUrls],
    ["dataSourceUrls: world bank urls", testWorldBankUrls],
    ["dataSourceUrls: licenses", testDataSourceLicenses],
    ["chartExport: svg string png dimensions", testChartExportSvgStringToPngRespectsDimensions],
    ["chartExport: invalid svg failure path", testChartExportInvalidSvgFailsGracefully],
    [
      "chartExport: share card png requested size",
      testChartExportGenerateShareCardPngUsesRequestedSize,
    ],
    ["chartExport: filename pattern", testShareCardFilenamePattern],
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
