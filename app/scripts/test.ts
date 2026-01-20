import { strict as assert } from "node:assert";
import { parseShareStateFromSearch, toSearchString } from "../src/lib/shareState";
import { toObservedCsv, toProjectionCsv } from "../src/lib/dataExport";

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
  assert.ok(observedCsv.startsWith("country_iso3,country_name,indicator"));
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
  });
  assert.ok(projectionCsv.startsWith("year,chaser_iso3,chaser_value"));
  assert.ok(projectionCsv.includes("2023,NGA,5200,IRL,89000"));
}

function run() {
  const tests = [
    ["shareState roundtrip", testShareStateRoundtrip],
    ["tmode static forces tg=0", testStaticTargetForcesTgZero],
    ["csv exports", testCsvExports],
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

