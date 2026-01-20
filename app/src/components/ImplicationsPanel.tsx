import { useMemo } from "react";
import type { Indicator } from "../types";
import { useBatchData } from "../hooks/useBatchData";
import { formatMetricValue } from "../lib/convergence";
import {
  IMPLICATION_METRICS,
  IMPLICATION_METRIC_CODES,
  TEMPLATE_PATHS,
  type TemplateId,
  buildTemplateMapping,
  estimateFromTemplate,
} from "../lib/templatePaths";

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
  const countries = useMemo(() => [chaserIso, ...templateDef.iso3], [chaserIso, templateDef.iso3]);
  const indicators = useMemo(
    () => ["GDP_PCAP_PPP", ...IMPLICATION_METRIC_CODES],
    []
  );

  const { data, indicatorByCode, loading, error, getLatestValue } = useBatchData({
    countries,
    indicators,
    startYear: 1990,
    enabled,
  });

  const year = baseYear + horizonYears;
  const gdpFuture = gdpCurrent * Math.pow(1 + chaserGrowthRate, horizonYears);

  const gdpByIso = useMemo(() => data["GDP_PCAP_PPP"] || {}, [data]);

  const rows = useMemo(() => {
    const out: Array<{
      indicator: Indicator | null;
      code: string;
      current: number | null;
      implied: number | null;
      deltaLabel: string | null;
      note: string | null;
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

      const isPercent = (indicator?.unit || "").toLowerCase().includes("percent");
      const deltaLabel =
        implied == null || current == null
          ? null
          : isPercent
            ? `${implied >= current ? "+" : ""}${(implied - current).toFixed(1)}pp`
            : current !== 0
              ? `${implied >= current ? "+" : ""}${(((implied - current) / current) * 100).toFixed(0)}%`
              : null;

      const note =
        implied != null && current == null
          ? "Using template level (no current local baseline)."
          : null;

      out.push({
        indicator,
        code: metric.code,
        current,
        implied,
        deltaLabel,
        note,
      });
    }

    return out;
  }, [chaserIso, data, gdpByIso, gdpCurrent, gdpFuture, getLatestValue, indicatorByCode, templateDef.iso3]);

  const hasAny = rows.some((r) => r.implied != null);

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
              className={[
                "px-2.5 py-1 text-xs font-medium transition-default",
                template === t.id
                  ? "bg-surface-raised text-ink"
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

      <div className="mt-3 text-[11px] text-ink-faint">
        {chaserName} GDP/cap path: {formatMetricValue(gdpCurrent, "int$")} →{" "}
        {formatMetricValue(gdpFuture, "int$")}
      </div>

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
