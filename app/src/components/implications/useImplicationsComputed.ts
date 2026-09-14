import { useMemo } from "react";
import {
  buildImplicationsSnapshot,
  DEFAULT_IMPLICATION_ASSUMPTIONS,
  type ImplicationsControlsState,
  type ObservedValue,
  type PopulationVariant,
  type PowerMixKey,
  type ImplicationAssumptions as SnapshotAssumptions,
} from "../../lib/implicationsSnapshot";
import {
  buildTemplateMapping,
  estimateFromTemplate,
  IMPLICATION_METRICS,
  type TemplateId,
} from "../../lib/templatePaths";
import type { Indicator } from "../../types";

type TemplateDef = {
  id: TemplateId;
  label: string;
  iso3: string[];
};

import { computeTotals } from "../../lib/implicationsMath";
import {
  applyScenarioToImpliedMetric,
  IMPLICATION_SCENARIOS,
  type ScenarioId,
} from "../../lib/implicationsScenarios";

export type ImplicationAssumptions = SnapshotAssumptions;

export const DEFAULT_ASSUMPTIONS: ImplicationAssumptions = DEFAULT_IMPLICATION_ASSUMPTIONS;

export type MixPreset = { id: string; label: string; mix: Record<PowerMixKey, number> };

export const MIX_PRESETS: MixPreset[] = [
  { id: "clean", label: "Clean (60/30/10)", mix: { solar: 60, wind: 30, nuclear: 10, coal: 0 } },
  {
    id: "renewables",
    label: "Solar+Wind (50/50)",
    mix: { solar: 50, wind: 50, nuclear: 0, coal: 0 },
  },
  { id: "nuclear", label: "All nuclear", mix: { solar: 0, wind: 0, nuclear: 100, coal: 0 } },
  { id: "coal", label: "All coal", mix: { solar: 0, wind: 0, nuclear: 0, coal: 100 } },
  { id: "balanced", label: "Balanced", mix: { solar: 30, wind: 30, nuclear: 20, coal: 20 } },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function findPoint(
  data: Record<string, Record<string, Array<{ year: number; value: number }>>>,
  code: string,
  iso: string,
  year: number,
) {
  return data[code]?.[iso]?.find((point) => point.year === year) ?? null;
}

interface UseImplicationsComputedOptions {
  chaserIso: string;
  chaserName?: string;
  gdpCurrent: number;
  chaserGrowthRate: number;
  horizonYears: number;
  baseYear: number;
  templateDef: TemplateDef;
  data: Record<string, Record<string, Array<{ year: number; value: number }>>>;
  dataWithVintage: Record<
    string,
    Record<string, Array<{ year: number; value: number; source_vintage?: string | null }>>
  >;
  indicatorByCode: Record<string, Indicator>;
  getLatestValue: (code: string, iso: string) => number | null;
  populationVariant: PopulationVariant;
  scenario: ScenarioId;
  customized?: boolean;
  assumptions: ImplicationAssumptions;
  mix: Record<PowerMixKey, number>;
}

export function useImplicationsComputed({
  chaserIso,
  chaserName = chaserIso,
  gdpCurrent,
  chaserGrowthRate,
  horizonYears,
  baseYear,
  templateDef,
  data,
  dataWithVintage,
  indicatorByCode,
  getLatestValue,
  populationVariant,
  scenario,
  customized = false,
  assumptions,
  mix,
}: UseImplicationsComputedOptions) {
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

  const mediumPopulationCurrentPoint = findPoint(
    data,
    "POPULATION_UN_MEDIUM",
    chaserIso,
    observedBaseYear,
  );
  const populationCode = `POPULATION_UN_${populationVariant.toUpperCase()}`;
  const populationFuturePoint = findPoint(data, populationCode, chaserIso, year);
  const snapshotUnavailable = !mediumPopulationCurrentPoint
    ? {
        code: "population_year_unavailable" as const,
        message: `UN WPP 2024 has no population estimate for ${observedBaseYear}.`,
      }
    : !populationFuturePoint
      ? {
          code: "population_year_unavailable" as const,
          message: `UN WPP 2024 has no ${populationVariant} population scenario for ${year}.`,
        }
      : null;
  const popCurrent = mediumPopulationCurrentPoint?.value ?? null;
  const popFuture = populationFuturePoint?.value ?? null;

  const scenarioDef = useMemo(
    () => IMPLICATION_SCENARIOS.find((s) => s.id === scenario) ?? IMPLICATION_SCENARIOS[0],
    [scenario],
  );

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

      const isPercent = /percent/.test((indicator?.unit || "").toLowerCase());
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
      if (
        scenario !== "baseline" &&
        impliedScenario != null &&
        implied != null &&
        impliedScenario !== implied
      ) {
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
  const popLabel = `Population: UN ${populationVariant} scenario`;

  const observedElectricity = useMemo(() => {
    const valueAtYear = (code: string, yr: number) => {
      const pts = data[code]?.[chaserIso];
      if (!pts || pts.length === 0) return null;
      for (const p of pts) if (p.year === yr) return p.value;
      return null;
    };
    const pointAtYear = (code: string, yr: number) => {
      const pts = dataWithVintage[code]?.[chaserIso];
      if (!pts || pts.length === 0) return null;
      for (const p of pts) if (p.year === yr) return p;
      return null;
    };

    const totalSeries = data["ELECTRICITY_GEN_TOTAL"]?.[chaserIso] || [];
    const sorted = [...totalSeries]
      .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
      .sort((a, b) => b.year - a.year);
    let snapshot: { year: number; total: number } | null = null;
    for (const p of sorted) {
      if (p.value == null || !Number.isFinite(p.value) || p.value <= 0) continue;
      const yr = p.year;
      snapshot = { year: yr, total: p.value };
      break;
    }
    if (!snapshot) return null;

    const { year: snapYear, total } = snapshot;
    const totalPoint = pointAtYear("ELECTRICITY_GEN_TOTAL", snapYear);
    const solarTWh = valueAtYear("ELECTRICITY_GEN_SOLAR", snapYear);
    const windTWh = valueAtYear("ELECTRICITY_GEN_WIND", snapYear);
    const coalTWh = valueAtYear("ELECTRICITY_GEN_COAL", snapYear);
    const nuclearTWh = valueAtYear("ELECTRICITY_GEN_NUCLEAR", snapYear);

    const share = (x: number | null) =>
      x != null && Number.isFinite(x) && x >= 0 ? (x / total) * 100 : null;

    return {
      year: snapYear,
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

  const snapshot = useMemo(() => {
    if (!mediumPopulationCurrentPoint || !populationFuturePoint) return null;
    const indicatorObserved = (
      code: string,
      point: { year: number; value: number; source_vintage?: string | null },
      fallbackUnit: string,
    ): ObservedValue => {
      const indicator = indicatorByCode[code];
      return {
        value: point.value,
        year: point.year,
        unit: indicator?.unit || fallbackUnit,
        source: indicator?.source || "Unknown",
        sourceCode: indicator?.source_code ?? null,
        sourceVintage: "source_vintage" in point ? (point.source_vintage ?? null) : null,
      };
    };
    const latestPoint = (code: string) => {
      const points = dataWithVintage[code]?.[chaserIso] || [];
      return (
        points
          .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.value))
          .toSorted((a, b) => b.year - a.year)[0] ?? null
      );
    };
    const electricityUsePoint = latestPoint("ELECTRICITY_USE_PCAP");
    const populationAtElectricityYear = electricityUsePoint
      ? findPoint(data, "POPULATION_UN_MEDIUM", chaserIso, electricityUsePoint.year)
      : null;
    const electricityRow = rows.find((row) => row.code === "ELECTRICITY_USE_PCAP");
    const generationPoint = observedElectricity
      ? (dataWithVintage["ELECTRICITY_GEN_TOTAL"]?.[chaserIso]?.find(
          (point) => point.year === observedElectricity.year,
        ) ?? null)
      : null;
    const gdpPoint = dataWithVintage["GDP_PCAP_PPP"]?.[chaserIso]?.find(
      (point) => point.year === observedBaseYear,
    ) ?? { year: observedBaseYear, value: gdpCurrent, source_vintage: null };
    const controls: ImplicationsControlsState = {
      template: templateDef.id,
      horizonYears,
      scenario,
      customized,
      populationVariant,
      assumptions,
      mix,
    };
    const sourceRefs = [
      ["GDP_PCAP_PPP", gdpPoint],
      ["POPULATION_UN_MEDIUM", mediumPopulationCurrentPoint],
      [populationCode, populationFuturePoint],
      ["ELECTRICITY_USE_PCAP", electricityUsePoint],
      ["ELECTRICITY_GEN_TOTAL", generationPoint],
    ] as const;

    return buildImplicationsSnapshot({
      country: { iso3: chaserIso, name: chaserName },
      gdpPerCapitaCurrent: {
        ...indicatorObserved("GDP_PCAP_PPP", gdpPoint, "constant PPP int$"),
        value: gdpCurrent,
      },
      gdpPerCapitaGrowthRate: chaserGrowthRate,
      populationCurrent: indicatorObserved(
        "POPULATION_UN_MEDIUM",
        mediumPopulationCurrentPoint,
        "persons",
      ),
      populationFuture: indicatorObserved(populationCode, populationFuturePoint, "persons"),
      electricityUsePerCapitaCurrent: electricityUsePoint
        ? indicatorObserved("ELECTRICITY_USE_PCAP", electricityUsePoint, "kWh/person/year")
        : null,
      populationAtElectricityUseYear: populationAtElectricityYear
        ? indicatorObserved("POPULATION_UN_MEDIUM", populationAtElectricityYear, "persons")
        : null,
      electricityUsePerCapitaFuture: electricityRow?.implied ?? null,
      electricityGenerationCurrent: generationPoint
        ? indicatorObserved("ELECTRICITY_GEN_TOTAL", generationPoint, "TWh/year")
        : null,
      controls,
      provenance: sourceRefs.flatMap(([code, point]) => {
        if (!point) return [];
        const indicator = indicatorByCode[code];
        return [
          {
            indicator: indicator?.name || code,
            source: indicator?.source || "Unknown",
            sourceCode: indicator?.source_code ?? null,
            sourceVintage: "source_vintage" in point ? (point.source_vintage ?? null) : null,
            observedYear: point.year,
          },
        ];
      }),
    });
  }, [
    assumptions,
    chaserGrowthRate,
    chaserIso,
    chaserName,
    dataWithVintage,
    gdpCurrent,
    horizonYears,
    indicatorByCode,
    mediumPopulationCurrentPoint,
    mix,
    observedBaseYear,
    observedElectricity,
    data,
    populationCode,
    populationFuturePoint,
    populationVariant,
    rows,
    scenario,
    customized,
    templateDef.id,
  ]);

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

    const electricity = snapshot?.electricity;
    const demandCurrentTWh = electricity?.endUseDemandCurrentTWh?.value ?? null;
    const demandFutureTWh = electricity?.endUseDemandFutureTWh?.value ?? null;
    const demandDeltaTWh = electricity?.endUseDemandChangeTWh?.value ?? null;
    const requiredDomesticGenerationFutureTWh =
      electricity?.domesticGenerationRequiredFutureTWh?.value ?? null;
    const buildoutDeltaTWh = electricity?.newDomesticGenerationTWh?.value ?? null;
    const demandDeltaAvgGW = demandDeltaTWh == null ? null : (demandDeltaTWh * 1000) / 8760;
    const buildoutDeltaAvgGW = electricity?.newDomesticGenerationAverageGW?.value ?? null;
    const snapshotEquivalents = electricity?.annualEnergyEquivalents;
    const electricityEquivalents = snapshotEquivalents
      ? {
          deltaTWh: buildoutDeltaTWh!,
          deltaAvgGW: buildoutDeltaAvgGW,
          nuclear: {
            plants: snapshotEquivalents.nuclear.referenceUnits,
            gw: snapshotEquivalents.nuclear.installedGW,
          },
          coal: {
            plants: snapshotEquivalents.coal.referenceUnits,
            gw: snapshotEquivalents.coal.installedGW,
          },
          solar: {
            gw: snapshotEquivalents.solar.installedGW,
            panels: snapshotEquivalents.solar.referenceUnits,
          },
          wind: {
            gw: snapshotEquivalents.wind.installedGW,
            turbines: snapshotEquivalents.wind.referenceUnits,
          },
          assumptions: {
            nuclearCf: snapshotEquivalents.nuclear.capacityFactor,
            coalCf: snapshotEquivalents.coal.capacityFactor,
            solarCf: snapshotEquivalents.solar.capacityFactor,
            windCf: snapshotEquivalents.wind.capacityFactor,
            nuclearPlantGw: assumptions.nuclearPlantGw,
            panelWatts: assumptions.panelWatts,
            windTurbineMw: assumptions.windTurbineMw,
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
    const co2CurrentMt = co2Row?.currentTotal?.unit === "MtCO2" ? co2Row.currentTotal.value : null;
    const co2FutureMt = co2Row?.impliedTotal?.unit === "MtCO2" ? co2Row.impliedTotal.value : null;

    return {
      gdpTotalCurrent,
      gdpTotalFuture,
      electricity: {
        demandCurrentTWh,
        demandFutureTWh,
        demandDeltaTWh,
        grossSupplyRequiredFutureTWh: electricity?.grossSupplyRequiredFutureTWh?.value ?? null,
        importsFutureTWh: electricity?.importsFutureTWh?.value ?? null,
        requiredDomesticGenerationFutureTWh,
        buildoutDeltaTWh,
        demandDeltaAvgGW,
        buildoutDeltaAvgGW,
        assumptions: {
          gridLossPct: assumptions.gridLossPct,
          netImportsPct: assumptions.netImportsPct,
        },
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
  }, [assumptions, gdpCurrent, gdpFuture, popCurrent, popFuture, rows, snapshot]);

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

    const inferredSolarGw = gwFromTWh(
      observedElectricity.bySourceTWh.solar,
      eq.assumptions.solarCf,
    );
    const inferredWindGw = gwFromTWh(observedElectricity.bySourceTWh.wind, eq.assumptions.windCf);
    const inferredCoalGw = gwFromTWh(observedElectricity.bySourceTWh.coal, eq.assumptions.coalCf);
    const inferredNuclearGw = gwFromTWh(
      observedElectricity.bySourceTWh.nuclear,
      eq.assumptions.nuclearCf,
    );

    const ratio = (needGw: number, baseGw: number | null) => {
      if (!Number.isFinite(needGw) || needGw <= 0) return null;
      if (baseGw == null || !Number.isFinite(baseGw) || baseGw <= 0) return null;
      return needGw / baseGw;
    };

    const capacityYear = Math.max(
      capSolar?.year ?? -Infinity,
      capWind?.year ?? -Infinity,
      capCoal?.year ?? -Infinity,
      capNuclear?.year ?? -Infinity,
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
        kind === "reported" && Number.isFinite(capacityYear)
          ? capacityYear
          : observedElectricity.year,
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

    const solarCf = cf.solar;
    const windCf = cf.wind;
    const nuclearCf = cf.nuclear;
    const coalCf = cf.coal;
    const nuclearPlantGw = clamp(assumptions.nuclearPlantGw, 0.3, 2);

    const capFromTWh = (twh: number, key: PowerMixKey) => twh / twhPerYearPerGW(cf[key]);

    const maxAnnualizedGrowth = (points: Array<{ year: number; value: number }> | undefined) => {
      if (!points || points.length < 2)
        return { maxYoY: null as number | null, max5y: null as number | null };
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
      nuclear:
        baseCap.nuclear != null && baseCap.nuclear > 0 ? baseCap.nuclear : inferredBaseCap.nuclear,
    };

    const ratioFn = (needGw: number, baseGw: number | null) => {
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
          plants: key === "nuclear" ? gw / nuclearPlantGw : key === "coal" ? gw : null,
          panels: key === "solar" ? (gw * 1e9) / clamp(assumptions.panelWatts, 100, 1000) : null,
          turbines: key === "wind" ? (gw * 1000) / clamp(assumptions.windTurbineMw, 0.5, 20) : null,
        },
        multiplier: {
          capacityX: ratioFn(gw, effectiveBaseCap[key]),
          generationX:
            observedElectricity?.bySourceTWh[key] != null &&
            observedElectricity.bySourceTWh[key]! > 0
              ? twh / observedElectricity.bySourceTWh[key]!
              : null,
        },
        pace: {
          max5yTwhPerYear: growth.max5y,
          paceX:
            growth.max5y != null && growth.max5y > 0 ? twh / horizonYears / growth.max5y : null,
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
        solarCf,
        windCf,
        nuclearCf,
        coalCf,
        nuclearPlantGw,
        panelWatts: clamp(assumptions.panelWatts, 100, 1000),
        windTurbineMw: clamp(assumptions.windTurbineMw, 0.5, 20),
      },
    };
  }, [
    assumptions,
    chaserIso,
    data,
    horizonYears,
    macro.electricity.equivalents?.deltaTWh,
    mix,
    observedElectricity,
  ]);

  return {
    gdpFuture,
    year,
    popCurrent,
    popFuture,
    popLabel,
    scenarioDef,
    rows,
    hasAny,
    observedElectricity,
    macro,
    baselineMultipliers,
    mixBuildout,
    snapshot,
    snapshotUnavailable,
  };
}
