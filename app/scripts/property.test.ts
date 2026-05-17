import { strict as assert } from "node:assert";
import fc from "fast-check";
import {
  buildPermalink,
  type CitationContext,
  generateDataSourceCitation,
  generateToolCitation,
} from "../src/lib/citations";
import {
  calculateMilestones,
  calculateRequiredChaserGrowthRate,
  calculateYearsToConvergence,
  formatMetricValue,
  formatNumber,
  formatPercent,
  formatYears,
  generateProjection,
} from "../src/lib/convergence";
import { applyAdjustment, COUNTRY_ADJUSTMENTS, getAdjustment } from "../src/lib/countryAdjustments";
import { toObservedCsv, toProjectionCsv, toReportJson } from "../src/lib/dataExport";
import {
  getDataSourceBaseUrl,
  getDataSourceLicense,
  getDataSourceUrl,
  getWorldBankUrl,
  WORLD_BANK_INDICATOR_CODES,
} from "../src/lib/dataSourceUrls";
import { benchmarkGrowthRate, GROWTH_BENCHMARKS } from "../src/lib/growthBenchmarks";
import {
  generateAllHeadlines,
  generateHeadline,
  getShareUrl,
  type HeadlineData,
} from "../src/lib/headlineGenerator";
import { generateHistoricalCardSvg } from "../src/lib/historicalCardSvg";
import { generateImplicationsCardSvg } from "../src/lib/implicationsCardSvg";
import { calculateCagr, computeTotals, projectValue } from "../src/lib/implicationsMath";
import {
  applyScenarioToImpliedMetric,
  IMPLICATION_SCENARIOS,
  type ScenarioId,
} from "../src/lib/implicationsScenarios";
import {
  ALL_TL2_REGIONS,
  buildOECDApiUrl,
  COUNTRIES_WITH_REGIONS,
  calculateRegionalConvergence,
  getLatestRegionData,
  getRegionByCode,
  getRegionsByCountry,
  type OECDRegion,
  type OECDRegionData,
  STATIC_REGION_DATA,
} from "../src/lib/oecdRegions";
import {
  toRegionalObservedCsv,
  toRegionalProjectionCsv,
  toRegionalReportJson,
} from "../src/lib/regionsDataExport";
import {
  calculateSensitivityScenarios,
  generateSensitivityProjection,
} from "../src/lib/sensitivityAnalysis";
import { generateSensitivityCardSvg } from "../src/lib/sensitivityCardSvg";
import {
  generateShareCardSvg,
  getShareCardFilename,
  type ShareCardParams,
} from "../src/lib/shareCardSvg";
import {
  DEFAULT_EMBED_PARAMS,
  DEFAULT_SHARE_STATE,
  type EmbedParams,
  parseEmbedParams,
  parseShareStateFromSearch,
  type ShareState,
  toEmbedSearchString,
  toSearchString,
  toSyncedSearchString,
} from "../src/lib/shareState";
import {
  buildTemplateMapping,
  estimateFromTemplate,
  IMPLICATION_METRIC_CODES,
  type ImplicationMetricCode,
} from "../src/lib/templatePaths";
import { generateCaptions } from "../src/lib/threadGenerator";
import type { Indicator } from "../src/types";

function approxEqual(a: number, b: number, rel = 1e-10, abs = 1e-12) {
  const diff = Math.abs(a - b);
  if (diff <= abs) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff / scale <= rel;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isIso3(s: string) {
  return /^[A-Z]{3}$/.test(s);
}

function isIndicatorCode(s: string) {
  return /^[A-Z0-9_]{2,64}$/.test(s);
}

function hasBalancedUnescapedBraces(input: string) {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const escaped = i > 0 && input[i - 1] === "\\";
    if (escaped) continue;
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hasUnescapedBibtexSpecial(input: string) {
  return /(^|[^\\])[&%$#_]/.test(input);
}

function extractBibtexField(citation: string, field: string) {
  const line = citation.split("\n").find((l) => l.trimStart().startsWith(`${field} = {`));
  if (!line) return null;
  const start = line.indexOf("{");
  const end = line.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return line.slice(start + 1, end);
}

function normalizeStateLoose(state: ShareState): ShareState {
  // Normalize via URL encode/decode, applying the same clamps/rounding as real app URLs.
  return parseShareStateFromSearch(toSearchString(state), DEFAULT_SHARE_STATE);
}

function assertShareStateInvariants(state: ShareState) {
  assert.ok(isIso3(state.chaser));
  assert.ok(isIso3(state.target));
  assert.ok(isIndicatorCode(state.indicator));
  assert.ok(state.baseYear >= 1950 && state.baseYear <= 2100);
  assert.ok(state.cg >= -0.05 && state.cg <= 0.12);
  assert.ok(approxEqual(state.cg, Math.round(state.cg * 1000) / 1000, 0, 1e-12));
  assert.ok(state.tmode === "growing" || state.tmode === "static");
  if (state.tmode === "static") {
    assert.equal(state.tg, 0);
  } else {
    assert.ok(state.tg >= -0.05 && state.tg <= 0.08);
    assert.ok(approxEqual(state.tg, Math.round(state.tg * 1000) / 1000, 0, 1e-12));
  }
  if (state.view != null) assert.ok(state.view === "chart" || state.view === "table");
  if (state.goal != null) assert.ok(state.goal >= 1 && state.goal <= 150);
  if (state.ih != null) assert.ok(state.ih >= 1 && state.ih <= 150);
  if (state.tpl != null)
    assert.ok(state.tpl === "china" || state.tpl === "us" || state.tpl === "eu");
  if (state.mode != null) assert.ok(state.mode === "countries" || state.mode === "regions");
}

const arbIso3 = fc
  .tuple(
    fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
    fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
    fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
  )
  .map(([a, b, c]) => `${a}${b}${c}`);

const arbIndicatorCode = fc
  .array(fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_" as const).split("")), {
    minLength: 2,
    maxLength: 32,
  })
  .map((xs) => xs.join(""));

const arbShareStateLoose: fc.Arbitrary<ShareState> = fc.record(
  {
    chaser: fc.oneof(arbIso3, fc.string({ maxLength: 12 })),
    target: fc.oneof(arbIso3, fc.string({ maxLength: 12 })),
    indicator: fc.oneof(arbIndicatorCode, fc.string({ maxLength: 80 })),
    cg: fc.double({ min: -10, max: 10, noNaN: true, noInfinity: true }),
    tg: fc.double({ min: -10, max: 10, noNaN: true, noInfinity: true }),
    tmode: fc.constantFrom("growing", "static"),
    baseYear: fc.integer({ min: -2000, max: 5000 }),
    view: fc.option(fc.constantFrom("chart", "table"), { nil: undefined }),
    adjC: fc.option(fc.boolean(), { nil: undefined }),
    adjT: fc.option(fc.boolean(), { nil: undefined }),
    goal: fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: undefined }),
    ms: fc.option(fc.boolean(), { nil: undefined }),
    tpl: fc.option(fc.constantFrom("china", "us", "eu"), { nil: undefined }),
    ih: fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: undefined }),
    impCard: fc.option(
      fc.constantFrom("gdp", "elec-demand", "elec-mix", "elec-assumptions", "urban", "co2"),
      { nil: undefined },
    ),
    impElecMode: fc.option(fc.constantFrom("compare", "mix"), { nil: undefined }),
    mode: fc.option(fc.constantFrom("countries", "regions"), { nil: undefined }),
    cr: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
    tr: fc.option(fc.string({ maxLength: 8 }), { nil: undefined }),
  },
  { requiredKeys: ["chaser", "target", "indicator", "cg", "tg", "tmode", "baseYear"] },
);

function testShareStateNormalizeIdempotent() {
  fc.assert(
    fc.property(arbShareStateLoose, (s) => {
      const n1 = normalizeStateLoose(s);
      const n2 = normalizeStateLoose(n1);
      assert.deepEqual(n2, n1);
    }),
    { numRuns: 250 },
  );
}

function testShareStateParsedInvariants() {
  fc.assert(
    fc.property(arbShareStateLoose, (s) => {
      const normalized = normalizeStateLoose(s);
      assertShareStateInvariants(normalized);
    }),
    { numRuns: 250 },
  );
}

const arbEmbedParamsPartial = fc.record(
  {
    embed: fc.option(fc.boolean(), { nil: undefined }),
    interactive: fc.option(fc.boolean(), { nil: undefined }),
    embedTheme: fc.option(fc.constantFrom("light", "dark", "auto" as const), { nil: undefined }),
    height: fc.option(fc.integer({ min: 1, max: 2000 }), { nil: undefined }),
  },
  { requiredKeys: [] },
);

function expectedParsedEmbedParams(partial: Partial<EmbedParams>): EmbedParams {
  const embed = true;
  const interactive = partial.interactive === false ? false : DEFAULT_EMBED_PARAMS.interactive;
  const embedTheme =
    partial.embedTheme === "light" || partial.embedTheme === "dark"
      ? partial.embedTheme
      : DEFAULT_EMBED_PARAMS.embedTheme;
  const height =
    partial.height == null || partial.height === 400
      ? DEFAULT_EMBED_PARAMS.height
      : clamp(partial.height, 320, 800);
  return { embed, interactive, embedTheme, height };
}

function testEmbedParamsRoundtrip() {
  fc.assert(
    fc.property(arbShareStateLoose, arbEmbedParamsPartial, (s, partial) => {
      const normalized = normalizeStateLoose(s);
      const search = toEmbedSearchString(normalized, partial);
      const parsed = parseEmbedParams(search);
      assert.deepEqual(parsed, expectedParsedEmbedParams(partial));

      const synced = toSyncedSearchString(normalized, { ...partial, embed: true });
      assert.ok(synced.includes("embed=true"));

      const notEmbed = toSyncedSearchString(normalized, { ...partial, embed: false });
      assert.equal(notEmbed, toSearchString(normalized));
    }),
    { numRuns: 150 },
  );
}

function testShareStateUnicodeAndUrlUnsafeInputRoundtrip() {
  const weirdChars = [
    "a",
    "Z",
    "0",
    " ",
    "&",
    "=",
    "?",
    "#",
    "/",
    "%",
    "+",
    "<",
    ">",
    '"',
    "'",
    "🔥",
    "🚀",
    "中",
    "é",
  ] as const;

  const arbWeird = fc
    .array(fc.constantFrom(...weirdChars), { minLength: 1, maxLength: 24 })
    .map((xs) => xs.join(""));

  fc.assert(
    fc.property(arbWeird, arbWeird, arbWeird, arbWeird, arbWeird, (a, b, c, d, e) => {
      const search =
        `?chaser=${encodeURIComponent(a)}` +
        `&target=${encodeURIComponent(b)}` +
        `&indicator=${encodeURIComponent(c)}` +
        `&cg=${encodeURIComponent(d)}` +
        `&tg=${encodeURIComponent(e)}` +
        `&mode=${encodeURIComponent(a)}` +
        `&cr=${encodeURIComponent(b)}` +
        `&tr=${encodeURIComponent(c)}`;

      const parsed = parseShareStateFromSearch(search);
      assertShareStateInvariants(parsed);

      const canonical = parseShareStateFromSearch(toSearchString(parsed));
      const reparsed = parseShareStateFromSearch(toSearchString(canonical));
      assert.deepEqual(reparsed, canonical);
    }),
    { numRuns: 180 },
  );
}

function testConvergenceYearsMatchesProjectionMath() {
  const arb = fc.record({
    chaser: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    target: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    g: fc.double({ min: 1e-6, max: 0.25, noNaN: true, noInfinity: true }),
  });

  fc.assert(
    fc.property(arb, ({ chaser, target, g }) => {
      const years = calculateYearsToConvergence(chaser, target, g);
      if (chaser >= target) {
        assert.equal(years, 0);
        return;
      }
      assert.ok(Number.isFinite(years));
      assert.ok(years > 0);
      const projected = chaser * Math.pow(1 + g, years);
      assert.ok(projected >= target || approxEqual(projected, target, 1e-10, 1e-10));
    }),
    { numRuns: 200 },
  );
}

function testConvergenceYearsMonotonicInGrowthDifferential() {
  const arb = fc.record({
    chaser: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    ratio: fc.double({ min: 1.000001, max: 1000, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: -0.05, max: 0.08, noNaN: true, noInfinity: true }),
    diff1: fc.double({ min: 1e-6, max: 0.1, noNaN: true, noInfinity: true }),
    diff2: fc.double({ min: 1e-6, max: 0.1, noNaN: true, noInfinity: true }),
  });

  fc.assert(
    fc.property(arb, ({ chaser, ratio, targetGrowthRate, diff1, diff2 }) => {
      const target = chaser * ratio;
      const lowDiff = Math.min(diff1, diff2);
      const highDiff = Math.max(diff1, diff2);
      const chaserGrowthLow = targetGrowthRate + lowDiff;
      const chaserGrowthHigh = targetGrowthRate + highDiff;

      const relativeLow = (1 + chaserGrowthLow) / (1 + targetGrowthRate) - 1;
      const relativeHigh = (1 + chaserGrowthHigh) / (1 + targetGrowthRate) - 1;
      fc.pre(relativeLow > 0 && relativeHigh > 0);

      const yearsLow = calculateYearsToConvergence(chaser, target, relativeLow);
      const yearsHigh = calculateYearsToConvergence(chaser, target, relativeHigh);

      assert.ok(Number.isFinite(yearsLow));
      assert.ok(Number.isFinite(yearsHigh));
      assert.ok(yearsHigh <= yearsLow + 1e-12);
    }),
    { numRuns: 200 },
  );
}

function testRequiredGrowthRateHitsTargetPath() {
  const arb = fc.record({
    chaser: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    target: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    tg: fc.double({ min: -0.05, max: 0.15, noNaN: true, noInfinity: true }),
    years: fc.integer({ min: 1, max: 150 }),
  });

  fc.assert(
    fc.property(arb, ({ chaser, target, tg, years }) => {
      const r = calculateRequiredChaserGrowthRate({
        chaserValue: chaser,
        targetValue: target,
        targetGrowthRate: tg,
        years,
      });
      assert.ok(r != null);
      const chaserFuture = chaser * Math.pow(1 + (r as number), years);
      const targetFuture = target * Math.pow(1 + tg, years);
      assert.ok(approxEqual(chaserFuture, targetFuture, 1e-9, 1e-6));
    }),
    { numRuns: 200 },
  );
}

function testGenerateProjectionShape() {
  const arb = fc.record({
    chaser: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    target: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    g: fc.double({ min: -0.02, max: 0.2, noNaN: true, noInfinity: true }),
    startYear: fc.integer({ min: 1950, max: 2100 }),
    maxYears: fc.integer({ min: 1, max: 150 }),
  });

  fc.assert(
    fc.property(arb, ({ chaser, target, g, startYear, maxYears }) => {
      const proj = generateProjection(chaser, target, g, startYear, maxYears);
      assert.ok(proj.length >= 1);
      assert.ok(proj.length <= maxYears + 1);

      for (let i = 0; i < proj.length; i++) {
        const p = proj[i];
        assert.equal(p.year, startYear + i);
        assert.equal(p.target, Math.round(target));
        const expectedChaser = Math.round(chaser * Math.pow(1 + g, i));
        assert.equal(p.chaser, expectedChaser);
        if (i > 0) assert.equal(proj[i].year, proj[i - 1].year + 1);
      }

      const lastIdx = proj.length - 1;
      const lastUnroundedChaser = chaser * Math.pow(1 + g, lastIdx);
      if (lastIdx < maxYears) {
        assert.ok(lastUnroundedChaser >= target);
      } else {
        assert.ok(lastIdx === maxYears);
      }
    }),
    { numRuns: 150 },
  );
}

function testMilestonesMatchFirstReachYear() {
  const arb = fc.record({
    startYear: fc.integer({ min: 1950, max: 2100 }),
    years: fc.integer({ min: 1, max: 60 }),
    // Allow some weirdness in the data; calculateMilestones filters invalid points.
    projection: fc.array(
      fc.record({
        offset: fc.integer({ min: 0, max: 60 }),
        chaser: fc.double({ min: -1e6, max: 1e9, noNaN: true, noInfinity: true }),
        target: fc.double({ min: -1e6, max: 1e9, noNaN: true, noInfinity: true }),
      }),
      { minLength: 1, maxLength: 80 },
    ),
    ps: fc.array(fc.double({ min: 0.05, max: 0.95, noNaN: true, noInfinity: true }), {
      minLength: 1,
      maxLength: 6,
    }),
  });

  fc.assert(
    fc.property(arb, ({ startYear, projection, ps }) => {
      const points = projection.map((p) => ({
        year: startYear + p.offset,
        chaser: p.chaser,
        target: p.target,
      }));
      const out = calculateMilestones(points, ps);

      // Output is sorted by percentage and has no duplicates.
      for (let i = 1; i < out.length; i++) assert.ok(out[i].percentage >= out[i - 1].percentage);
      assert.equal(new Set(out.map((m) => m.percentage)).size, out.length);

      // For each p, milestone matches the first year where ratio>=p under the same validity filters.
      const sorted = points.toSorted((a, b) => a.year - b.year);
      const firstYearByP = new Map<number, { year: number; chaser: number; target: number }>();
      for (const p of [...new Set(ps)]) {
        for (const pt of sorted) {
          if (!Number.isFinite(pt.target) || pt.target <= 0) continue;
          if (!Number.isFinite(pt.chaser) || pt.chaser < 0) continue;
          if (pt.chaser / pt.target >= p) {
            firstYearByP.set(p, { year: pt.year, chaser: pt.chaser, target: pt.target });
            break;
          }
        }
      }

      for (const m of out) {
        const exp = firstYearByP.get(m.percentage);
        assert.ok(exp != null);
        assert.equal(m.year, exp!.year);
        assert.equal(m.chaserValue, exp!.chaser);
        assert.equal(m.targetValue, exp!.target);
      }

      for (const [p, exp] of firstYearByP.entries()) {
        assert.ok(out.some((m) => m.percentage === p && m.year === exp.year));
      }
    }),
    { numRuns: 120 },
  );
}

function testProjectValueYearZeroIdentity() {
  fc.assert(
    fc.property(
      fc.double({ min: -1e9, max: 1e9, noNaN: true, noInfinity: true }),
      fc.double({ min: -0.99, max: 2, noNaN: true, noInfinity: true }),
      (v, g) => {
        assert.ok(approxEqual(projectValue(v, g, 0), v, 0, 1e-12));
      },
    ),
    { numRuns: 250 },
  );
}

function testProjectValueZeroRateKeepsBaseForAllYears() {
  fc.assert(
    fc.property(
      fc.double({ min: -1e9, max: 1e9, noNaN: true, noInfinity: true }),
      fc.integer({ min: 0, max: 300 }),
      (value, years) => {
        assert.ok(approxEqual(projectValue(value, 0, years), value, 0, 1e-12));
      },
    ),
    { numRuns: 250 },
  );
}

function testCalculateCagrSyntheticSeries() {
  const arb = fc.record({
    startYear: fc.integer({ min: 1950, max: 2090 }),
    years: fc.integer({ min: 2, max: 40 }),
    base: fc.double({ min: 1e-6, max: 1e6, noNaN: true, noInfinity: true }),
    rate: fc.double({ min: -0.2, max: 0.3, noNaN: true, noInfinity: true }),
    lookback: fc.integer({ min: 1, max: 30 }),
  });

  fc.assert(
    fc.property(arb, ({ startYear, years, base, rate, lookback }) => {
      // Create a clean annual series.
      const series = Array.from({ length: years + 1 }, (_, i) => ({
        year: startYear + i,
        value: base * Math.pow(1 + rate, i),
      }));
      const cagr = calculateCagr({ series, lookbackYears: Math.min(lookback, years) });
      assert.ok(cagr != null);
      assert.ok(approxEqual(cagr as number, rate, 1e-9, 1e-9));
    }),
    { numRuns: 200 },
  );
}

function testComputeTotalsInvariants() {
  const arbPop = fc.oneof(
    fc.constant(null),
    fc.double({ min: -1e6, max: 1e9, noNaN: true, noInfinity: true }),
  );
  const arbMetric = fc.oneof(
    fc.constant(null),
    fc.double({ min: -1e6, max: 1e6, noNaN: true, noInfinity: true }),
  );

  fc.assert(
    fc.property(
      fc.constantFrom(...IMPLICATION_METRIC_CODES),
      arbMetric,
      arbMetric,
      arbPop,
      arbPop,
      fc.double({ min: 0, max: 1e6, noNaN: true, noInfinity: true }),
      fc.double({ min: 0, max: 1e6, noNaN: true, noInfinity: true }),
      (
        code: ImplicationMetricCode,
        currentMetric,
        impliedMetric,
        popCurrent,
        popFuture,
        gdpPcapCurrent,
        gdpPcapFuture,
      ) => {
        const out = computeTotals({
          code,
          currentMetric,
          impliedMetric,
          popCurrent,
          popFuture,
          gdpPcapCurrent,
          gdpPcapFuture,
        });

        const hasPopCurrent = popCurrent != null && Number.isFinite(popCurrent) && popCurrent > 0;
        const hasPopFuture = popFuture != null && Number.isFinite(popFuture) && popFuture > 0;
        const hasMetricCurrent = currentMetric != null && Number.isFinite(currentMetric);

        if (code === "URBAN_POP_PCT") {
          // This code path returns {null,null} unless both populations are valid.
          if (hasPopCurrent && hasPopFuture && hasMetricCurrent) {
            assert.equal(out.currentTotal?.unit, "persons");
            assert.ok(out.currentTotal!.value >= 0);
            assert.ok(out.currentTotal!.value <= popCurrent + 1e-6);
          }
        }

        if (code === "INDUSTRY_VA_PCT_GDP" || code === "CAPITAL_FORMATION_PCT_GDP") {
          // This code path returns {null,null} unless both GDP totals can be computed (=> both pops valid).
          if (hasPopCurrent && hasPopFuture && hasMetricCurrent) {
            assert.equal(out.currentTotal?.unit, "int$");
            const gdpTotal = gdpPcapCurrent * popCurrent;
            assert.ok(out.currentTotal!.value >= 0);
            assert.ok(out.currentTotal!.value <= gdpTotal + 1e-6);
          }
        }
      },
    ),
    { numRuns: 220 },
  );
}

function testComputeTotalsOutputNonNegativeWhenPresent() {
  const arbPop = fc.oneof(
    fc.constant(null),
    fc.double({ min: -1e6, max: 1e9, noNaN: true, noInfinity: true }),
  );
  const arbMetric = fc.oneof(
    fc.constant(null),
    fc.double({ min: -1e6, max: 1e6, noNaN: true, noInfinity: true }),
  );

  fc.assert(
    fc.property(
      fc.constantFrom(...IMPLICATION_METRIC_CODES),
      arbMetric,
      arbMetric,
      arbPop,
      arbPop,
      fc.double({ min: 0, max: 1e6, noNaN: true, noInfinity: true }),
      fc.double({ min: 0, max: 1e6, noNaN: true, noInfinity: true }),
      (
        code,
        currentMetric,
        impliedMetric,
        popCurrent,
        popFuture,
        gdpPcapCurrent,
        gdpPcapFuture,
      ) => {
        const out = computeTotals({
          code,
          currentMetric,
          impliedMetric,
          popCurrent,
          popFuture,
          gdpPcapCurrent,
          gdpPcapFuture,
        });

        if (out.currentTotal != null) {
          assert.ok(Number.isFinite(out.currentTotal.value));
          assert.ok(out.currentTotal.value >= 0);
        }
        if (out.impliedTotal != null) {
          assert.ok(Number.isFinite(out.impliedTotal.value));
          assert.ok(out.impliedTotal.value >= 0);
        }
      },
    ),
    { numRuns: 250 },
  );
}

function testBuildTemplateMappingPointsSortedUnique() {
  const arb = fc.record({
    transform: fc.constantFrom("loglog", "logx" as const),
    iso: fc.array(arbIso3, { minLength: 1, maxLength: 3 }),
    years: fc
      .array(fc.integer({ min: 1990, max: 2025 }), { minLength: 2, maxLength: 8 })
      .map((ys) => [...new Set(ys)].toSorted((a, b) => a - b)),
    gdp0: fc.double({ min: 100, max: 1_000_000, noNaN: true, noInfinity: true }),
    gdpGrowth: fc.double({ min: 1.001, max: 1.25, noNaN: true, noInfinity: true }),
    metric0: fc.double({ min: -1000, max: 1000, noNaN: true, noInfinity: true }),
    metricStep: fc.double({ min: -50, max: 50, noNaN: true, noInfinity: true }),
  });

  fc.assert(
    fc.property(arb, ({ transform, iso, years, gdp0, gdpGrowth, metric0, metricStep }) => {
      const gdpByIso: Record<string, Array<{ year: number; value: number }>> = {};
      const metricByIso: Record<string, Array<{ year: number; value: number }>> = {};

      for (const code of iso) {
        const gdpSeries = years.map((y, i) => ({ year: y, value: gdp0 * Math.pow(gdpGrowth, i) }));
        const metricSeries = years.map((y, i) => ({
          year: y,
          value:
            transform === "loglog"
              ? Math.max(1e-6, metric0 + metricStep * i)
              : metric0 + metricStep * i,
        }));
        gdpByIso[code] = gdpSeries;
        metricByIso[code] = metricSeries;
      }

      const mapping = buildTemplateMapping({
        gdpByIso,
        metricByIso,
        iso3: iso,
        metricTransform: transform,
      });

      const gdps = mapping.points.map((p) => p.gdp);
      for (let i = 1; i < gdps.length; i++) assert.ok(gdps[i] >= gdps[i - 1]);
      assert.equal(new Set(gdps).size, gdps.length);

      if (mapping.points.length >= 2 && mapping.gdpMin != null && mapping.gdpMax != null) {
        assert.equal(mapping.predict(mapping.gdpMin), mapping.points[0].y);
        assert.equal(mapping.predict(mapping.gdpMax), mapping.points[mapping.points.length - 1].y);
        assert.equal(mapping.predict(mapping.gdpMin / 10), mapping.points[0].y);
        assert.equal(
          mapping.predict(mapping.gdpMax * 10),
          mapping.points[mapping.points.length - 1].y,
        );
      } else {
        assert.equal(mapping.predict(10_000), null);
      }
    }),
    { numRuns: 80 },
  );
}

function testEstimateFromTemplateClampAndApply() {
  fc.assert(
    fc.property(
      fc.double({ min: 1e-6, max: 1e6, noNaN: true, noInfinity: true }),
      fc.double({ min: 1e-6, max: 1e6, noNaN: true, noInfinity: true }),
      fc.double({ min: 1e-6, max: 1e6, noNaN: true, noInfinity: true }),
      fc.constantFrom("multiply", "add" as const),
      (atCur, atFut, chCur, apply) => {
        const unclamped = estimateFromTemplate({
          templateAtCurrentGdp: atCur,
          templateAtFutureGdp: atFut,
          chaserCurrentMetric: chCur,
          apply,
        });
        assert.ok(unclamped != null);

        const clamped = estimateFromTemplate({
          templateAtCurrentGdp: atCur,
          templateAtFutureGdp: atFut,
          chaserCurrentMetric: chCur,
          apply,
          clampRange: { min: 0, max: 100 },
        });
        assert.ok(clamped != null);
        assert.ok((clamped as number) >= 0 && (clamped as number) <= 100);

        if (apply === "add") {
          assert.ok(approxEqual(unclamped as number, chCur + (atFut - atCur), 1e-10, 1e-10));
        }
      },
    ),
    { numRuns: 200 },
  );
}

function testBuildPermalinkNormalizesToolUrlAndKeepsHash() {
  const arb = fc.record({
    base: fc.constantFrom(
      "https://example.com",
      "https://example.com/app",
      "https://example.com/app/",
    ),
    query: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
    hash: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
    state: arbShareStateLoose,
  });

  fc.assert(
    fc.property(arb, ({ base, query, hash, state }) => {
      const toolQuery = query ? `toolQuery=${encodeURIComponent(query)}` : "";
      const toolUrl = `${base}${toolQuery ? `?${toolQuery}` : ""}${hash ? `#${encodeURIComponent(hash)}` : ""}`;
      const normalized = normalizeStateLoose(state);
      const permalink = buildPermalink(toolUrl, normalized);

      const u = new URL(permalink);
      assert.ok(u.searchParams.get("v") === "1");
      if (hash) assert.equal(u.hash, `#${encodeURIComponent(hash)}`);
      // Original toolUrl query should not be preserved; only state params (+v).
      if (toolQuery) assert.ok(!u.search.includes("toolQuery="));
      assert.ok(permalink.startsWith(`${base}?`));
    }),
    { numRuns: 120 },
  );
}

function testToolCitationBibtexEscapesTitle() {
  const arbStr = fc
    .array(fc.constantFrom(...("&%$#_{} abcXYZ123" as const).split("")), {
      minLength: 1,
      maxLength: 40,
    })
    .map((xs) => xs.join(""));
  const arb = fc.record({
    toolName: arbStr,
    chaserName: arbStr,
    targetName: arbStr,
    indicatorName: arbStr,
    state: arbShareStateLoose,
  });

  fc.assert(
    fc.property(arb, ({ toolName, chaserName, targetName, indicatorName, state }) => {
      const normalized = normalizeStateLoose(state);
      const ctx: CitationContext = {
        toolName,
        toolUrl: "https://example.com/app?ignored=1#frag",
        accessDate: new Date("2024-01-15T00:00:00.000Z"),
        chaserName,
        chaserIso: normalized.chaser,
        targetName,
        targetIso: normalized.target,
        indicatorName,
        indicatorCode: normalized.indicator,
        dataSource: null,
        dataSourceCode: null,
        state: normalized,
      };

      const bib = generateToolCitation(ctx, "bibtex");
      const titleLine = bib.split("\n").find((l) => l.trimStart().startsWith("title = {"));
      assert.ok(titleLine != null);

      const titleField = titleLine!.slice(titleLine!.indexOf("{") + 1, titleLine!.lastIndexOf("}"));
      // Characters we escape for BibTeX must only appear with a leading backslash.
      for (const ch of ["&", "%", "$", "#", "_", "{", "}"]) {
        const re = new RegExp(`(^|[^\\\\])\\${ch}`, "g");
        assert.ok(!re.test(titleField), `unescaped ${ch} in title`);
      }
    }),
    { numRuns: 140 },
  );
}

const OECD_REGION_CODES = ALL_TL2_REGIONS.map((r) => r.code);
const OECD_COUNTRY_CODES = Array.from(new Set(ALL_TL2_REGIONS.map((r) => r.countryCode)));
const OECD_STATIC_DATA_CODES = Object.keys(STATIC_REGION_DATA);
const OECD_STATIC_DATA_CODES_SET = new Set(OECD_STATIC_DATA_CODES);

function testConvergenceFormatters() {
  fc.assert(
    fc.property(fc.double({ min: -10, max: 10, noNaN: true, noInfinity: true }), (rate) => {
      const s = formatPercent(rate);
      assert.ok(s.endsWith("%"));
      const n = Number.parseFloat(s.slice(0, -1));
      assert.ok(Number.isFinite(n));
      const expected = Number((rate * 100).toFixed(1));
      assert.ok(approxEqual(n, expected, 0, 1e-12));
      // Always 1 decimal place.
      assert.ok(/^-?\d+\.\d%$/.test(s));
    }),
    { numRuns: 200 },
  );

  assert.equal(formatYears(Infinity), "Never");
  assert.equal(formatYears(Number.POSITIVE_INFINITY), "Never");
  assert.equal(formatYears(Number.NEGATIVE_INFINITY), "Never");
  assert.equal(formatYears(0.2), "< 1 year");
  assert.equal(formatYears(1), "1 year");
  assert.equal(formatYears(1.4), "1 years");
  assert.equal(formatYears(2.6), "3 years");

  fc.assert(
    fc.property(fc.integer({ min: 1, max: 999 }), (n) => {
      const s = formatNumber(n);
      assert.ok(!s.endsWith("K") && !s.endsWith("M") && !s.endsWith("B"));
    }),
    { numRuns: 200 },
  );
  fc.assert(
    fc.property(fc.integer({ min: 1_000, max: 999_999 }), (n) => {
      const s = formatNumber(n);
      assert.ok(s.endsWith("K"));
    }),
    { numRuns: 200 },
  );
  fc.assert(
    fc.property(fc.integer({ min: 1_000_000, max: 999_999_999 }), (n) => {
      const s = formatNumber(n);
      assert.ok(s.endsWith("M"));
    }),
    { numRuns: 150 },
  );
  fc.assert(
    fc.property(fc.integer({ min: 1_000_000_000, max: 100_000_000_000 }), (n) => {
      const s = formatNumber(n);
      assert.ok(s.endsWith("B"));
    }),
    { numRuns: 120 },
  );

  assert.equal(formatMetricValue(Number.NaN, "usd"), "—");
  assert.equal(formatMetricValue(Infinity, "usd"), "—");
  assert.equal(formatMetricValue(12.34, "percent"), "12.3%");
  assert.equal(formatMetricValue(1.0, "index"), "1");
  assert.equal(formatMetricValue(1.23, "index"), "1.23");
  assert.equal(formatMetricValue(1.23456, "index"), "1.235");
  assert.ok(formatMetricValue(1000, "usd").startsWith("$"));
  assert.ok(/\d/.test(formatMetricValue(1000, "persons")));
}

function testDataSourceUrlsProperties() {
  // Unknown sources always return null.
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.option(fc.string({ maxLength: 20 }), { nil: null }),
      (source, code) => {
        fc.pre(
          source !== "World Bank" &&
            source !== "UNDP" &&
            source !== "Our World in Data" &&
            source !== "OECD",
        );
        assert.equal(getDataSourceUrl(source, code), null);
        assert.equal(getDataSourceBaseUrl(source), null);
        assert.equal(getDataSourceLicense(source), null);
      },
    ),
    { numRuns: 150 },
  );

  fc.assert(
    fc.property(fc.constantFrom(...Object.keys(WORLD_BANK_INDICATOR_CODES)), (indicator) => {
      const url = getWorldBankUrl(indicator);
      assert.ok(url != null);
      assert.ok(url!.includes("https://data.worldbank.org/indicator/"));
    }),
    { numRuns: 60 },
  );

  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 20 }), (indicator) => {
      fc.pre(!(indicator in WORLD_BANK_INDICATOR_CODES));
      assert.equal(getWorldBankUrl(indicator), null);
    }),
    { numRuns: 150 },
  );
}

function testDataExportCsvAndJsonInvariants() {
  const arbCell = fc
    .array(fc.constantFrom(...('ab,"' as const).split("")), { minLength: 1, maxLength: 20 })
    .map((xs) => xs.join(""));

  const arb = fc.record({
    state: arbShareStateLoose,
    chaser: arbIso3,
    target: arbIso3,
    indicatorCode: arbIndicatorCode,
    chaserName: arbCell,
    targetName: arbCell,
    indicatorName: arbCell,
    unit: arbCell,
    source: fc.constantFrom("World Bank", "UNDP", "Our World in Data"),
    n: fc.integer({ min: 0, max: 12 }),
    m: fc.integer({ min: 0, max: 12 }),
    p: fc.integer({ min: 1, max: 20 }),
  });

  fc.assert(
    fc.property(
      arb,
      ({
        state,
        chaser,
        target,
        indicatorCode,
        chaserName,
        targetName,
        indicatorName,
        unit,
        source,
        n,
        m,
        p,
      }) => {
        const normalizedBase = normalizeStateLoose(state);
        const normalized: ShareState = {
          ...normalizedBase,
          chaser,
          target,
          indicator: indicatorCode,
        };

        const countriesByIso3 = {
          [chaser]: { name: chaserName },
          [target]: { name: targetName },
        };

        const data = {
          [chaser]: Array.from({ length: n }, (_, i) => ({ year: 2000 + i, value: i + 0.1 })),
          [target]: Array.from({ length: m }, (_, i) => ({ year: 1990 + i, value: i + 1.2 })),
        };

        const indicator: Indicator = {
          code: indicatorCode,
          name: indicatorName,
          description: null,
          unit,
          source,
          category: "economic",
        };

        const observedCsv = toObservedCsv({
          state: normalized,
          indicator,
          countriesByIso3,
          data,
        });
        assert.ok(observedCsv.startsWith("# Convergence Explorer Data Export"));
        assert.ok(!observedCsv.includes("undefined"));
        assert.ok(!observedCsv.includes("NaN"));

        const lines = observedCsv.split("\n");
        // Header is 8 lines, then column header, then rows.
        for (let i = 0; i < 8; i++) assert.ok(lines[i].startsWith("#"));
        assert.ok(!lines[8].startsWith("#"));

        const expectedRows = (data[chaser]?.length ?? 0) + (data[target]?.length ?? 0);
        // If chaser==target, module iterates twice over same iso3 and repeats rows twice.
        const expectedDataRows = chaser === target ? (data[chaser]?.length ?? 0) * 2 : expectedRows;
        assert.equal(lines.length, 8 + 1 + expectedDataRows);

        const projection = Array.from({ length: p }, (_, i) => ({
          year: normalized.baseYear + i,
          chaser: 10 + i,
          target: 20 + i,
        }));
        const projectionCsv = toProjectionCsv({
          state: normalized,
          indicator,
          projection,
        });
        assert.ok(projectionCsv.startsWith("# Convergence Explorer Data Export"));
        assert.ok(!projectionCsv.includes("undefined"));

        const projectionLines = projectionCsv.split("\n");
        assert.equal(projectionLines.length, 8 + 1 + projection.length);

        const report = toReportJson({
          state: normalized,
          indicator,
          countriesByIso3,
          observed: data,
          projection,
          derived: { yearsToConvergence: 10, convergenceYear: normalized.baseYear + 10, gap: 1 },
        });
        const parsed = JSON.parse(report);
        assert.equal(parsed.meta.tool, "Convergence Explorer");
        assert.ok(String(parsed.meta.permalink).includes("v=1"));
        assert.ok(parsed.citation.tool.bibtex.length > 0);
      },
    ),
    { numRuns: 120 },
  );
}

function escapeXmlForTest(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function testShareCardSvgInvariants() {
  const arbName = fc
    .array(fc.constantFrom(...("ab&<>\"'" as const).split("")), { minLength: 1, maxLength: 10 })
    .map((xs) => xs.join(""));

  const arbParams = fc.record({
    chaserName: arbName,
    targetName: arbName,
    chaserCode: fc.constantFrom("AAA", "BBB", "CCC"),
    targetCode: fc.constantFrom("DDD", "EEE", "FFF"),
    metricLabel: arbName,
    metricUnit: fc.option(arbName, { nil: null }),
    theme: fc.constantFrom("light", "dark" as const),
    targetMode: fc.constantFrom("growing", "static" as const),
    baseYear: fc.integer({ min: 1950, max: 2100 }),
    yearsToConvergence: fc.option(fc.double({ min: 0, max: 150, noNaN: true, noInfinity: true }), {
      nil: null,
    }),
    currentGap: fc.double({ min: 0, max: 50, noNaN: true, noInfinity: true }),
    chaserGrowth: fc.double({ min: -0.05, max: 0.12, noNaN: true, noInfinity: true }),
    targetGrowth: fc.double({ min: -0.05, max: 0.08, noNaN: true, noInfinity: true }),
  });

  fc.assert(
    fc.property(arbParams, (p) => {
      const projection = Array.from({ length: 10 }, (_, i) => ({
        year: p.baseYear + i,
        chaser: 10 + i,
        target: 20 + i,
      }));

      const params: ShareCardParams = {
        chaserName: p.chaserName,
        targetName: p.targetName,
        chaserCode: p.chaserCode,
        targetCode: p.targetCode,
        metricLabel: p.metricLabel,
        metricUnit: p.metricUnit,
        projection,
        convergenceYear: p.baseYear + 5,
        yearsToConvergence: p.yearsToConvergence,
        currentGap: p.currentGap,
        chaserGrowth: p.chaserGrowth,
        targetGrowth: p.targetGrowth,
        targetMode: p.targetMode,
        theme: p.theme,
      };

      const svg = generateShareCardSvg(params);
      assert.ok(svg.startsWith("<svg"));
      assert.ok(svg.includes('viewBox="0 0 '));
      assert.ok(!svg.includes("undefined"));
      assert.ok(!svg.includes("NaN"));
      assert.ok(!svg.includes("Infinity"));

      const escapedChaser = escapeXmlForTest(p.chaserName);
      const escapedTarget = escapeXmlForTest(p.targetName);
      assert.ok(svg.includes(escapedChaser));
      assert.ok(svg.includes(escapedTarget));

      const filename = getShareCardFilename(params, "twitter");
      assert.ok(filename.endsWith(".png"));
      assert.ok(
        filename.includes(`convergence-${p.chaserCode}-${p.targetCode}-twitter-${p.theme}-`),
      );
      assert.ok(/\d{4}-\d{2}-\d{2}\.png$/.test(filename));
    }),
    { numRuns: 60 },
  );
}

function testCardSvgGeneratorsNoInvalidNumbers() {
  const arbName = fc
    .array(fc.constantFrom(...("ab&<>\"'" as const).split("")), { minLength: 1, maxLength: 12 })
    .map((xs) => xs.join(""));

  const arb = fc.record({
    chaserName: arbName,
    targetName: arbName,
    theme: fc.constantFrom("light", "dark" as const),
    baseYear: fc.integer({ min: 1950, max: 2100 }),
    chaserValue: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    targetValue: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    chaserGrowthRate: fc.double({ min: 0.0, max: 0.2, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: 0.0, max: 0.2, noNaN: true, noInfinity: true }),
    horizonYear: fc.integer({ min: 2000, max: 2300 }),
  });

  fc.assert(
    fc.property(arb, (p) => {
      const sens = calculateSensitivityScenarios({
        chaserValue: p.chaserValue,
        targetValue: p.targetValue,
        chaserGrowthRate: p.chaserGrowthRate,
        targetGrowthRate: p.targetGrowthRate,
        baseYear: p.baseYear,
      });
      const sensSvg = generateSensitivityCardSvg({
        chaserName: p.chaserName,
        targetName: p.targetName,
        chaserValue: p.chaserValue,
        targetValue: p.targetValue,
        sensitivity: sens,
        baseYear: p.baseYear,
        theme: p.theme,
      });
      assert.ok(sensSvg.startsWith("<svg"));
      assert.ok(!sensSvg.includes("undefined"));
      assert.ok(!sensSvg.includes("NaN"));
      assert.ok(!sensSvg.includes("Infinity"));

      const histSvg = generateHistoricalCardSvg({
        chaserName: p.chaserName,
        targetName: p.targetName,
        historicalData: {
          chaserStart: { year: 2000, value: p.chaserValue },
          chaserCurrent: { year: 2020, value: p.chaserValue * 1.2 },
          targetStart: { year: 2000, value: p.targetValue },
          targetCurrent: { year: 2020, value: p.targetValue * 1.3 },
        },
        theme: p.theme,
      });
      assert.ok(histSvg.startsWith("<svg"));
      assert.ok(!histSvg.includes("undefined"));
      assert.ok(!histSvg.includes("NaN"));
      assert.ok(!histSvg.includes("Infinity"));

      const implSvg = generateImplicationsCardSvg({
        chaserName: p.chaserName,
        implicationsData: {
          electricityDeltaTWh: 100,
          nuclearPlants: 5,
          urbanDeltaPersons: 1_000_000,
          homesNeeded: 200_000,
          co2DeltaMt: -10,
          gdpCurrent: 1e9,
          gdpFuture: 2e9,
        },
        horizonYear: p.horizonYear,
        theme: p.theme,
      });
      assert.ok(implSvg.startsWith("<svg"));
      assert.ok(!implSvg.includes("undefined"));
      assert.ok(!implSvg.includes("NaN"));
      assert.ok(!implSvg.includes("Infinity"));
    }),
    { numRuns: 40 },
  );
}

function testThreadCaptionsShape() {
  const arbName = fc
    .array(fc.constantFrom(...("abcdefghijklmnopqrstuvwxyz" as const).split("")), {
      minLength: 1,
      maxLength: 12,
    })
    .map((xs) => xs.join(""));

  const arb = fc.record({
    chaserName: arbName,
    targetName: arbName,
    appUrl: fc.constant("https://example.com/share"),
    yearsToConvergence: fc.option(fc.double({ min: 0, max: 150, noNaN: true, noInfinity: true }), {
      nil: null,
    }),
    convergenceYear: fc.option(fc.integer({ min: 1950, max: 2300 }), { nil: null }),
    chaserGrowthRate: fc.double({ min: -0.05, max: 0.12, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: -0.05, max: 0.08, noNaN: true, noInfinity: true }),
  });

  fc.assert(
    fc.property(arb, (p) => {
      type CaptionsCtx = Parameters<typeof generateCaptions>[0];
      const years = p.yearsToConvergence;
      const ctx: CaptionsCtx = {
        chaserName: p.chaserName,
        targetName: p.targetName,
        yearsToConvergence: years,
        convergenceYear: p.convergenceYear,
        chaserGrowthRate: p.chaserGrowthRate,
        targetGrowthRate: p.targetGrowthRate,
        optimisticYears: years == null ? null : Math.max(0, years - 3),
        pessimisticYears: years == null ? null : years + 3,
        historicalData: null,
        implicationsData: null,
        appUrl: p.appUrl,
      };
      const caps = generateCaptions(ctx);

      assert.equal(caps.length, 4);
      assert.ok(caps[0].startsWith("1/4 "));
      assert.ok(caps[1].startsWith("2/4 "));
      assert.ok(caps[2].startsWith("3/4 "));
      assert.ok(caps[3].startsWith("4/4 "));
      for (const c of caps) {
        assert.ok(!c.includes("undefined"));
        assert.ok(!c.includes("NaN"));
        assert.ok(!c.includes("Infinity"));
      }
    }),
    { numRuns: 120 },
  );
}

function isRegionCodeLike(s: string) {
  // Mirrors parseRegionCode() shape: /^[A-Z]{2,3}(-[A-Z]{2})?[0-9]?$/
  return /^[A-Z]{2,3}(-[A-Z]{2})?[0-9]?$/.test(s);
}

function testShareStateRegionsModeParsing() {
  const arbValid = fc
    .oneof(
      fc.constantFrom(...OECD_REGION_CODES),
      fc
        .record({
          a: fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
          b: fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
          c: fc.option(fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")), {
            nil: "",
          }),
          dash: fc.boolean(),
          d: fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
          e: fc.constantFrom(...("ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const).split("")),
          digit: fc.option(fc.constantFrom(...("0123456789" as const).split("")), { nil: "" }),
        })
        .map(({ a, b, c, dash, d, e, digit }) => `${a}${b}${c}${dash ? `-${d}${e}` : ""}${digit}`),
    )
    .map((s) => s.trim().toUpperCase())
    .filter((s) => isRegionCodeLike(s));

  const arbInvalid = fc
    .string({ minLength: 1, maxLength: 12 })
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !isRegionCodeLike(s.toUpperCase()));

  fc.assert(
    fc.property(arbValid, arbValid, (cr, tr) => {
      const parsed = parseShareStateFromSearch(
        `?mode=regions&cr=${encodeURIComponent(cr)}&tr=${encodeURIComponent(tr)}`,
      );
      assert.equal(parsed.mode, "regions");
      assert.equal(parsed.cr, cr);
      assert.equal(parsed.tr, tr);

      const s = toSearchString(parsed);
      assert.ok(s.includes("mode=regions"));
      assert.ok(s.includes(`cr=${encodeURIComponent(cr)}`));
      assert.ok(s.includes(`tr=${encodeURIComponent(tr)}`));
    }),
    { numRuns: 120 },
  );

  fc.assert(
    fc.property(arbInvalid, arbInvalid, (crBad, trBad) => {
      const parsed = parseShareStateFromSearch(
        `?mode=regions&cr=${encodeURIComponent(crBad)}&tr=${encodeURIComponent(trBad)}`,
      );
      assert.equal(parsed.mode, "regions");
      assert.equal(parsed.cr, DEFAULT_SHARE_STATE.cr);
      assert.equal(parsed.tr, DEFAULT_SHARE_STATE.tr);
    }),
    { numRuns: 120 },
  );

  fc.assert(
    fc.property(arbValid, arbValid, (cr, tr) => {
      const parsed = parseShareStateFromSearch(
        `?cr=${encodeURIComponent(cr)}&tr=${encodeURIComponent(tr)}`,
      );
      assert.equal(parsed.mode, "countries");
      // Even if cr/tr appear in the URL, they should not be persisted into the countries-mode URL.
      const s = toSearchString(parsed);
      assert.ok(!s.includes("cr="));
      assert.ok(!s.includes("tr="));
    }),
    { numRuns: 80 },
  );
}

function testCsvHeaderSanitizePreventsNewlines() {
  const chaserName = "A\nB";
  const targetName = "C\r\nD";
  const indicatorName = "I\nJ";

  const state: ShareState = {
    ...DEFAULT_SHARE_STATE,
    chaser: "AAA",
    target: "BBB",
    indicator: "AA",
  };

  const observedCsv = toObservedCsv({
    state,
    indicator: {
      code: "AA",
      name: indicatorName,
      description: null,
      unit: "u",
      source: "World Bank",
      category: "economic",
    } satisfies Indicator,
    countriesByIso3: {
      AAA: { name: chaserName },
      BBB: { name: targetName },
    },
    data: { AAA: [], BBB: [] },
  });
  // If header values leaked newlines, we'd have more than 9 total lines (8 header + column header).
  assert.equal(observedCsv.split("\n").length, 9);

  const chaserRegion: OECDRegion = {
    code: "UKC",
    name: chaserName,
    countryCode: "GBR",
    countryName: "X\nY",
    level: "TL2" as const,
  };
  const targetRegion: OECDRegion = {
    code: "UKI",
    name: targetName,
    countryCode: "GBR",
    countryName: "Z\r\nW",
    level: "TL2" as const,
  };
  const regionalCsv = toRegionalObservedCsv({
    state: { ...state, mode: "regions", cr: "UKC", tr: "UKI" },
    observed: { UKC: [], UKI: [] },
    chaserRegion,
    targetRegion,
  });
  // 9 header + column header, no data rows.
  assert.equal(regionalCsv.split("\n").length, 10);
}

function testOecdRegionDataIntegrity() {
  const codes = ALL_TL2_REGIONS.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);

  for (const c of COUNTRIES_WITH_REGIONS) {
    const regions = getRegionsByCountry(c.code);
    assert.equal(regions.length, c.regionCount);
    for (const r of regions) assert.equal(r.countryCode, c.code);
  }

  for (const [code, series] of Object.entries(STATIC_REGION_DATA)) {
    const years = series.map((p) => p.year);
    assert.equal(new Set(years).size, years.length);
    // latest() should match max year for codes with data
    const latest = getLatestRegionData(code);
    assert.ok(latest != null);
    assert.equal(latest!.year, Math.max(...years));
  }
}

function testSvgGeneratorsHandleZeroValues() {
  const shareSvg = generateShareCardSvg({
    chaserName: "A",
    targetName: "B",
    chaserCode: "AAA",
    targetCode: "BBB",
    metricLabel: "M",
    projection: Array.from({ length: 3 }, (_, i) => ({ year: 2020 + i, chaser: 0, target: 0 })),
    convergenceYear: null,
    yearsToConvergence: null,
    currentGap: 2,
    chaserGrowth: 0.01,
    targetGrowth: 0.01,
    targetMode: "growing",
    theme: "light",
  });
  assert.ok(!shareSvg.includes("NaN"));
  assert.ok(!shareSvg.includes("Infinity"));

  const sens = calculateSensitivityScenarios({
    chaserValue: 0,
    targetValue: 0,
    chaserGrowthRate: 0.05,
    targetGrowthRate: 0.02,
    baseYear: 2020,
  });
  const sensSvg = generateSensitivityCardSvg({
    chaserName: "A",
    targetName: "B",
    chaserValue: 0,
    targetValue: 0,
    sensitivity: sens,
    baseYear: 2020,
    theme: "dark",
  });
  assert.ok(!sensSvg.includes("NaN"));
  assert.ok(!sensSvg.includes("Infinity"));
}

function testCountryAdjustmentsLookupAndApply() {
  const knownPairs = COUNTRY_ADJUSTMENTS.flatMap((adj) =>
    adj.indicators.map((indicator) => ({
      iso: adj.iso,
      indicator,
      factor: adj.adjustmentFactor,
    })),
  );

  fc.assert(
    fc.property(
      fc.constantFrom(...knownPairs),
      fc.double({ min: -1e9, max: 1e9, noNaN: true, noInfinity: true }),
      fc.boolean(),
      ({ iso, indicator, factor }, value, useAdjusted) => {
        const adj = getAdjustment(iso, indicator);
        assert.ok(adj != null);
        assert.equal(adj!.iso, iso);
        assert.ok(adj!.indicators.includes(indicator));

        const out = applyAdjustment(value, adj, useAdjusted);
        if (!useAdjusted) {
          assert.ok(Object.is(out, value));
        } else {
          assert.ok(approxEqual(out, value * factor, 0, 1e-12));
        }
      },
    ),
    { numRuns: 120 },
  );
}

function testBenchmarkGrowthRateIsMonotonic() {
  const rank = (label: string) => {
    switch (label) {
      case "—":
        return -1;
      case "No growth required":
        return 0;
      case "Slow":
        return 1;
      case "Moderate":
        return 2;
      case "Strong":
        return 3;
      case "Ambitious":
        return 4;
      case "Unprecedented":
        return 5;
      default:
        return 999;
    }
  };

  fc.assert(
    fc.property(
      fc.double({ min: -1, max: 0.2, noNaN: true, noInfinity: true }),
      fc.double({ min: -1, max: 0.2, noNaN: true, noInfinity: true }),
      (a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const rLo = benchmarkGrowthRate(lo);
        const rHi = benchmarkGrowthRate(hi);
        assert.ok(rank(rLo.label) <= rank(rHi.label));
      },
    ),
    { numRuns: 250 },
  );

  assert.deepEqual(benchmarkGrowthRate(Number.NaN), { label: "—", tone: "good" });
  assert.deepEqual(benchmarkGrowthRate(Number.POSITIVE_INFINITY), { label: "—", tone: "good" });
  assert.deepEqual(benchmarkGrowthRate(Number.NEGATIVE_INFINITY), { label: "—", tone: "good" });

  assert.equal(benchmarkGrowthRate(-0.0001).label, "No growth required");
  assert.equal(benchmarkGrowthRate(0).label, "No growth required");
  assert.equal(benchmarkGrowthRate(GROWTH_BENCHMARKS.moderate - 1e-12).label, "Slow");
  assert.equal(benchmarkGrowthRate(GROWTH_BENCHMARKS.moderate).label, "Moderate");
  assert.equal(benchmarkGrowthRate(GROWTH_BENCHMARKS.strong).label, "Strong");
  assert.equal(benchmarkGrowthRate(GROWTH_BENCHMARKS.exceptional).label, "Ambitious");
  assert.equal(benchmarkGrowthRate(GROWTH_BENCHMARKS.unprecedented + 1e-12).label, "Unprecedented");
}

function testScenarioAdjustmentsBehaveAsSpecified() {
  const scenarioIds = IMPLICATION_SCENARIOS.map((s) => s.id);
  const arbScenario = fc.constantFrom(...scenarioIds);
  const arbMetric = fc.constantFrom(...IMPLICATION_METRIC_CODES);

  fc.assert(
    fc.property(
      arbScenario,
      arbMetric,
      fc.double({ min: -1e6, max: 1e6, noNaN: true, noInfinity: true }),
      (scenarioId: ScenarioId, metricCode: ImplicationMetricCode, implied) => {
        const out = applyScenarioToImpliedMetric({
          scenarioId,
          metricCode,
          implied,
        });
        assert.ok(out != null);
        assert.ok(Number.isFinite(out as number));

        if (scenarioId === "baseline") {
          assert.ok(Object.is(out, implied));
        }

        if (scenarioId === "efficient" && metricCode === "ELECTRICITY_USE_PCAP") {
          assert.ok(approxEqual(out as number, implied * 0.85, 0, 1e-12));
        }
        if (scenarioId === "efficient" && metricCode === "ENERGY_USE_PCAP") {
          assert.ok(approxEqual(out as number, implied * 0.9, 0, 1e-12));
        }
        if (scenarioId === "efficient" && metricCode === "CO2_PCAP") {
          assert.ok(approxEqual(out as number, implied * 0.85, 0, 1e-12));
        }

        if (scenarioId === "highIndustry" && metricCode === "INDUSTRY_VA_PCT_GDP") {
          assert.ok((out as number) >= 0 && (out as number) <= 100);
        }
      },
    ),
    { numRuns: 250 },
  );

  // Clamp behavior for industry share add: +5 but bounded [0,100].
  fc.assert(
    fc.property(fc.double({ min: -1000, max: 1000, noNaN: true, noInfinity: true }), (implied) => {
      const out = applyScenarioToImpliedMetric({
        scenarioId: "highIndustry",
        metricCode: "INDUSTRY_VA_PCT_GDP",
        implied,
      });
      assert.ok(out != null);
      assert.ok((out as number) >= 0 && (out as number) <= 100);

      const expected = clamp(implied + 5, 0, 100);
      assert.ok(approxEqual(out as number, expected, 0, 1e-12));
    }),
    { numRuns: 200 },
  );
}

function testSensitivityScenarioOrderingAndYears() {
  const arb = fc.record({
    chaserValue: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    ratio: fc.double({ min: 1.000001, max: 1000, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: 0, max: 0.12, noNaN: true, noInfinity: true }),
    extra: fc.double({ min: 0.03, max: 0.25, noNaN: true, noInfinity: true }),
    baseYear: fc.integer({ min: 1950, max: 2100 }),
  });

  fc.assert(
    fc.property(arb, ({ chaserValue, ratio, targetGrowthRate, extra, baseYear }) => {
      const delta = 0.01;
      const targetValue = chaserValue * ratio;
      const chaserGrowthRate = targetGrowthRate + delta + extra;

      const res = calculateSensitivityScenarios({
        chaserValue,
        targetValue,
        chaserGrowthRate,
        targetGrowthRate,
        baseYear,
        delta,
      });

      assert.ok(res.baseline.yearsToConvergence != null);
      assert.ok(res.optimistic.yearsToConvergence != null);
      assert.ok(res.pessimistic.yearsToConvergence != null);

      const b = res.baseline.yearsToConvergence as number;
      const o = res.optimistic.yearsToConvergence as number;
      const p = res.pessimistic.yearsToConvergence as number;

      assert.ok(o <= b + 1e-10);
      assert.ok(b <= p + 1e-10);

      assert.equal(res.baseline.convergenceYear, Math.round(baseYear + b));
      assert.equal(res.optimistic.convergenceYear, Math.round(baseYear + o));
      assert.equal(res.pessimistic.convergenceYear, Math.round(baseYear + p));
    }),
    { numRuns: 200 },
  );
}

function testSensitivityRatePerturbationsSymmetricAroundBaseline() {
  const arb = fc.record({
    chaserValue: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    ratio: fc.double({ min: 1.000001, max: 1e6, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: 0, max: 0.1, noNaN: true, noInfinity: true }),
    delta: fc.double({ min: 1e-5, max: 0.02, noNaN: true, noInfinity: true }),
    extra: fc.double({ min: 0.02, max: 0.2, noNaN: true, noInfinity: true }),
    baseYear: fc.integer({ min: 1950, max: 2100 }),
  });

  fc.assert(
    fc.property(arb, ({ chaserValue, ratio, targetGrowthRate, delta, extra, baseYear }) => {
      const targetValue = chaserValue * ratio;
      const chaserGrowthRate = targetGrowthRate + delta + extra;
      fc.pre(chaserGrowthRate >= delta);

      const res = calculateSensitivityScenarios({
        chaserValue,
        targetValue,
        chaserGrowthRate,
        targetGrowthRate,
        baseYear,
        delta,
      });

      assert.ok(approxEqual(res.optimistic.chaserGrowth - res.baseline.chaserGrowth, delta));
      assert.ok(approxEqual(res.baseline.chaserGrowth - res.pessimistic.chaserGrowth, delta));

      const o = res.optimistic.yearsToConvergence ?? Infinity;
      const b = res.baseline.yearsToConvergence ?? Infinity;
      const p = res.pessimistic.yearsToConvergence ?? Infinity;
      assert.ok(o <= b + 1e-10);
      assert.ok(b <= p + 1e-10);
    }),
    { numRuns: 200 },
  );
}

function testGenerateSensitivityProjectionShape() {
  const arb = fc.record({
    chaserValue: fc.double({ min: 1e-6, max: 1e9, noNaN: true, noInfinity: true }),
    ratio: fc.double({ min: 1e-6, max: 1e6, noNaN: true, noInfinity: true }),
    chaserGrowthRate: fc.double({ min: -0.02, max: 0.2, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: -0.02, max: 0.2, noNaN: true, noInfinity: true }),
    startYear: fc.integer({ min: 1950, max: 2100 }),
    maxYears: fc.integer({ min: 1, max: 150 }),
  });

  fc.assert(
    fc.property(
      arb,
      ({ chaserValue, ratio, chaserGrowthRate, targetGrowthRate, startYear, maxYears }) => {
        const targetValue = chaserValue * ratio;
        const proj = generateSensitivityProjection(
          chaserValue,
          targetValue,
          chaserGrowthRate,
          targetGrowthRate,
          startYear,
          maxYears,
        );
        assert.ok(proj.length >= 1);
        assert.ok(proj.length <= maxYears + 1);

        for (let i = 0; i < proj.length; i++) {
          const p = proj[i];
          assert.equal(p.year, startYear + i);
          assert.equal(p.chaser, Math.round(chaserValue * Math.pow(1 + chaserGrowthRate, i)));
          assert.equal(p.target, Math.round(targetValue * Math.pow(1 + targetGrowthRate, i)));
        }

        const lastIdx = proj.length - 1;
        const lastUnroundedChaser = chaserValue * Math.pow(1 + chaserGrowthRate, lastIdx);
        const lastUnroundedTarget = targetValue * Math.pow(1 + targetGrowthRate, lastIdx);
        if (lastIdx < maxYears) {
          assert.ok(lastUnroundedChaser >= lastUnroundedTarget);
        }
      },
    ),
    { numRuns: 150 },
  );
}

function testOECDRegionLookupsAndLatestData() {
  fc.assert(
    fc.property(fc.constantFrom(...OECD_REGION_CODES), (code) => {
      const r = getRegionByCode(code);
      assert.ok(r != null);
      assert.equal(r!.code, code);

      const latest = getLatestRegionData(code);
      if (!OECD_STATIC_DATA_CODES_SET.has(code)) {
        assert.equal(latest, null);
      } else {
        assert.ok(latest != null);
        const series = STATIC_REGION_DATA[code] || [];
        const maxYear = Math.max(...series.map((p) => p.year));
        assert.equal(latest!.year, maxYear);
      }
    }),
    { numRuns: 200 },
  );

  fc.assert(
    fc.property(fc.constantFrom(...OECD_COUNTRY_CODES), (countryCode) => {
      const regions = getRegionsByCountry(countryCode);
      for (const r of regions) assert.equal(r.countryCode, countryCode);
    }),
    { numRuns: 60 },
  );

  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 8 }), (code) => {
      fc.pre(!OECD_REGION_CODES.includes(code));
      assert.equal(getRegionByCode(code), undefined);
    }),
    { numRuns: 120 },
  );
}

function testOECDApiUrlBuilderEncodesDimensions() {
  const arb = fc.record({
    regions: fc
      .array(fc.constantFrom(...OECD_REGION_CODES), { minLength: 1, maxLength: 6 })
      .map((xs) => Array.from(new Set(xs))),
    level: fc.constantFrom("TL2", "TL3" as const),
    startYear: fc.integer({ min: 1990, max: 2020 }),
    endYear: fc.integer({ min: 2021, max: 2030 }),
  });

  fc.assert(
    fc.property(arb, ({ regions, level, startYear, endYear }) => {
      const urlPc = buildOECDApiUrl({ regions, level, measure: "GDP_PC", startYear, endYear });
      assert.ok(urlPc.includes(`A.${level}.${regions.join("+")}._Z.GDP_PC._T.Q.USD_PPP_PS`));
      assert.ok(urlPc.includes(`startPeriod=${startYear}`));
      assert.ok(urlPc.includes(`endPeriod=${endYear}`));

      const urlGdp = buildOECDApiUrl({ regions, level, measure: "GDP", startYear, endYear });
      assert.ok(urlGdp.includes(`A.${level}.${regions.join("+")}._Z.GDP._T.Q.USD_PPP`));
    }),
    { numRuns: 120 },
  );
}

function testOecdRegionCodesAlwaysResolveToMetadata() {
  for (const code of OECD_REGION_CODES) {
    const region = getRegionByCode(code);
    assert.ok(region != null);
    assert.equal(region!.code, code);
    assert.ok(region!.name.length > 0);
    assert.ok(region!.countryCode.length > 0);
  }
}

function testRegionalConvergenceMatchesMathOrNullCases() {
  const arb = fc.record({
    chaserCode: fc.constantFrom(...OECD_STATIC_DATA_CODES),
    targetCode: fc.constantFrom(...OECD_STATIC_DATA_CODES),
    chaserGrowthRatePct: fc.double({ min: -10, max: 25, noNaN: true, noInfinity: true }),
    targetGrowthRatePct: fc.double({ min: -10, max: 25, noNaN: true, noInfinity: true }),
  });

  fc.assert(
    fc.property(arb, ({ chaserCode, targetCode, chaserGrowthRatePct, targetGrowthRatePct }) => {
      const chaser = getLatestRegionData(chaserCode)!;
      const target = getLatestRegionData(targetCode)!;
      const res = calculateRegionalConvergence(
        chaserCode,
        targetCode,
        chaserGrowthRatePct,
        targetGrowthRatePct,
      );

      assert.equal(res.chaserValue, chaser.gdpPerCapita);
      assert.equal(res.targetValue, target.gdpPerCapita);

      const expectedGap = ((target.gdpPerCapita - chaser.gdpPerCapita) / chaser.gdpPerCapita) * 100;
      assert.ok(res.gap != null);
      assert.ok(approxEqual(res.gap as number, expectedGap, 1e-10, 1e-6));

      const differential = chaserGrowthRatePct - targetGrowthRatePct;
      if (differential <= 0 || chaser.gdpPerCapita >= target.gdpPerCapita) {
        assert.equal(res.yearsToConverge, null);
      } else {
        const ratio = target.gdpPerCapita / chaser.gdpPerCapita;
        const expectedYears = Math.ceil(Math.log(ratio) / Math.log(1 + differential / 100));
        assert.equal(res.yearsToConverge, expectedYears);
      }
    }),
    { numRuns: 200 },
  );
}

function testHeadlineScenarioAndUrlSuffix() {
  const arbName = fc
    .array(fc.constantFrom(...("abcdefghijklmnopqrstuvwxyz" as const).split("")), {
      minLength: 1,
      maxLength: 12,
    })
    .map((xs) => xs.join(""));

  const arbData = fc.record({
    chaserName: arbName,
    targetName: arbName,
    metricName: arbName,
    chaserIso: arbIso3,
    targetIso: arbIso3,
    chaserGrowthRate: fc.double({ min: -0.2, max: 0.5, noNaN: true, noInfinity: true }),
    targetGrowthRate: fc.double({ min: -0.2, max: 0.5, noNaN: true, noInfinity: true }),
    yearsToConvergence: fc.double({ min: -100, max: 500, noNaN: true, noInfinity: true }),
    convergenceYear: fc.option(fc.integer({ min: 1950, max: 2300 }), { nil: null }),
    gap: fc.double({ min: -50, max: 500, noNaN: true, noInfinity: true }),
    appUrl: fc.option(fc.constant("https://example.com/share"), { nil: undefined }),
  });

  fc.assert(
    fc.property(arbData, (data: HeadlineData) => {
      const out = generateHeadline(data);
      const expectedScenario =
        data.gap <= 1
          ? "already_ahead"
          : !Number.isFinite(data.yearsToConvergence) || data.yearsToConvergence <= 0
            ? "not_converging"
            : "converging";
      assert.equal(out.scenario, expectedScenario);

      assert.ok(out.short.includes(data.chaserName));
      assert.ok(out.short.includes(data.targetName));
      assert.ok(out.long.includes(data.chaserName));
      assert.ok(out.long.includes(data.targetName));

      if (data.appUrl) {
        assert.ok(out.long.endsWith(data.appUrl));
      }

      // Deterministic output given the same input.
      const out2 = generateHeadline(data);
      assert.deepEqual(out2, out);
    }),
    { numRuns: 200 },
  );

  // If the URL fits, it should be appended to short too.
  const dataSmall: HeadlineData = {
    chaserName: "A",
    chaserIso: "AAA",
    targetName: "B",
    targetIso: "BBB",
    metricName: "GDP",
    chaserGrowthRate: 0.05,
    targetGrowthRate: 0.02,
    yearsToConvergence: 10,
    convergenceYear: 2035,
    gap: 5,
    appUrl: "https://example.com/share",
  };
  const outSmall = generateHeadline(dataSmall);
  assert.ok(outSmall.short.endsWith(dataSmall.appUrl));
  assert.ok(outSmall.long.endsWith(dataSmall.appUrl));

  const all = generateAllHeadlines(dataSmall);
  assert.equal(all.scenario, "converging");
  assert.ok(all.headlines.short.length > 0);
  assert.ok(all.headlines.long.length > 0);
}

function testHeadlineOutputContainsNoRawAngleBrackets() {
  const arbText = fc
    .array(fc.constantFrom(...("ab<>/&\"'🔥 " as const).split("")), { minLength: 1, maxLength: 30 })
    .map((xs) => xs.join(""));

  fc.assert(
    fc.property(arbText, arbText, arbText, (chaserName, targetName, metricName) => {
      const data: HeadlineData = {
        chaserName,
        chaserIso: "AAA",
        targetName,
        targetIso: "BBB",
        metricName,
        chaserGrowthRate: 0.05,
        targetGrowthRate: 0.02,
        yearsToConvergence: 10,
        convergenceYear: 2035,
        gap: 5,
      };

      const out = generateHeadline(data);
      assert.ok(!/[<>]/.test(out.short));
      assert.ok(!/[<>]/.test(out.long));

      const all = generateAllHeadlines(data);
      for (const s of all.headlines.short) assert.ok(!/[<>]/.test(s));
      for (const s of all.headlines.long) assert.ok(!/[<>]/.test(s));
    }),
    { numRuns: 180 },
  );
}

function testShareUrlEncodesTextAndUrl() {
  const arbText = fc
    .array(fc.constantFrom(...("abcXYZ 123-_.~" as const).split("")), {
      minLength: 1,
      maxLength: 80,
    })
    .map((xs) => xs.join(""));

  fc.assert(
    fc.property(
      arbText,
      fc.option(fc.constant("https://example.com/x?q=1&v=2#h"), { nil: undefined }),
      (text, url) => {
        const twitter = getShareUrl("twitter", text, url);
        assert.ok(twitter.startsWith("https://twitter.com/intent/tweet?text="));
        assert.equal(new URL(twitter).searchParams.get("text"), text);

        const linkedin = getShareUrl("linkedin", text, url);
        if (url) {
          assert.ok(linkedin.startsWith("https://www.linkedin.com/sharing/share-offsite/?url="));
        } else {
          assert.ok(linkedin.includes("shareActive=true"));
          assert.equal(new URL(linkedin).searchParams.get("text"), text);
        }

        const facebook = getShareUrl("facebook", text, url);
        assert.ok(facebook.startsWith("https://www.facebook.com/sharer/sharer.php?"));
        assert.equal(new URL(facebook).searchParams.get("quote"), text);
        if (url) assert.equal(new URL(facebook).searchParams.get("u"), url);
      },
    ),
    { numRuns: 200 },
  );
}

function testRegionalExportsRowCountsAndEscaping() {
  const arbWeird = fc
    // Avoid embedded newlines so line-count assertions remain meaningful.
    .array(fc.constantFrom(...('ab,"' as const).split("")), { minLength: 1, maxLength: 20 })
    .map((xs) => xs.join(""));

  const arb = fc.record({
    state: arbShareStateLoose,
    chaserName: arbWeird,
    targetName: arbWeird,
    chaserCountry: arbWeird,
    targetCountry: arbWeird,
    chaserCode: fc.constantFrom(...OECD_REGION_CODES),
    targetCode: fc.constantFrom(...OECD_REGION_CODES),
    n: fc.integer({ min: 0, max: 10 }),
    m: fc.integer({ min: 0, max: 10 }),
  });

  fc.assert(
    fc.property(
      arb,
      ({
        state,
        chaserName,
        targetName,
        chaserCountry,
        targetCountry,
        chaserCode,
        targetCode,
        n,
        m,
      }) => {
        const normalized = normalizeStateLoose(state);
        const chaserRegion: OECDRegion = {
          code: chaserCode,
          name: chaserName,
          countryCode: "CCC",
          countryName: chaserCountry,
          level: "TL2" as const,
        };
        const targetRegion: OECDRegion = {
          code: targetCode,
          name: targetName,
          countryCode: "DDD",
          countryName: targetCountry,
          level: "TL2" as const,
        };

        const observed: Record<string, Array<{ year: number; value: number }>> = {
          [chaserCode]: Array.from({ length: n }, (_, i) => ({ year: 2000 + i, value: i + 0.5 })),
          [targetCode]: Array.from({ length: m }, (_, i) => ({ year: 2010 + i, value: i + 1.5 })),
        };

        const csv = toRegionalObservedCsv({
          state: normalized,
          observed,
          chaserRegion,
          targetRegion,
        });
        assert.ok(csv.startsWith("# Convergence Explorer Data Export"));

        const lines = csv.split("\n");
        const headerLines = 9;
        const expectedDataRows =
          chaserCode === targetCode
            ? (observed[chaserCode]?.length ?? 0) * 2
            : (observed[chaserCode]?.length ?? 0) + (observed[targetCode]?.length ?? 0);
        assert.equal(lines.length, headerLines + 1 + expectedDataRows);

        // If a row is written and the name contains quotes, CSV should escape them by doubling.
        if (chaserName.includes('"') && (observed[chaserCode]?.length ?? 0) > 0) {
          assert.ok(csv.includes(chaserName.replace(/"/g, '""')));
        }

        const projection = Array.from({ length: Math.max(1, Math.min(5, n + m + 1)) }, (_, i) => ({
          year: normalized.baseYear + i,
          chaser: 10 + i,
          target: 20 + i,
        }));
        const csv2 = toRegionalProjectionCsv({
          state: normalized,
          projection,
          chaserRegion,
          targetRegion,
        });
        assert.ok(csv2.startsWith("# Convergence Explorer Data Export"));
        assert.equal(csv2.split("\n").length, headerLines + 1 + projection.length);

        const observedRegion: Record<string, OECDRegionData[]> = {
          [chaserCode]: (observed[chaserCode] || []).map((p) => ({
            code: chaserCode,
            year: p.year,
            gdpPerCapita: p.value,
          })),
          [targetCode]: (observed[targetCode] || []).map((p) => ({
            code: targetCode,
            year: p.year,
            gdpPerCapita: p.value,
          })),
        };

        const report = toRegionalReportJson({
          state: normalized,
          observed: observedRegion,
          projection,
          derived: { yearsToConvergence: 10, convergenceYear: normalized.baseYear + 10, gap: 1 },
          chaserRegion,
          targetRegion,
        });
        const parsed = JSON.parse(report);
        assert.equal(parsed.meta.tool, "Convergence Explorer");
        assert.ok(String(parsed.meta.permalink).includes("v=1"));
      },
    ),
    { numRuns: 120 },
  );
}

function testBibtexCitationsBalancedAndEscaped() {
  const arb = fc.record({
    toolName: fc
      .array(fc.constantFrom(...("Tool & Name % # _ { }" as const).split("")), {
        minLength: 1,
        maxLength: 40,
      })
      .map((xs) => xs.join("")),
    source: fc
      .array(fc.constantFrom(...("Source & Name % # _ { }" as const).split("")), {
        minLength: 1,
        maxLength: 40,
      })
      .map((xs) => xs.join("")),
    indicatorName: fc
      .array(fc.constantFrom(...("GDP & Growth % # _ { }" as const).split("")), {
        minLength: 1,
        maxLength: 50,
      })
      .map((xs) => xs.join("")),
    state: arbShareStateLoose,
  });

  fc.assert(
    fc.property(arb, ({ toolName, source, indicatorName, state }) => {
      const normalized = normalizeStateLoose(state);
      const ctx: CitationContext = {
        toolName,
        toolUrl: "https://example.com/app",
        accessDate: new Date("2024-01-15T00:00:00.000Z"),
        chaserName: "A & B",
        chaserIso: normalized.chaser,
        targetName: "C # D",
        targetIso: normalized.target,
        indicatorName,
        indicatorCode: normalized.indicator,
        dataSource: source,
        dataSourceCode: null,
        state: normalized,
      };

      const toolBib = generateToolCitation(ctx, "bibtex");
      assert.ok(hasBalancedUnescapedBraces(toolBib));
      const toolTitle = extractBibtexField(toolBib, "title");
      assert.ok(toolTitle != null);
      assert.ok(!hasUnescapedBibtexSpecial(toolTitle!));

      const dataBib = generateDataSourceCitation(
        source,
        null,
        indicatorName,
        normalized.indicator,
        new Date("2024-01-15T00:00:00.000Z"),
        "bibtex",
      );
      assert.ok(hasBalancedUnescapedBraces(dataBib));
      const author = extractBibtexField(dataBib, "author");
      const title = extractBibtexField(dataBib, "title");
      const note = extractBibtexField(dataBib, "note");
      assert.ok(author != null && !hasUnescapedBibtexSpecial(author!));
      assert.ok(title != null && !hasUnescapedBibtexSpecial(title!));
      assert.ok(note != null && !hasUnescapedBibtexSpecial(note!));
    }),
    { numRuns: 140 },
  );
}

function run() {
  const tests = [
    ["convergence: formatters", testConvergenceFormatters],
    ["dataSourceUrls: properties", testDataSourceUrlsProperties],
    ["dataExport: csv/json invariants", testDataExportCsvAndJsonInvariants],
    ["shareCardSvg: invariants", testShareCardSvgInvariants],
    ["cardSvgs: no invalid numbers", testCardSvgGeneratorsNoInvalidNumbers],
    ["threadGenerator: captions shape", testThreadCaptionsShape],
    ["shareState: regions mode parsing", testShareStateRegionsModeParsing],
    ["csv: header newline sanitization", testCsvHeaderSanitizePreventsNewlines],
    ["oecdRegions: data integrity", testOecdRegionDataIntegrity],
    ["svgs: zero values no NaN", testSvgGeneratorsHandleZeroValues],
    ["shareState: normalize is idempotent", testShareStateNormalizeIdempotent],
    ["shareState: parsed invariants", testShareStateParsedInvariants],
    ["shareState: embed params roundtrip", testEmbedParamsRoundtrip],
    [
      "shareState: unicode/url-unsafe fuzz roundtrip",
      testShareStateUnicodeAndUrlUnsafeInputRoundtrip,
    ],
    ["convergence: years formula matches growth", testConvergenceYearsMatchesProjectionMath],
    [
      "convergence: higher differential means fewer years",
      testConvergenceYearsMonotonicInGrowthDifferential,
    ],
    ["convergence: required growth rate hits target path", testRequiredGrowthRateHitsTargetPath],
    ["convergence: generateProjection shape/invariants", testGenerateProjectionShape],
    ["convergence: milestones match first reach year", testMilestonesMatchFirstReachYear],
    ["implicationsMath: projectValue year0 identity", testProjectValueYearZeroIdentity],
    [
      "implicationsMath: projectValue zero-rate identity",
      testProjectValueZeroRateKeepsBaseForAllYears,
    ],
    ["implicationsMath: calculateCagr synthetic series", testCalculateCagrSyntheticSeries],
    ["implicationsMath: computeTotals invariants", testComputeTotalsInvariants],
    [
      "implicationsMath: computeTotals non-negative outputs",
      testComputeTotalsOutputNonNegativeWhenPresent,
    ],
    [
      "templatePaths: buildTemplateMapping points unique/sorted",
      testBuildTemplateMappingPointsSortedUnique,
    ],
    ["templatePaths: estimateFromTemplate clamp/apply", testEstimateFromTemplateClampAndApply],
    [
      "citations: buildPermalink normalizes toolUrl",
      testBuildPermalinkNormalizesToolUrlAndKeepsHash,
    ],
    ["citations: bibtex title escaping", testToolCitationBibtexEscapesTitle],
    ["countryAdjustments: lookup/apply", testCountryAdjustmentsLookupAndApply],
    ["growthBenchmarks: monotonic + boundaries", testBenchmarkGrowthRateIsMonotonic],
    ["implicationsScenarios: adjustments", testScenarioAdjustmentsBehaveAsSpecified],
    ["sensitivityAnalysis: ordering + years", testSensitivityScenarioOrderingAndYears],
    [
      "sensitivityAnalysis: perturbations symmetric around baseline",
      testSensitivityRatePerturbationsSymmetricAroundBaseline,
    ],
    ["sensitivityAnalysis: projection shape", testGenerateSensitivityProjectionShape],
    ["oecdRegions: lookups + latest", testOECDRegionLookupsAndLatestData],
    ["oecdRegions: api url builder", testOECDApiUrlBuilderEncodesDimensions],
    ["oecdRegions: all codes resolve to metadata", testOecdRegionCodesAlwaysResolveToMetadata],
    ["oecdRegions: regional convergence math", testRegionalConvergenceMatchesMathOrNullCases],
    ["headlineGenerator: scenario + url suffix", testHeadlineScenarioAndUrlSuffix],
    ["headlineGenerator: no raw angle brackets", testHeadlineOutputContainsNoRawAngleBrackets],
    ["headlineGenerator: share url encoding", testShareUrlEncodesTextAndUrl],
    ["regionsDataExport: csv/json invariants", testRegionalExportsRowCountsAndEscaping],
    ["citations: bibtex balanced and escaped", testBibtexCitationsBalancedAndEscaped],
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
