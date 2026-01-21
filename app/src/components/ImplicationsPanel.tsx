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

type PopAssumption = "trend" | "static";

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
    () => ["GDP_PCAP_PPP", "POPULATION", ...IMPLICATION_METRIC_CODES],
    []
  );

  const { data, indicatorByCode, loading, error, getLatestValue } = useBatchData({
    countries,
    indicators,
    startYear: 1990,
    enabled,
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
  const [householdSize, setHouseholdSize] = useState(4);

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

      const current = chaserCurrentMetric;
      const totals = computeTotals({
        code: metric.code,
        currentMetric: current,
        impliedMetric: implied,
        popCurrent,
        popFuture,
        gdpPcapCurrent: gdpCurrent,
        gdpPcapFuture: gdpFuture,
      });

      const isPercent = (indicator?.unit || "").toLowerCase().includes("percent");
      const deltaLabel =
        implied == null || current == null
          ? null
          : isPercent
            ? `${implied >= current ? "+" : ""}${(implied - current).toFixed(1)}pp`
            : current !== 0
              ? `${implied >= current ? "+" : ""}${(((implied - current) / current) * 100).toFixed(0)}%`
              : null;

      const noteParts: string[] = [];
      if (implied != null && current == null) {
        noteParts.push("Using template level (no current local baseline).");
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
        implied,
        deltaLabel,
        note,
        currentTotal: totals.currentTotal,
        impliedTotal: totals.impliedTotal,
      });
    }

    return out;
  }, [chaserIso, data, gdpByIso, gdpCurrent, gdpFuture, getLatestValue, indicatorByCode, popCurrent, popFuture, templateDef.iso3]);

  const hasAny = rows.some((r) => r.implied != null);

  const popLabel = popAssumption === "trend" ? "Population: 10y trend" : "Population: static";

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
    const electricityCurrentTWh =
      electricityRow?.currentTotal?.unit === "TWh" ? electricityRow.currentTotal.value : null;
    const electricityFutureTWh =
      electricityRow?.impliedTotal?.unit === "TWh" ? electricityRow.impliedTotal.value : null;
    const electricityDeltaTWh =
      electricityCurrentTWh != null && electricityFutureTWh != null
        ? electricityFutureTWh - electricityCurrentTWh
        : null;

    const avgGWFromTWhPerYear = (twh: number) => (twh * 1000) / 8760;

    const powerDeltaAvgGW =
      electricityDeltaTWh != null ? avgGWFromTWhPerYear(electricityDeltaTWh) : null;

    const twhPerYearPerGW = (capacityFactor: number) => 8.76 * capacityFactor;
    const gwFromTWhPerYear = (twh: number, capacityFactor: number) =>
      twh / twhPerYearPerGW(capacityFactor);

    const nuclearCf = 0.9;
    const coalCf = 0.6;
    const solarCf = 0.2;
    const windCf = 0.35;
    const panelWatts = 400;
    const windTurbineMw = 3;

    const twhPerPanelPerYear =
      (panelWatts / 1000) * solarCf * 8760 / 1e9; // kW * h => kWh, then -> TWh

    const electricityEquivalents =
      electricityDeltaTWh != null && Number.isFinite(electricityDeltaTWh)
        ? {
            deltaTWh: electricityDeltaTWh,
            deltaAvgGW: powerDeltaAvgGW,
            nuclear: {
              plants: electricityDeltaTWh / twhPerYearPerGW(nuclearCf),
              gw: gwFromTWhPerYear(electricityDeltaTWh, nuclearCf),
            },
            coal: {
              plants: electricityDeltaTWh / twhPerYearPerGW(coalCf),
              gw: gwFromTWhPerYear(electricityDeltaTWh, coalCf),
            },
            solar: {
              gw: gwFromTWhPerYear(electricityDeltaTWh, solarCf),
              panels: twhPerPanelPerYear > 0 ? electricityDeltaTWh / twhPerPanelPerYear : null,
            },
            wind: {
              gw: gwFromTWhPerYear(electricityDeltaTWh, windCf),
              turbines:
                windTurbineMw > 0
                  ? (gwFromTWhPerYear(electricityDeltaTWh, windCf) * 1000) / windTurbineMw
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
      urbanDeltaPersons != null && Number.isFinite(urbanDeltaPersons) && householdSize > 0
        ? urbanDeltaPersons / householdSize
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
        currentTWh: electricityCurrentTWh,
        futureTWh: electricityFutureTWh,
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
  }, [gdpCurrent, gdpFuture, householdSize, popCurrent, popFuture, rows]);

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
            <div className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5">
              <div className="text-xs font-medium text-ink">Macro totals</div>
              <div className="mt-1 text-[11px] text-ink-faint">
                GDP (total) {macro.gdpTotalCurrent ? formatTotal(macro.gdpTotalCurrent) : "—"}{" "}
                <span className="mx-1">→</span>
                {macro.gdpTotalFuture ? formatTotal(macro.gdpTotalFuture) : "—"}
              </div>
            </div>
          )}

          {(macro.electricity.currentTWh != null || macro.electricity.futureTWh != null) && (
            <div className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs font-medium text-ink">Electricity buildout</div>
                {macro.electricity.equivalents?.assumptions && (
                  <div className="text-[11px] text-ink-faint shrink-0">
                    CF: nuclear {Math.round(macro.electricity.equivalents.assumptions.nuclearCf * 100)}% · coal{" "}
                    {Math.round(macro.electricity.equivalents.assumptions.coalCf * 100)}% · solar{" "}
                    {Math.round(macro.electricity.equivalents.assumptions.solarCf * 100)}% · wind{" "}
                    {Math.round(macro.electricity.equivalents.assumptions.windCf * 100)}%
                  </div>
                )}
              </div>
              <div className="mt-1 text-[11px] text-ink-faint">
                Total{" "}
                {macro.electricity.currentTWh != null
                  ? formatTotal({ unit: "TWh", value: macro.electricity.currentTWh })
                  : "—"}
                <span className="mx-1">→</span>
                {macro.electricity.futureTWh != null
                  ? formatTotal({ unit: "TWh", value: macro.electricity.futureTWh })
                  : "—"}
                {macro.electricity.equivalents?.deltaTWh != null && (
                  <>
                    {" "}
                    (<span className="font-medium text-ink">
                      {formatSignedTotal({ unit: "TWh", value: macro.electricity.equivalents.deltaTWh })}
                    </span>
                    )
                  </>
                )}
              </div>
              {macro.electricity.equivalents?.deltaAvgGW != null && (
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  Average load{" "}
                  <span className="font-medium text-ink">
                    {formatSignedNumber(macro.electricity.equivalents.deltaAvgGW, "GW")}
                  </span>{" "}
                  (GWavg)
                </div>
              )}
              {macro.electricity.equivalents && (
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
            </div>
          )}

          {(macro.urban.currentPersons != null || macro.urban.futurePersons != null) && (
            <div className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-ink">Urbanization buildout</div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-ink-faint" htmlFor="imp-hh">
                    ppl/home
                  </label>
                  <input
                    id="imp-hh"
                    type="number"
                    min={1}
                    max={10}
                    step={0.1}
                    value={householdSize}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (!Number.isFinite(next)) return;
                      setHouseholdSize(Math.max(1, Math.min(10, next)));
                    }}
                    className="w-16 px-2 py-1 rounded-md bg-surface border border-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>
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
            <div className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5">
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
          <div key={r.code} className="rounded-lg border border-surface bg-surface-raised px-2.5 py-1.5">
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
