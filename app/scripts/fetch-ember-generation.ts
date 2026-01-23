/**
 * Fetch electricity generation by source (yearly) from Ember's API (requires API key)
 * and generate SQL for import into D1.
 *
 * Ember API docs: https://api.ember-energy.org/v1/docs
 *
 * This script prints SQL to stdout and progress to stderr.
 *
 * Notes:
 * - Our DB is yearly; this importer ingests a single target year (default: latest available).
 * - If no `EMBER_API_KEY` is set, the script emits a comment and exits 0, so it
 *   can be safely included in `pnpm data:fetch`.
 */

import { loadDotEnv } from "./dotenv";

loadDotEnv();

const EMBER_API_KEY = process.env.EMBER_API_KEY || "";
const EMBER_BASE_URL = process.env.EMBER_BASE_URL || "https://api.ember-energy.org/v1";

const PINNED_YEAR = process.env.EMBER_GENERATION_YEAR || "";
const MIN_DEFAULT_YEAR = 2024; // avoid clobbering OWID years by default
const MIN_YEAR = (() => {
  const raw = process.env.EMBER_GENERATION_MIN_YEAR;
  if (!raw) return MIN_DEFAULT_YEAR;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : MIN_DEFAULT_YEAR;
})();

const SERIES: Array<{ emberSeries: string; indicatorCode: string }> = [
  { emberSeries: "Total generation", indicatorCode: "ELECTRICITY_GEN_TOTAL" },
  { emberSeries: "Solar", indicatorCode: "ELECTRICITY_GEN_SOLAR" },
  { emberSeries: "Wind", indicatorCode: "ELECTRICITY_GEN_WIND" },
  { emberSeries: "Coal", indicatorCode: "ELECTRICITY_GEN_COAL" },
  { emberSeries: "Nuclear", indicatorCode: "ELECTRICITY_GEN_NUCLEAR" },
];

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${url}${text ? `\n${text.slice(0, 400)}` : ""}`);
  }
  return res.json();
}

function getDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as Record<string, unknown>).detail;
  return typeof detail === "string" ? detail : null;
}

function tryExtractOptionValues(payload: unknown): Array<string | number> {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const data = obj.data;
  if (Array.isArray(data)) {
    return data.filter((x) => typeof x === "string" || typeof x === "number") as Array<
      string | number
    >;
  }
  const options = obj.options;
  if (Array.isArray(options)) {
    return options.filter((x) => typeof x === "string" || typeof x === "number") as Array<
      string | number
    >;
  }
  return [];
}

function maxYear(values: Array<string | number>) {
  const years = values
    .map((x) => (typeof x === "string" ? parseYearMaybe(x) : x))
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => a - b);
  return years.length ? years[years.length - 1] : null;
}

function parseYearMaybe(value: string) {
  const v = value.trim();
  if (/^\d{4}$/.test(v)) return Number.parseInt(v, 10);
  const m = v.match(/^(\d{4})/);
  return m ? Number.parseInt(m[1] || "", 10) : null;
}

async function main() {
  if (!EMBER_API_KEY) {
    console.log("\n-- Ember electricity generation skipped (set EMBER_API_KEY to enable)");
    return;
  }

  let targetYear: number | null = PINNED_YEAR ? parseYearMaybe(PINNED_YEAR) : null;
  if (!targetYear) {
    try {
      const url = `${EMBER_BASE_URL}/options/electricity-generation/yearly/date?api_key=${encodeURIComponent(EMBER_API_KEY)}`;
      const payload = await fetchJSON<unknown>(url);
      const detail = getDetail(payload);
      if (detail) throw new Error(detail);

      const years = tryExtractOptionValues(payload);
      const fromOptions = maxYear(years);
      const fromStats = (() => {
        if (!payload || typeof payload !== "object") return null;
        const stats = (payload as Record<string, unknown>).stats as Record<string, unknown> | undefined;
        const range = stats?.user_data_range as Record<string, unknown> | undefined;
        const max = range?.max;
        if (typeof max === "number" && Number.isFinite(max)) return max;
        if (typeof max === "string") {
          const parsed = parseYearMaybe(max);
          return parsed && Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })();

      targetYear = fromStats || fromOptions;
    } catch (err) {
      console.error(
        `Could not determine latest Ember generation year; set EMBER_GENERATION_YEAR=YYYY to pin. ${err instanceof Error ? err.message : ""}`.trim()
      );
      targetYear = null;
    }
  }

  if (!targetYear || !Number.isFinite(targetYear)) {
    console.log("\n-- Ember electricity generation skipped (no target year)");
    return;
  }
  if (targetYear < MIN_YEAR) {
    console.log(
      `\n-- Ember electricity generation skipped (target year ${targetYear} < EMBER_GENERATION_MIN_YEAR ${MIN_YEAR})`
    );
    return;
  }

  const vintage =
    process.env.EMBER_GENERATION_VINTAGE || `ember-electricity-generation@${targetYear}`;

  console.log("\n-- Electricity generation by source (Ember API)");
  console.error(`Fetching Ember electricity generation for ${targetYear}…`);

  const qs = new URLSearchParams({
    api_key: EMBER_API_KEY,
    start_date: String(targetYear),
    end_date: String(targetYear),
    is_aggregate_entity: "false",
    series: SERIES.map((s) => s.emberSeries).join(","),
  });
  const url = `${EMBER_BASE_URL}/electricity-generation/yearly?${qs.toString()}`;

  const payload = await fetchJSON<unknown>(url);
  const detail = getDetail(payload);
  if (detail) {
    console.error(`Ember API error: ${detail}`);
    return;
  }

  const rows =
    (payload as {
      data?: Array<{
        entity_code: string | null;
        date: string;
        series: string;
        generation_twh: number | null;
      }>;
    }).data || [];

  const map = new Map<string, string>();
  for (const s of SERIES) map.set(s.emberSeries.trim().toLowerCase(), s.indicatorCode);

  let emitted = 0;
  for (const row of rows) {
    const iso = (row.entity_code || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso)) continue;

    const year = Number.parseInt(row.date || "", 10);
    if (!Number.isFinite(year) || year !== targetYear) continue;

    const indicatorCode = map.get((row.series || "").trim().toLowerCase());
    if (!indicatorCode) continue;

    const value = row.generation_twh;
    if (value == null || !Number.isFinite(value) || value < 0) continue;

    console.log(
      `INSERT OR IGNORE INTO data_points (country_id, indicator_id, year, value, source_vintage) ` +
        `SELECT c.id, i.id, ${year}, ${value}, '${escapeSQL(vintage)}' ` +
        `FROM countries c, indicators i ` +
        `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = '${escapeSQL(indicatorCode)}';`
    );
    emitted += 1;
  }

  console.error(`Electricity-generation points emitted: ${emitted}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
