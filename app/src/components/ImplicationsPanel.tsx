import { useMemo, useState } from "react";
import type { Indicator } from "../types";
import { useBatchData } from "../hooks/useBatchData";
import { formatMetricValue, formatNumber } from "../lib/convergence";
import {
  IMPLICATION_METRICS,
  IMPLICATION_METRIC_CODES,
  TEMPLATE_PATHS,
  type TemplateId,
  buildTemplateMapping,
  estimateFromTemplate,
} from "../lib/templatePaths";
import { calculateCagr, computeTotals, projectValue } from "../lib/implicationsMath";
import {
  applyScenarioToImpliedMetric,
  IMPLICATION_SCENARIOS,
  type ScenarioId,
} from "../lib/implicationsScenarios";

type PopAssumption = "trend" | "static";
type PowerMixKey = "solar" | "wind" | "nuclear" | "coal";

type ImplicationAssumptions = {
  solarCf: number;
  windCf: number;
  nuclearCf: number;
  coalCf: number;
  panelWatts: number;
  windTurbineMw: number;
  householdSize: number;
  gridLossPct: number;
  netImportsPct: number;
};

const DEFAULT_ASSUMPTIONS: ImplicationAssumptions = {
  solarCf: 0.2,
  windCf: 0.35,
  nuclearCf: 0.9,
  coalCf: 0.6,
  panelWatts: 400,
  windTurbineMw: 3,
  householdSize: 4,
  gridLossPct: 10,
  netImportsPct: 0,
};

type MixPreset = { id: string; label: string; mix: Record<PowerMixKey, number> };

const MIX_PRESETS: MixPreset[] = [
  { id: "clean", label: "Clean (60/30/10)", mix: { solar: 60, wind: 30, nuclear: 10, coal: 0 } },
  { id: "renewables", label: "Solar+Wind (50/50)", mix: { solar: 50, wind: 50, nuclear: 0, coal: 0 } },
  { id: "nuclear", label: "All nuclear", mix: { solar: 0, wind: 0, nuclear: 100, coal: 0 } },
  { id: "coal", label: "All coal", mix: { solar: 0, wind: 0, nuclear: 0, coal: 100 } },
  { id: "balanced", label: "Balanced", mix: { solar: 30, wind: 30, nuclear: 20, coal: 20 } },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ImplicationsPanel({
  chaserIso,
  chaserName,
  gdpCurrent,
  chaserGrowthRate,
  baseYear,
  horizonYears,
  onHorizonYearsChange,
  template,
  onTemplateChange,
  enabled,
}: {
  chaserIso: string;
  chaserName: string;
  gdpCurrent: number;
  chaserGrowthRate: number;
  baseYear: number;
  horizonYears: number;
  onHorizonYearsChange: (years: number) => void;
  template: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  enabled: boolean;
}) {
  const templateDef = TEMPLATE_PATHS.find((t) => t.id === template) ?? TEMPLATE_PATHS[0];
  const countries = useMemo(() => {
    const list = [chaserIso, ...templateDef.iso3];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const iso of list) {
      const cleaned = iso.trim().toUpperCase();
      if (!cleaned) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      out.push(cleaned);
    }
    return out;
  }, [chaserIso, templateDef.iso3]);
  const indicators = useMemo(
    () => [
      "GDP_PCAP_PPP",
      "POPULATION",
      ...IMPLICATION_METRIC_CODES,
      "ELECTRICITY_GEN_TOTAL",
      "ELECTRICITY_GEN_SOLAR",
      "ELECTRICITY_GEN_WIND",
      "ELECTRICITY_GEN_COAL",
      "ELECTRICITY_GEN_NUCLEAR",
      "INSTALLED_CAPACITY_SOLAR_GW",
      "INSTALLED_CAPACITY_WIND_GW",
      "INSTALLED_CAPACITY_COAL_GW",
      "INSTALLED_CAPACITY_NUCLEAR_GW",
    ],
    []
  );

  const { data, indicatorByCode, loading, error, getLatestValue } = useBatchData({
    countries,
    indicators,
    startYear: 1990,
    enabled,
  });
  const { data: dataWithVintage } = useBatchData({
    countries: [chaserIso],
    indicators: ["ELECTRICITY_GEN_TOTAL"],
    startYear: 1990,
    enabled,
    includeSourceVintage: true,
  });

  const gdpFuture = gdpCurrent * Math.pow(1 + chaserGrowthRate, horizonYears);

  const gdpByIso = useMemo(() => data["GDP_PCAP_PPP"] || {}, [data]);
  const observedBaseYear = useMemo(() => {
    const series = gdpByIso[chaserIso] || [];
    let latestYear = -Infinity;
    for (const p of series) {
      if (!Number.isFinite(p.year)) continue;
      latestYear = Math.max(latestYear, p.year);
    }
    return Number.isFinite(latestYear) ? latestYear : baseYear;
  }, [baseYear, chaserIso, gdpByIso]);
  const year = observedBaseYear + horizonYears;

  const popSeries = useMemo(() => data["POPULATION"]?.[chaserIso] || [], [chaserIso, data]);

  const popCurrent = useMemo(() => getLatestValue("POPULATION", chaserIso), [chaserIso, getLatestValue]);
  const popTrendRate = useMemo(() => {
    const rate = calculateCagr({ series: popSeries, lookbackYears: 10 });
    if (rate == null) return 0;
    return Math.max(-0.03, Math.min(0.05, rate));
  }, [popSeries]);
  const [popAssumption, setPopAssumption] = useState<PopAssumption>("trend");
  const [assumptions, setAssumptions] = useState<ImplicationAssumptions>(DEFAULT_ASSUMPTIONS);
  const [mixMode, setMixMode] = useState(false);
  const [mix, setMix] = useState<Record<PowerMixKey, number>>(MIX_PRESETS[0].mix);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("baseline");
  const scenarioDef = useMemo(
    () => IMPLICATION_SCENARIOS.find((s) => s.id === scenario) ?? IMPLICATION_SCENARIOS[0],
    [scenario]
  );

  const popGrowthRate = popAssumption === "trend" ? popTrendRate : 0;
  const popFuture =
    popCurrent != null ? projectValue(popCurrent, popGrowthRate, horizonYears) : null;

  const rows = useMemo(() => {
    const out: Array<{
      indicator: Indicator | null;
      code: string;
      current: number | null;
      implied: number | null;
      deltaLabel: string | null;
      note: string | null;
      currentTotal: { unit: string; value: number } | null;
      impliedTotal: { unit: string; value: number } | null;
    }> = [];

    for (const metric of IMPLICATION_METRICS) {
      const indicator = (indicatorByCode[metric.code] as Indicator | undefined) || null;
      const metricByIso = data[metric.code] || {};

      const mapping = buildTemplateMapping({
        gdpByIso,
        metricByIso,
        iso3: templateDef.iso3,
        metricTransform: metric.transform,
      });

      const templateAtCurrent = mapping.predict(gdpCurrent);
      const templateAtFuture = mapping.predict(gdpFuture);
      const chaserCurrentMetric = getLatestValue(metric.code, chaserIso);

      const implied = estimateFromTemplate({
        templateAtCurrentGdp: templateAtCurrent,
        templateAtFutureGdp: templateAtFuture,
        chaserCurrentMetric,
        apply: metric.apply,
        clampRange: metric.clamp,
      });
      const impliedScenario = applyScenarioToImpliedMetric({
        scenarioId: scenario,
        metricCode: metric.code,
        implied,
      });

      const current = chaserCurrentMetric;
      const totals = computeTotals({
        code: metric.code,
        currentMetric: current,
        impliedMetric: impliedScenario,
        popCurrent,
        popFuture,
        gdpPcapCurrent: gdpCurrent,
        gdpPcapFuture: gdpFuture,
      });

      const isPercent = (indicator?.unit || "").toLowerCase().includes("percent");
      const deltaLabel =
        impliedScenario == null || current == null
          ? null
          : isPercent
            ? `${impliedScenario >= current ? "+" : ""}${(impliedScenario - current).toFixed(1)}pp`
            : current !== 0
              ? `${impliedScenario >= current ? "+" : ""}${(((impliedScenario - current) / current) * 100).toFixed(0)}%`
              : null;

      const noteParts: string[] = [];
      if (implied != null && current == null) {
        noteParts.push("Using template level (no current local baseline).");
      }
      if (scenario !== "baseline" && impliedScenario != null && implied != null && impliedScenario !== implied) {
        noteParts.push("Scenario adjustment applied.");
      }
      if (mapping.gdpMin != null && mapping.gdpMax != null) {
        const outOfRange =
          gdpCurrent < mapping.gdpMin ||
          gdpCurrent > mapping.gdpMax ||
          gdpFuture < mapping.gdpMin ||
          gdpFuture > mapping.gdpMax;
        if (outOfRange) {
          noteParts.push("Outside template GDP range; estimate is capped to endpoints.");
        }
        } else {
          noteParts.push("Not enough template data for this metric.");
        }
      const note = noteParts.length ? noteParts.join(" ") : null;

      out.push({
        indicator,
        code: metric.code,
        current,
        implied: impliedScenario,
        deltaLabel,
        note,
        currentTotal: totals.currentTotal,
        impliedTotal: totals.impliedTotal,
      });
    }

    return out;
  }, [
    chaserIso,
    data,
    gdpByIso,
    gdpCurrent,
    gdpFuture,
    getLatestValue,
    indicatorByCode,
    popCurrent,
    popFuture,
    scenario,
    templateDef.iso3,
  ]);

  const hasAny = rows.some((r) => r.implied != null);

  const popLabel = popAssumption === "trend" ? "Population: 10y trend" : "Population: static";

  const observedElectricity = useMemo(() => {
    const valueAtYear = (code: string, year: number) => {
      const pts = data[code]?.[chaserIso];
      if (!pts || pts.length === 0) return null;
      for (const p of pts) if (p.year === year) return p.value;
      return null;
    };
    const pointAtYear = (code: string, year: number) => {
      const pts = dataWithVintage[code]?.[chaserIso];
      if (!pts || pts.length === 0) return null;
      for (const p of pts) if (p.year === year) return p;
      return null;
    };

    // Pick the latest year where we have a consistent "total + at least one source" snapshot.
    const totalSeries = data["ELECTRICITY_GEN_TOTAL"]?.[chaserIso] || [];
    const sorted = [...totalSeries]
      .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
      .sort((a, b) => b.year - a.year);
    let snapshot: { year: number; total: number } | null = null;
    for (const p of sorted) {
      if (p.value == null || !Number.isFinite(p.value) || p.value <= 0) continue;
      const year = p.year;
      const solar = valueAtYear("ELECTRICITY_GEN_SOLAR", year);
      const wind = valueAtYear("ELECTRICITY_GEN_WIND", year);
      const coal = valueAtYear("ELECTRICITY_GEN_COAL", year);
      const nuclear = valueAtYear("ELECTRICITY_GEN_NUCLEAR", year);
      const hasAnySource = [solar, wind, coal, nuclear].some(
        (x) => x != null && Number.isFinite(x) && x >= 0
      );
      if (!hasAnySource) continue;
      snapshot = { year, total: p.value };
      break;
    }
    if (!snapshot) return null;

    const { year, total } = snapshot;
    const totalPoint = pointAtYear("ELECTRICITY_GEN_TOTAL", year);
    const solarTWh = valueAtYear("ELECTRICITY_GEN_SOLAR", year);
    const windTWh = valueAtYear("ELECTRICITY_GEN_WIND", year);
    const coalTWh = valueAtYear("ELECTRICITY_GEN_COAL", year);
    const nuclearTWh = valueAtYear("ELECTRICITY_GEN_NUCLEAR", year);

    const share = (x: number | null) =>
      x != null && Number.isFinite(x) && x >= 0 ? (x / total) * 100 : null;

    return {
      year,
      totalTWh: total,
      totalSourceVintage:
        totalPoint && "source_vintage" in totalPoint ? (totalPoint.source_vintage ?? null) : null,
      bySourceTWh: {
        solar: solarTWh,
        wind: windTWh,
        coal: coalTWh,
        nuclear: nuclearTWh,
      },
      shares: {
        solar: share(solarTWh),
        wind: share(windTWh),
        coal: share(coalTWh),
        nuclear: share(nuclearTWh),
      },
    };
  }, [chaserIso, data, dataWithVintage]);

  const macro = useMemo(() => {
    const byCode = new Map(rows.map((r) => [r.code, r]));

    const gdpTotalCurrent =
      popCurrent != null && Number.isFinite(popCurrent) && popCurrent > 0
        ? { unit: "int$" as const, value: gdpCurrent * popCurrent }
        : null;
    const gdpTotalFuture =
      popFuture != null && Number.isFinite(popFuture) && popFuture > 0
        ? { unit: "int$" as const, value: gdpFuture * popFuture }
        : null;

    const electricityRow = byCode.get("ELECTRICITY_USE_PCAP");
    const demandCurrentTWh =
      electricityRow?.currentTotal?.unit === "TWh" ? electricityRow.currentTotal.value : null;
    const demandFutureTWh =
      electricityRow?.impliedTotal?.unit === "TWh" ? electricityRow.impliedTotal.value : null;
    const demandDeltaTWh =
      demandCurrentTWh != null && demandFutureTWh != null ? demandFutureTWh - demandCurrentTWh : null;

    const gridLossFrac = clamp(assumptions.gridLossPct / 100, 0, 0.5);
    const netImportsFrac = clamp(assumptions.netImportsPct / 100, -0.5, 0.5);

    const requiredDomesticGenerationFutureTWh =
      demandFutureTWh != null && Number.isFinite(demandFutureTWh)
        ? demandFutureTWh / (1 - gridLossFrac) - demandFutureTWh * netImportsFrac
        : null;

    const buildoutDeltaTWh =
      requiredDomesticGenerationFutureTWh != null &&
      observedElectricity?.totalTWh != null &&
      Number.isFinite(observedElectricity.totalTWh)
        ? Math.max(0, requiredDomesticGenerationFutureTWh - observedElectricity.totalTWh)
        : null;

    const avgGWFromTWhPerYear = (twh: number) => (twh * 1000) / 8760;

    const demandDeltaAvgGW = demandDeltaTWh != null ? avgGWFromTWhPerYear(demandDeltaTWh) : null;
    const buildoutDeltaAvgGW =
      buildoutDeltaTWh != null ? avgGWFromTWhPerYear(buildoutDeltaTWh) : null;

    const twhPerYearPerGW = (capacityFactor: number) => 8.76 * capacityFactor;
    const gwFromTWhPerYear = (twh: number, capacityFactor: number) =>
      twh / twhPerYearPerGW(capacityFactor);

    const nuclearCf = clamp(assumptions.nuclearCf, 0.05, 0.98);
    const coalCf = clamp(assumptions.coalCf, 0.05, 0.95);
    const solarCf = clamp(assumptions.solarCf, 0.05, 0.5);
    const windCf = clamp(assumptions.windCf, 0.05, 0.7);
    const panelWatts = clamp(assumptions.panelWatts, 100, 1000);
    const windTurbineMw = clamp(assumptions.windTurbineMw, 0.5, 20);

    const twhPerPanelPerYear =
      (panelWatts / 1000) * solarCf * 8760 / 1e9; // kW * h => kWh, then -> TWh

    const electricityEquivalents =
      buildoutDeltaTWh != null && Number.isFinite(buildoutDeltaTWh)
        ? {
            deltaTWh: buildoutDeltaTWh,
            deltaAvgGW: buildoutDeltaAvgGW,
            nuclear: {
              plants: buildoutDeltaTWh / twhPerYearPerGW(nuclearCf),
              gw: gwFromTWhPerYear(buildoutDeltaTWh, nuclearCf),
            },
            coal: {
              plants: buildoutDeltaTWh / twhPerYearPerGW(coalCf),
              gw: gwFromTWhPerYear(buildoutDeltaTWh, coalCf),
            },
            solar: {
              gw: gwFromTWhPerYear(buildoutDeltaTWh, solarCf),
              panels: twhPerPanelPerYear > 0 ? buildoutDeltaTWh / twhPerPanelPerYear : null,
            },
            wind: {
              gw: gwFromTWhPerYear(buildoutDeltaTWh, windCf),
              turbines:
                windTurbineMw > 0
                  ? (gwFromTWhPerYear(buildoutDeltaTWh, windCf) * 1000) / windTurbineMw
                  : null,
            },
            assumptions: {
              nuclearCf,
              coalCf,
              solarCf,
              windCf,
              panelWatts,
              windTurbineMw,
            },
          }
        : null;

    const urbanRow = byCode.get("URBAN_POP_PCT");
    const urbanCurrentPersons =
      urbanRow?.currentTotal?.unit === "persons" ? urbanRow.currentTotal.value : null;
    const urbanFuturePersons =
      urbanRow?.impliedTotal?.unit === "persons" ? urbanRow.impliedTotal.value : null;
    const urbanDeltaPersons =
      urbanCurrentPersons != null && urbanFuturePersons != null
        ? urbanFuturePersons - urbanCurrentPersons
        : null;
    const homesNeeded =
      urbanDeltaPersons != null &&
      Number.isFinite(urbanDeltaPersons) &&
      assumptions.householdSize > 0
        ? urbanDeltaPersons / assumptions.householdSize
        : null;

    const co2Row = byCode.get("CO2_PCAP");
    const co2CurrentMt =
      co2Row?.currentTotal?.unit === "MtCO2" ? co2Row.currentTotal.value : null;
    const co2FutureMt =
      co2Row?.impliedTotal?.unit === "MtCO2" ? co2Row.impliedTotal.value : null;

    return {
      gdpTotalCurrent,
      gdpTotalFuture,
      electricity: {
        demandCurrentTWh,
        demandFutureTWh,
        demandDeltaTWh,
        requiredDomesticGenerationFutureTWh,
        buildoutDeltaTWh,
        demandDeltaAvgGW,
        buildoutDeltaAvgGW,
        assumptions: { gridLossPct: assumptions.gridLossPct, netImportsPct: assumptions.netImportsPct },
        equivalents: electricityEquivalents,
      },
      urban: {
        currentPersons: urbanCurrentPersons,
        futurePersons: urbanFuturePersons,
        deltaPersons: urbanDeltaPersons,
        homesNeeded,
      },
      co2: {
        currentMt: co2CurrentMt,
        futureMt: co2FutureMt,
      },
    };
  }, [assumptions, gdpCurrent, gdpFuture, observedElectricity, popCurrent, popFuture, rows]);

  const baselineMultipliers = useMemo(() => {
    const eq = macro.electricity.equivalents;
    if (!eq || !observedElectricity) return null;

    const latestPoint = (code: string) => {
      const pts = data[code]?.[chaserIso];
      if (!pts || pts.length === 0) return null;
      let best = pts[0];
      for (const p of pts) if (p.year > best.year) best = p;
      return best;
    };

    const capSolar = latestPoint("INSTALLED_CAPACITY_SOLAR_GW");
    const capWind = latestPoint("INSTALLED_CAPACITY_WIND_GW");
    const capCoal = latestPoint("INSTALLED_CAPACITY_COAL_GW");
    const capNuclear = latestPoint("INSTALLED_CAPACITY_NUCLEAR_GW");

    const twhPerYearPerGW = (capacityFactor: number) => 8.76 * capacityFactor;
    const gwFromTWh = (twh: number | null, capacityFactor: number) => {
      if (twh == null || !Number.isFinite(twh) || twh <= 0) return null;
      const denom = twhPerYearPerGW(capacityFactor);
      if (!Number.isFinite(denom) || denom <= 0) return null;
      return twh / denom;
    };

    const inferredSolarGw = gwFromTWh(observedElectricity.bySourceTWh.solar, eq.assumptions.solarCf);
    const inferredWindGw = gwFromTWh(observedElectricity.bySourceTWh.wind, eq.assumptions.windCf);
    const inferredCoalGw = gwFromTWh(observedElectricity.bySourceTWh.coal, eq.assumptions.coalCf);
    const inferredNuclearGw = gwFromTWh(observedElectricity.bySourceTWh.nuclear, eq.assumptions.nuclearCf);

    const ratio = (needGw: number, baseGw: number | null) => {
      if (!Number.isFinite(needGw) || needGw <= 0) return null;
      if (baseGw == null || !Number.isFinite(baseGw) || baseGw <= 0) return null;
      return needGw / baseGw;
    };

    const capacityYear = Math.max(
      capSolar?.year ?? -Infinity,
      capWind?.year ?? -Infinity,
      capCoal?.year ?? -Infinity,
      capNuclear?.year ?? -Infinity
    );

    const solarBase =
      capSolar?.value != null && Number.isFinite(capSolar.value) && capSolar.value > 0
        ? capSolar.value
        : inferredSolarGw;
    const windBase =
      capWind?.value != null && Number.isFinite(capWind.value) && capWind.value > 0
        ? capWind.value
        : inferredWindGw;
    const coalBase =
      capCoal?.value != null && Number.isFinite(capCoal.value) && capCoal.value > 0
        ? capCoal.value
        : inferredCoalGw;
    const nuclearBase =
      capNuclear?.value != null && Number.isFinite(capNuclear.value) && capNuclear.value > 0
        ? capNuclear.value
        : inferredNuclearGw;

    const anyReported =
      solarBase === capSolar?.value ||
      windBase === capWind?.value ||
      coalBase === capCoal?.value ||
      nuclearBase === capNuclear?.value;

    const kind: "reported" | "inferred" = anyReported ? "reported" : "inferred";
    return {
      kind,
      year:
        kind === "reported" && Number.isFinite(capacityYear) ? capacityYear : observedElectricity.year,
      ratio: {
        solar: ratio(eq.solar.gw, solarBase),
        wind: ratio(eq.wind.gw, windBase),
        coal: ratio(eq.coal.gw, coalBase),
        nuclear: ratio(eq.nuclear.gw, nuclearBase),
      },
    };
  }, [chaserIso, data, macro.electricity.equivalents, observedElectricity]);

  const mixBuildout = useMemo(() => {
    const deltaTWh = macro.electricity.equivalents?.deltaTWh;
    if (deltaTWh == null || !Number.isFinite(deltaTWh) || deltaTWh <= 0) return null;

    const sum = mix.solar + mix.wind + mix.nuclear + mix.coal;
    const frac =
      sum > 0
        ? {
            solar: mix.solar / sum,
            wind: mix.wind / sum,
            nuclear: mix.nuclear / sum,
            coal: mix.coal / sum,
          }
        : { solar: 0.6, wind: 0.3, nuclear: 0.1, coal: 0 };

    const twhPerYearPerGW = (capacityFactor: number) => 8.76 * capacityFactor;
    const cf = {
      solar: clamp(assumptions.solarCf, 0.05, 0.5),
      wind: clamp(assumptions.windCf, 0.05, 0.7),
      nuclear: clamp(assumptions.nuclearCf, 0.05, 0.98),
      coal: clamp(assumptions.coalCf, 0.05, 0.95),
    } satisfies Record<PowerMixKey, number>;

    const capFromTWh = (twh: number, key: PowerMixKey) => twh / twhPerYearPerGW(cf[key]);

    const maxAnnualizedGrowth = (points: Array<{ year: number; value: number }> | undefined) => {
      if (!points || points.length < 2) return { maxYoY: null as number | null, max5y: null as number | null };
      const sorted = [...points]
        .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
        .sort((a, b) => a.year - b.year);
      if (sorted.length < 2) return { maxYoY: null, max5y: null };

      let maxYoY: number | null = null;
      for (let i = 1; i < sorted.length; i++) {
        const dy = sorted[i].year - sorted[i - 1].year;
        if (dy <= 0) continue;
        const dv = sorted[i].value - sorted[i - 1].value;
        const annual = dv / dy;
        if (!Number.isFinite(annual) || annual <= 0) continue;
        maxYoY = maxYoY == null ? annual : Math.max(maxYoY, annual);
      }

      const byYear = new Map<number, number>();
      for (const p of sorted) byYear.set(p.year, p.value);

      let max5y: number | null = null;
      for (const p of sorted) {
        const earlier = byYear.get(p.year - 5);
        if (earlier == null) continue;
        const dv = p.value - earlier;
        const annual = dv / 5;
        if (!Number.isFinite(annual) || annual <= 0) continue;
        max5y = max5y == null ? annual : Math.max(max5y, annual);
      }

      return { maxYoY, max5y };
    };

    const latestPoint = (code: string) => {
      const pts = data[code]?.[chaserIso];
      if (!pts || pts.length === 0) return null;
      let best = pts[0];
      for (const p of pts) if (p.year > best.year) best = p;
      return best.value;
    };

    const baseCap: Record<PowerMixKey, number | null> = {
      solar: latestPoint("INSTALLED_CAPACITY_SOLAR_GW"),
      wind: latestPoint("INSTALLED_CAPACITY_WIND_GW"),
      coal: latestPoint("INSTALLED_CAPACITY_COAL_GW"),
      nuclear: latestPoint("INSTALLED_CAPACITY_NUCLEAR_GW"),
    };

    const inferredBaseCap: Record<PowerMixKey, number | null> = {
      solar:
        observedElectricity?.bySourceTWh.solar != null
          ? capFromTWh(observedElectricity.bySourceTWh.solar, "solar")
          : null,
      wind:
        observedElectricity?.bySourceTWh.wind != null
          ? capFromTWh(observedElectricity.bySourceTWh.wind, "wind")
          : null,
      coal:
        observedElectricity?.bySourceTWh.coal != null
          ? capFromTWh(observedElectricity.bySourceTWh.coal, "coal")
          : null,
      nuclear:
        observedElectricity?.bySourceTWh.nuclear != null
          ? capFromTWh(observedElectricity.bySourceTWh.nuclear, "nuclear")
          : null,
    };

    const effectiveBaseCap: Record<PowerMixKey, number | null> = {
      solar: baseCap.solar != null && baseCap.solar > 0 ? baseCap.solar : inferredBaseCap.solar,
      wind: baseCap.wind != null && baseCap.wind > 0 ? baseCap.wind : inferredBaseCap.wind,
      coal: baseCap.coal != null && baseCap.coal > 0 ? baseCap.coal : inferredBaseCap.coal,
      nuclear: baseCap.nuclear != null && baseCap.nuclear > 0 ? baseCap.nuclear : inferredBaseCap.nuclear,
    };

    const ratio = (needGw: number, baseGw: number | null) => {
      if (!Number.isFinite(needGw) || needGw <= 0) return null;
      if (baseGw == null || !Number.isFinite(baseGw) || baseGw <= 0) return null;
      return needGw / baseGw;
    };

    const tech = (key: PowerMixKey) => {
      const twh = deltaTWh * frac[key];
      const gw = capFromTWh(twh, key);
      const pts =
        data[
          key === "solar"
            ? "ELECTRICITY_GEN_SOLAR"
            : key === "wind"
              ? "ELECTRICITY_GEN_WIND"
              : key === "coal"
                ? "ELECTRICITY_GEN_COAL"
                : "ELECTRICITY_GEN_NUCLEAR"
        ]?.[chaserIso] || [];
      const growth = maxAnnualizedGrowth(pts);
      return {
        share: frac[key],
        twh,
        gw,
        perYear: {
          twh: twh / horizonYears,
          gw: gw / horizonYears,
        },
        equivalents: {
          plants: key === "nuclear" || key === "coal" ? gw : null,
          panels:
            key === "solar"
              ? (gw * 1e9) / clamp(assumptions.panelWatts, 100, 1000)
              : null,
          turbines:
            key === "wind"
              ? (gw * 1000) / clamp(assumptions.windTurbineMw, 0.5, 20)
              : null,
        },
        multiplier: {
          capacityX: ratio(gw, effectiveBaseCap[key]),
          generationX:
            observedElectricity?.bySourceTWh[key] != null && observedElectricity.bySourceTWh[key]! > 0
              ? twh / observedElectricity.bySourceTWh[key]!
              : null,
        },
        pace: {
          max5yTwhPerYear: growth.max5y,
          paceX:
            growth.max5y != null && growth.max5y > 0
              ? (twh / horizonYears) / growth.max5y
              : null,
        },
      };
    };

    const out: Record<PowerMixKey, ReturnType<typeof tech>> = {
      solar: tech("solar"),
      wind: tech("wind"),
      nuclear: tech("nuclear"),
      coal: tech("coal"),
    };

    const normalizedPct = (x: number) => Math.round(x * 100);

    return {
      deltaTWh,
      sum,
      fractions: frac,
      percent: {
        solar: normalizedPct(frac.solar),
        wind: normalizedPct(frac.wind),
        nuclear: normalizedPct(frac.nuclear),
        coal: normalizedPct(frac.coal),
      },
      tech: out,
      baselineKind:
        (baseCap.solar != null && baseCap.solar > 0) ||
        (baseCap.wind != null && baseCap.wind > 0) ||
        (baseCap.coal != null && baseCap.coal > 0) ||
        (baseCap.nuclear != null && baseCap.nuclear > 0)
          ? ("reported" as const)
          : ("inferred" as const),
      assumptions: {
        ...cf,
        panelWatts: clamp(assumptions.panelWatts, 100, 1000),
        windTurbineMw: clamp(assumptions.windTurbineMw, 0.5, 20),
      },
    };
  }, [assumptions, chaserIso, data, horizonYears, macro.electricity.equivalents?.deltaTWh, mix, observedElectricity]);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Implications (template path)
          </h3>
          <p className="text-[11px] text-ink-faint mt-1">
            Rough estimates derived from how GDP per capita relates to each metric in the template.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
          {TEMPLATE_PATHS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplateChange(t.id)}
              aria-pressed={template === t.id}
              className={[
                "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
                template === t.id
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-muted" htmlFor="imp-years">
            Horizon
          </label>
          <input
            id="imp-years"
            type="number"
            min={1}
            max={150}
            step={1}
            value={horizonYears}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onHorizonYearsChange(Math.max(1, Math.min(150, Math.round(next))));
            }}
            className="w-20 px-2 py-1 rounded-md bg-surface border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <span className="text-[11px] text-ink-faint">({year})</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setPopAssumption("trend")}
            aria-pressed={popAssumption === "trend"}
            className={[
              "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
              popAssumption === "trend"
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-raised/60",
            ].join(" ")}
          >
            Pop trend
          </button>
          <button
            type="button"
            onClick={() => setPopAssumption("static")}
            aria-pressed={popAssumption === "static"}
            className={[
              "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
              popAssumption === "static"
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-raised/60",
            ].join(" ")}
          >
            Pop static
          </button>
        </div>
        {popAssumption === "trend" && (
          <div className="text-[11px] text-ink-faint">
            {popTrendRate >= 0 ? "+" : ""}
            {(popTrendRate * 100).toFixed(2)}%/yr
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
          {IMPLICATION_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setScenario(s.id);
                if (s.presets?.horizonYears != null) onHorizonYearsChange(s.presets.horizonYears);
                if (s.presets?.gridLossPct != null || s.presets?.netImportsPct != null) {
                  setAssumptions((a) => ({
                    ...a,
                    gridLossPct: s.presets?.gridLossPct ?? a.gridLossPct,
                    netImportsPct: s.presets?.netImportsPct ?? a.netImportsPct,
                  }));
                }
              }}
              aria-pressed={scenario === s.id}
              className={[
                "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
                scenario === s.id
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:bg-surface-raised/60",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-ink-faint">{scenarioDef.blurb}</div>
      </div>

      <div className="mt-3 text-[11px] text-ink-faint">
        {chaserName} GDP/cap path: {formatMetricValue(gdpCurrent, "int$")} →{" "}
        {formatMetricValue(gdpFuture, "int$")}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Totals assume {popLabel}
        {popCurrent != null && (
          <>
            {" · "}
            Pop {formatNumber(Math.round(popCurrent))} →{" "}
            {popFuture != null ? formatNumber(Math.round(popFuture)) : "—"}
          </>
        )}
      </div>

      {!loading && !error && hasAny && (
        <div className="mt-3 space-y-2">
          {(macro.gdpTotalCurrent || macro.gdpTotalFuture) && (
            <div className="rounded-lg border border-surface bg-surface-raised px-3 py-2">
              <div className="text-xs font-medium text-ink">Macro totals</div>
              <div className="mt-1 text-[11px] text-ink-faint">
                GDP (total) {macro.gdpTotalCurrent ? formatTotal(macro.gdpTotalCurrent) : "—"}{" "}
                <span className="mx-1">→</span>
                {macro.gdpTotalFuture ? formatTotal(macro.gdpTotalFuture) : "—"}
              </div>
            </div>
          )}

          {(macro.electricity.demandCurrentTWh != null || macro.electricity.demandFutureTWh != null) && (
            <div className="rounded-lg border border-surface bg-surface-raised px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs font-medium text-ink">Electricity buildout</div>
                <div className="text-[11px] text-ink-faint shrink-0">
                  Losses {Math.round(macro.electricity.assumptions.gridLossPct)}% · Net imports{" "}
                  {Math.round(macro.electricity.assumptions.netImportsPct)}%
                  {macro.electricity.equivalents?.assumptions && (
                    <>
                      {" · "}CF: nuclear{" "}
                      {Math.round(macro.electricity.equivalents.assumptions.nuclearCf * 100)}% · coal{" "}
                      {Math.round(macro.electricity.equivalents.assumptions.coalCf * 100)}% · solar{" "}
                      {Math.round(macro.electricity.equivalents.assumptions.solarCf * 100)}% · wind{" "}
                      {Math.round(macro.electricity.equivalents.assumptions.windCf * 100)}%
                    </>
                  )}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-ink-faint">
                Demand (WB){" "}
                {macro.electricity.demandCurrentTWh != null
                  ? formatTotal({ unit: "TWh", value: macro.electricity.demandCurrentTWh })
                  : "—"}
                <span className="mx-1">→</span>
                {macro.electricity.demandFutureTWh != null
                  ? formatTotal({ unit: "TWh", value: macro.electricity.demandFutureTWh })
                  : "—"}
                {macro.electricity.demandDeltaTWh != null && (
                  <>
                    {" "}
                    (<span className="font-medium text-ink">
                      {formatSignedTotal({ unit: "TWh", value: macro.electricity.demandDeltaTWh })}
                    </span>
                    )
                  </>
                )}
              </div>
              {macro.electricity.requiredDomesticGenerationFutureTWh != null && (
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  Required domestic generation (to meet demand):{" "}
                  <span className="font-medium text-ink">
                    {formatTotal({ unit: "TWh", value: macro.electricity.requiredDomesticGenerationFutureTWh })}
                  </span>{" "}
                  {macro.electricity.buildoutDeltaTWh != null && (
                    <>
                      {" · "}Buildout vs observed{" "}
                      <span className="font-medium text-ink">
                        {formatSignedTotal({ unit: "TWh", value: macro.electricity.buildoutDeltaTWh })}
                      </span>
                    </>
                  )}
                </div>
              )}
              {observedElectricity && (
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  Observed generation mix{" "}
                  <span className="font-medium text-ink">
                    {formatTotal({ unit: "TWh", value: observedElectricity.totalTWh })}
                  </span>{" "}
                  ({observedElectricity.year}
                  {observedElectricity.totalSourceVintage
                    ? ` · ${formatSourceVintage(observedElectricity.totalSourceVintage)}`
                    : ""}) ·
                  Solar{" "}
                  {observedElectricity.shares.solar != null ? `${observedElectricity.shares.solar.toFixed(0)}%` : "—"} ·
                  Wind{" "}
                  {observedElectricity.shares.wind != null ? `${observedElectricity.shares.wind.toFixed(0)}%` : "—"} ·
                  Coal{" "}
                  {observedElectricity.shares.coal != null ? `${observedElectricity.shares.coal.toFixed(0)}%` : "—"} ·
                  Nuclear{" "}
                  {observedElectricity.shares.nuclear != null
                    ? `${observedElectricity.shares.nuclear.toFixed(0)}%`
                    : "—"}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-surface bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMixMode(false)}
                    aria-pressed={!mixMode}
                    className={[
                      "px-2.5 py-1 text-xs font-medium transition-default focus-ring",
                      !mixMode
                        ? "bg-surface-raised text-ink shadow-sm"
                        : "text-ink-muted hover:bg-surface-raised/60",
                    ].join(" ")}
                  >
                    Compare
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixMode(true)}
                    aria-pressed={mixMode}
                    disabled={!mixBuildout}
                    className={[
                      "px-2.5 py-1 text-xs font-medium transition-default focus-ring disabled:opacity-50",
                      mixMode
                        ? "bg-surface-raised text-ink shadow-sm"
                        : "text-ink-muted hover:bg-surface-raised/60",
                    ].join(" ")}
                  >
                    Mix
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAssumptions((v) => !v)}
                  className="text-[11px] text-ink-muted hover:text-ink transition-default focus-ring px-2 py-1 rounded-md hover:bg-surface"
                >
                  Assumptions
                </button>
              </div>

              {showAssumptions && (
                <div className="mt-2 rounded-lg border border-surface bg-surface px-3 py-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <AssumptionField
                      label="Solar CF"
                      value={assumptions.solarCf * 100}
                      unit="%"
                      step={1}
                      min={5}
                      max={50}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, solarCf: clamp(next / 100, 0.01, 1) }))
                      }
                    />
                    <AssumptionField
                      label="Wind CF"
                      value={assumptions.windCf * 100}
                      unit="%"
                      step={1}
                      min={5}
                      max={70}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, windCf: clamp(next / 100, 0.01, 1) }))
                      }
                    />
                    <AssumptionField
                      label="Nuclear CF"
                      value={assumptions.nuclearCf * 100}
                      unit="%"
                      step={1}
                      min={5}
                      max={98}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, nuclearCf: clamp(next / 100, 0.01, 1) }))
                      }
                    />
                    <AssumptionField
                      label="Coal CF"
                      value={assumptions.coalCf * 100}
                      unit="%"
                      step={1}
                      min={5}
                      max={95}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, coalCf: clamp(next / 100, 0.01, 1) }))
                      }
                    />
                    <AssumptionField
                      label="Panel size"
                      value={assumptions.panelWatts}
                      unit="W"
                      step={10}
                      min={100}
                      max={1000}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, panelWatts: clamp(next, 100, 1000) }))
                      }
                    />
                    <AssumptionField
                      label="Turbine size"
                      value={assumptions.windTurbineMw}
                      unit="MW"
                      step={0.5}
                      min={0.5}
                      max={20}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, windTurbineMw: clamp(next, 0.5, 20) }))
                      }
                    />
                    <AssumptionField
                      label="People/home"
                      value={assumptions.householdSize}
                      unit=""
                      step={0.1}
                      min={1}
                      max={10}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, householdSize: clamp(next, 1, 10) }))
                      }
                    />
                    <AssumptionField
                      label="Grid losses"
                      value={assumptions.gridLossPct}
                      unit="%"
                      step={1}
                      min={0}
                      max={50}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, gridLossPct: clamp(next, 0, 50) }))
                      }
                    />
                    <AssumptionField
                      label="Net imports"
                      value={assumptions.netImportsPct}
                      unit="%"
                      step={1}
                      min={-50}
                      max={50}
                      onChange={(next) =>
                        setAssumptions((a) => ({ ...a, netImportsPct: clamp(next, -50, 50) }))
                      }
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
                        className="w-full px-2 py-1 rounded-md border border-surface bg-surface-raised text-xs font-medium text-ink hover:bg-surface transition-default focus-ring"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!mixMode && baselineMultipliers && (
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  Buildout vs today (
                  {baselineMultipliers.kind === "reported"
                    ? "reported installed GW (IRENA/Ember solar+wind; inferred otherwise)"
                    : "estimated GW from TWh & CF"}
                  , {baselineMultipliers.year}): Solar{" "}
                  {baselineMultipliers.ratio.solar != null ? `${baselineMultipliers.ratio.solar.toFixed(1)}×` : "—"} ·
                  Wind {baselineMultipliers.ratio.wind != null ? `${baselineMultipliers.ratio.wind.toFixed(1)}×` : "—"} ·
                  Coal {baselineMultipliers.ratio.coal != null ? `${baselineMultipliers.ratio.coal.toFixed(1)}×` : "—"} ·
                  Nuclear{" "}
                  {baselineMultipliers.ratio.nuclear != null ? `${baselineMultipliers.ratio.nuclear.toFixed(1)}×` : "—"}
                </div>
              )}
              {macro.electricity.equivalents?.deltaAvgGW != null && !mixMode && (
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  Average load{" "}
                  <span className="font-medium text-ink">
                    {formatSignedNumber(macro.electricity.equivalents.deltaAvgGW, "GW")}
                  </span>{" "}
                  (GWavg)
                </div>
              )}
              {macro.electricity.equivalents && !mixMode && (
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-4 gap-1 text-[11px] text-ink-faint">
                  <div>
                    Nuclear:{" "}
                    <span className="font-medium text-ink">
                      {formatUnitCount(macro.electricity.equivalents.nuclear.plants)}
                    </span>{" "}
                    1-GW plants ({formatUnitCount(macro.electricity.equivalents.nuclear.plants / horizonYears)}/yr)
                  </div>
                  <div>
                    Coal:{" "}
                    <span className="font-medium text-ink">
                      {formatUnitCount(macro.electricity.equivalents.coal.plants)}
                    </span>{" "}
                    1-GW plants ({formatUnitCount(macro.electricity.equivalents.coal.plants / horizonYears)}/yr)
                  </div>
                  <div>
                    Solar:{" "}
                    <span className="font-medium text-ink">
                      {formatUnitCount(macro.electricity.equivalents.solar.gw)}
                    </span>{" "}
                    GW ({formatUnitCount(macro.electricity.equivalents.solar.gw / horizonYears)} GW/yr)
                    {macro.electricity.equivalents.solar.panels != null && (
                      <>
                        {" "}
                        (<span className="font-medium text-ink">
                          {formatUnitCount(macro.electricity.equivalents.solar.panels)}
                        </span>{" "}
                        panels)
                      </>
                    )}
                  </div>
                  <div>
                    Wind:{" "}
                    <span className="font-medium text-ink">
                      {formatUnitCount(macro.electricity.equivalents.wind.gw)}
                    </span>{" "}
                    GW ({formatUnitCount(macro.electricity.equivalents.wind.gw / horizonYears)} GW/yr)
                    {macro.electricity.equivalents.wind.turbines != null && (
                      <>
                        {" "}
                        (<span className="font-medium text-ink">
                          {formatUnitCount(macro.electricity.equivalents.wind.turbines)}
                        </span>{" "}
                        turbines)
                      </>
                    )}
                  </div>
                </div>
              )}

              {mixMode && mixBuildout && (
                <div className="mt-2">
                  <div className="h-2 rounded-full overflow-hidden bg-surface flex">
                    <div
                      className="bg-amber-400"
                      style={{ width: `${mixBuildout.percent.solar}%` }}
                      aria-label={`Solar ${mixBuildout.percent.solar}%`}
                    />
                    <div
                      className="bg-sky-400"
                      style={{ width: `${mixBuildout.percent.wind}%` }}
                      aria-label={`Wind ${mixBuildout.percent.wind}%`}
                    />
                    <div
                      className="bg-violet-400"
                      style={{ width: `${mixBuildout.percent.nuclear}%` }}
                      aria-label={`Nuclear ${mixBuildout.percent.nuclear}%`}
                    />
                    <div
                      className="bg-slate-400"
                      style={{ width: `${mixBuildout.percent.coal}%` }}
                      aria-label={`Coal ${mixBuildout.percent.coal}%`}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MixField
                      label="Solar"
                      value={mix.solar}
                      color="bg-amber-400"
                      onChange={(v) => setMix((m) => ({ ...m, solar: v }))}
                    />
                    <MixField
                      label="Wind"
                      value={mix.wind}
                      color="bg-sky-400"
                      onChange={(v) => setMix((m) => ({ ...m, wind: v }))}
                    />
                    <MixField
                      label="Nuclear"
                      value={mix.nuclear}
                      color="bg-violet-400"
                      onChange={(v) => setMix((m) => ({ ...m, nuclear: v }))}
                    />
                    <MixField
                      label="Coal"
                      value={mix.coal}
                      color="bg-slate-400"
                      onChange={(v) => setMix((m) => ({ ...m, coal: v }))}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {MIX_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setMix(p.mix)}
                        className="px-2 py-1 rounded-md border border-surface bg-surface text-[11px] text-ink-muted hover:text-ink hover:bg-surface-raised transition-default focus-ring"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 text-[11px] text-ink-faint">
                    Baseline:{" "}
                    {mixBuildout.baselineKind === "reported"
                      ? "reported installed GW (IRENA/Ember solar+wind; inferred otherwise)"
                      : "estimated from observed generation + CF"}
                    {" · "}
                    Mix is normalized from inputs (sum {mixBuildout.sum.toFixed(0)}).
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <MixResultCard
                      title="Solar"
                      color="bg-amber-400"
                      twh={mixBuildout.tech.solar.twh}
                      gw={mixBuildout.tech.solar.gw}
                      perYearGw={mixBuildout.tech.solar.perYear.gw}
                      perYearTwh={mixBuildout.tech.solar.perYear.twh}
                      equivalentLabel="panels"
                      equivalentCount={mixBuildout.tech.solar.equivalents.panels}
                      capacityX={mixBuildout.tech.solar.multiplier.capacityX}
                      generationX={mixBuildout.tech.solar.multiplier.generationX}
                      paceX={mixBuildout.tech.solar.pace.paceX}
                      paceBenchmarkTwhPerYear={mixBuildout.tech.solar.pace.max5yTwhPerYear}
                    />
                    <MixResultCard
                      title="Wind"
                      color="bg-sky-400"
                      twh={mixBuildout.tech.wind.twh}
                      gw={mixBuildout.tech.wind.gw}
                      perYearGw={mixBuildout.tech.wind.perYear.gw}
                      perYearTwh={mixBuildout.tech.wind.perYear.twh}
                      equivalentLabel="turbines"
                      equivalentCount={mixBuildout.tech.wind.equivalents.turbines}
                      capacityX={mixBuildout.tech.wind.multiplier.capacityX}
                      generationX={mixBuildout.tech.wind.multiplier.generationX}
                      paceX={mixBuildout.tech.wind.pace.paceX}
                      paceBenchmarkTwhPerYear={mixBuildout.tech.wind.pace.max5yTwhPerYear}
                    />
                    <MixResultCard
                      title="Nuclear"
                      color="bg-violet-400"
                      twh={mixBuildout.tech.nuclear.twh}
                      gw={mixBuildout.tech.nuclear.gw}
                      perYearGw={mixBuildout.tech.nuclear.perYear.gw}
                      perYearTwh={mixBuildout.tech.nuclear.perYear.twh}
                      equivalentLabel="1‑GW plants"
                      equivalentCount={mixBuildout.tech.nuclear.equivalents.plants}
                      capacityX={mixBuildout.tech.nuclear.multiplier.capacityX}
                      generationX={mixBuildout.tech.nuclear.multiplier.generationX}
                      paceX={mixBuildout.tech.nuclear.pace.paceX}
                      paceBenchmarkTwhPerYear={mixBuildout.tech.nuclear.pace.max5yTwhPerYear}
                    />
                    <MixResultCard
                      title="Coal"
                      color="bg-slate-400"
                      twh={mixBuildout.tech.coal.twh}
                      gw={mixBuildout.tech.coal.gw}
                      perYearGw={mixBuildout.tech.coal.perYear.gw}
                      perYearTwh={mixBuildout.tech.coal.perYear.twh}
                      equivalentLabel="1‑GW plants"
                      equivalentCount={mixBuildout.tech.coal.equivalents.plants}
                      capacityX={mixBuildout.tech.coal.multiplier.capacityX}
                      generationX={mixBuildout.tech.coal.multiplier.generationX}
                      paceX={mixBuildout.tech.coal.pace.paceX}
                      paceBenchmarkTwhPerYear={mixBuildout.tech.coal.pace.max5yTwhPerYear}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {(macro.urban.currentPersons != null || macro.urban.futurePersons != null) && (
            <div className="rounded-lg border border-surface bg-surface-raised px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-ink">Urbanization buildout</div>
                <div className="text-[11px] text-ink-faint">Uses people/home in assumptions</div>
              </div>
              <div className="mt-1 text-[11px] text-ink-faint">
                Urban residents{" "}
                {macro.urban.currentPersons != null
                  ? formatTotal({ unit: "persons", value: macro.urban.currentPersons })
                  : "—"}
                <span className="mx-1">→</span>
                {macro.urban.futurePersons != null
                  ? formatTotal({ unit: "persons", value: macro.urban.futurePersons })
                  : "—"}
                {macro.urban.deltaPersons != null && (
                  <>
                    {" "}
                    (<span className="font-medium text-ink">
                      {formatSignedTotal({ unit: "persons", value: macro.urban.deltaPersons })}
                    </span>
                    )
                  </>
                )}
              </div>
              {macro.urban.homesNeeded != null && (
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  Homes (rough):{" "}
                  <span className="font-medium text-ink">
                    {formatUnitCount(macro.urban.homesNeeded)}
                  </span>{" "}
                  total (
                  <span className="font-medium text-ink">
                    {formatUnitCount(macro.urban.homesNeeded / horizonYears)}
                  </span>
                  /yr)
                </div>
              )}
            </div>
          )}

          {(macro.co2.currentMt != null || macro.co2.futureMt != null) && (
            <div className="rounded-lg border border-surface bg-surface-raised px-3 py-2">
              <div className="text-xs font-medium text-ink">CO₂ (territorial)</div>
              <div className="mt-1 text-[11px] text-ink-faint">
                Total{" "}
                {macro.co2.currentMt != null
                  ? formatTotal({ unit: "MtCO2", value: macro.co2.currentMt })
                  : "—"}
                <span className="mx-1">→</span>
                {macro.co2.futureMt != null
                  ? formatTotal({ unit: "MtCO2", value: macro.co2.futureMt })
                  : "—"}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-3 text-sm text-ink-muted">Loading implications…</div>
      )}
      {error && (
        <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          Could not load implications data ({error})
        </div>
      )}

      {!loading && !error && !hasAny && (
        <div className="mt-3 text-sm text-ink-muted">
          Not enough data for these metrics yet. Import more World Bank series to enable estimates.
        </div>
      )}

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.code} className="rounded-lg border border-surface bg-surface-raised px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink truncate">
                  {r.indicator?.name || r.code}
                </div>
                {r.indicator?.unit && (
                  <div className="text-[11px] text-ink-faint truncate">{r.indicator.unit}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-muted">
                  {r.current == null || r.indicator == null
                    ? "—"
                    : formatMetricValue(r.current, r.indicator.unit)}
                  <span className="mx-1 text-ink-faint">→</span>
                  {r.implied == null || r.indicator == null
                    ? "—"
                    : formatMetricValue(r.implied, r.indicator.unit)}
                </div>
                {r.deltaLabel && (
                  <div className="text-[11px] text-ink-faint">{r.deltaLabel}</div>
                )}
                {(r.currentTotal || r.impliedTotal) && (
                  <div className="text-[11px] text-ink-faint mt-0.5">
                    Total{" "}
                    {r.currentTotal ? formatTotal(r.currentTotal) : "—"}
                    <span className="mx-1">→</span>
                    {r.impliedTotal ? formatTotal(r.impliedTotal) : "—"}
                  </div>
                )}
              </div>
            </div>
            {r.note && <div className="mt-1 text-[11px] text-ink-faint">{r.note}</div>}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        Estimates vary widely by policy, technology, and economic structure; treat as “what-if” context, not a forecast.
      </p>
    </div>
  );
}

function formatTotal(t: { unit: string; value: number }) {
  if (!Number.isFinite(t.value)) return "—";
  if (t.unit === "persons") return formatNumber(t.value);
  if (t.unit === "toe") return `${formatNumber(t.value)} toe`;
  if (t.unit === "TWh") return `${t.value.toFixed(t.value >= 10 ? 0 : 1)} TWh`;
  if (t.unit === "MtCO2") return `${t.value.toFixed(t.value >= 10 ? 0 : 1)} MtCO₂`;
  if (t.unit === "int$") return `$${formatNumber(t.value)}`;
  return `${formatNumber(t.value)} ${t.unit}`;
}

function formatSignedTotal(t: { unit: string; value: number }) {
  if (!Number.isFinite(t.value)) return "—";
  const sign = t.value > 0 ? "+" : t.value < 0 ? "−" : "";
  const abs = Math.abs(t.value);
  if (t.unit === "TWh") return `${sign}${abs.toFixed(abs >= 10 ? 0 : 1)} TWh`;
  if (t.unit === "MtCO2") return `${sign}${abs.toFixed(abs >= 10 ? 0 : 1)} MtCO₂`;
  if (t.unit === "int$") return `${sign}$${formatNumber(abs)}`;
  if (t.unit === "persons") return `${sign}${formatNumber(abs)}`;
  return `${sign}${formatNumber(abs)} ${t.unit}`;
}

function formatUnitCount(value: number) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (abs < 1) return `${sign}<1`;
  if (abs < 10) return `${sign}${abs.toFixed(1).replace(/\\.0$/, "")}`;
  return `${sign}${formatNumber(Math.round(abs))}`;
}

function formatSignedNumber(value: number, unit: string) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const rounded = abs >= 10 ? Math.round(abs) : abs >= 1 ? abs.toFixed(1).replace(/\\.0$/, "") : abs.toFixed(2);
  return `${sign}${rounded} ${unit}`;
}

function formatMultiplier(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 0.1) return "<0.1×";
  if (value < 10) return `${value.toFixed(1)}×`;
  if (value < 100) return `${Math.round(value)}×`;
  return `${formatNumber(Math.round(value))}×`;
}

function formatSourceVintage(vintage: string) {
  const v = vintage.trim();
  if (!v) return "—";
  const [kindRaw, suffixRaw] = v.split("@");
  const kind = (kindRaw || "").trim().toLowerCase();
  const suffix = (suffixRaw || "").trim();

  if (kind.includes("ember-electricity-generation")) return suffix ? `Ember gen ${suffix}` : "Ember gen";
  if (kind.includes("ember-installed-capacity")) return suffix ? `Ember cap ${suffix}` : "Ember cap";
  if (kind.includes("owid-energy-data")) return suffix ? `OWID energy ${suffix}` : "OWID energy";
  if (kind.includes("owid-co2-data")) return suffix ? `OWID CO₂ ${suffix}` : "OWID CO₂";

  return v.length > 40 ? `${v.slice(0, 37)}…` : v;
}

function AssumptionField(props: {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { label, value, unit, step, min, max, onChange } = props;
  return (
    <label className="block">
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(clamp(next, min, max));
          }}
          className="w-full px-2 py-1 rounded-md bg-surface-raised border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        {unit && <span className="text-[11px] text-ink-faint shrink-0">{unit}</span>}
      </div>
    </label>
  );
}

function MixField(props: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  const { label, value, color, onChange } = props;
  return (
    <label className="block rounded-lg border border-surface bg-surface px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
          <span className="text-[11px] text-ink truncate">{label}</span>
        </div>
        <input
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.max(0, next));
          }}
          className="w-16 px-2 py-1 rounded-md bg-surface-raised border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-label={`${label} percent`}
        />
        <span className="text-[11px] text-ink-faint">%</span>
      </div>
    </label>
  );
}

function MixResultCard(props: {
  title: string;
  color: string;
  twh: number;
  gw: number;
  perYearTwh: number;
  perYearGw: number;
  equivalentLabel: string;
  equivalentCount: number | null;
  capacityX: number | null;
  generationX: number | null;
  paceBenchmarkTwhPerYear: number | null;
  paceX: number | null;
}) {
  const {
    title,
    color,
    twh,
    gw,
    perYearTwh,
    perYearGw,
    equivalentLabel,
    equivalentCount,
    capacityX,
    generationX,
    paceBenchmarkTwhPerYear,
    paceX,
  } = props;

  return (
    <div className="rounded-lg border border-surface bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
          <div className="text-xs font-medium text-ink truncate">{title}</div>
        </div>
        <div className="text-[11px] text-ink-faint shrink-0">
          {formatTotal({ unit: "TWh", value: twh })} · {formatUnitCount(gw)} GW
        </div>
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Rate: {formatTotal({ unit: "TWh", value: perYearTwh })}/yr · {formatUnitCount(perYearGw)} GW/yr
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        Equivalent:{" "}
        <span className="font-medium text-ink">
          {equivalentCount != null ? formatUnitCount(equivalentCount) : "—"}
        </span>{" "}
        {equivalentLabel}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">
        vs today: capacity {formatMultiplier(capacityX)} · generation {formatMultiplier(generationX)}
      </div>
      {(paceBenchmarkTwhPerYear != null || paceX != null) && (
        <div className="mt-1 text-[11px] text-ink-faint">
          Pace: {formatTotal({ unit: "TWh", value: perYearTwh })}/yr vs best 5y avg{" "}
          {paceBenchmarkTwhPerYear != null ? formatTotal({ unit: "TWh", value: paceBenchmarkTwhPerYear }) : "—"}/yr (
          {formatMultiplier(paceX)})
        </div>
      )}
    </div>
  );
}
