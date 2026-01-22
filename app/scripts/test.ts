import { strict as assert } from "node:assert";
import {
  parseEmbedParams,
  parseShareStateFromSearch,
  toSearchString,
  toSyncedSearchString,
} from "../src/lib/shareState";
import { toObservedCsv, toProjectionCsv } from "../src/lib/dataExport";
import { calculateCagr, computeTotals, projectValue } from "../src/lib/implicationsMath";
import {
  generateToolCitation,
  generateDataSourceCitation,
  generateFullCitation,
  createCitationContext,
  buildPermalink,
  getAllCitationFormats,
  type CitationContext,
} from "../src/lib/citations";
import {
  getDataSourceUrl,
  getDataSourceBaseUrl,
  getWorldBankUrl,
  getDataSourceLicense,
} from "../src/lib/dataSourceUrls";

function testShareStateRoundtrip() {
  const parsed = parseShareStateFromSearch(
    "?chaser=nga&target=irl&indicator=gdp_pcap_ppp&cg=0.0351&tg=0.0154&tmode=growing&baseYear=2023&view=table"
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
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=static&baseYear=2023"
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

function testCsvExports() {
  const state = parseShareStateFromSearch(
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=growing&baseYear=2023"
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

// === Citation Tests ===

function createTestCitationContext(): CitationContext {
  const state = parseShareStateFromSearch(
    "?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&cg=0.05&tg=0.03&tmode=growing&baseYear=2023"
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

  assert.ok(citation.includes("Convergence Explorer - India to China: GDP per capita (PPP) convergence analysis"));
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
    "bibtex"
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
    "apa"
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
    "?chaser=IND&target=CHN&indicator=GDP_PCAP_PPP&cg=0.05&tg=0.03&tmode=growing&baseYear=2023"
  );
  const permalink = buildPermalink("https://example.com", state);

  assert.ok(permalink.startsWith("https://example.com?"));
  assert.ok(permalink.includes("chaser=IND"));
  assert.ok(permalink.includes("target=CHN"));
  assert.ok(permalink.includes("v=1")); // Version param for URL stability
}

function testCreateCitationContext() {
  const state = parseShareStateFromSearch(
    "?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=growing&baseYear=2023"
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

  // Our World in Data with special format
  const owidUrl = getDataSourceUrl("Our World in Data", "owid-co2-data:co2_per_capita");
  assert.equal(owidUrl, "https://github.com/owid/co2-data");

  // Unknown source
  const unknownUrl = getDataSourceUrl("Unknown Source", "CODE");
  assert.equal(unknownUrl, null);
}

function testDataSourceBaseUrls() {
  assert.equal(getDataSourceBaseUrl("World Bank"), "https://data.worldbank.org");
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

  const owidLicense = getDataSourceLicense("Our World in Data");
  assert.equal(owidLicense?.name, "CC-BY 4.0");

  const unknownLicense = getDataSourceLicense("Unknown");
  assert.equal(unknownLicense, null);
}

function run() {
  const tests = [
    ["shareState roundtrip", testShareStateRoundtrip],
    ["tmode static forces tg=0", testStaticTargetForcesTgZero],
    ["embed mode preserves embed params", testEmbedUrlSyncPreservesEmbedParams],
    ["csv exports", testCsvExports],
    ["implications math", testImplicationsMath],
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
  ] as const;

  for (const [name, fn] of tests) {
    try {
      fn();
      process.stdout.write(`ok - ${name}\n`);
    } catch (err) {
      process.stderr.write(`not ok - ${name}\n`);
      throw err;
    }
  }
}

run();
