/**
 * Fetch installed capacity from Ember's API (requires API key)
 * and generate SQL for import into D1.
 *
 * Ember API docs: https://api.ember-energy.org/v1/docs
 *
 * This script prints SQL to stdout and progress to stderr.
 *
 * Notes:
 * - Ember installed-capacity is monthly. Our DB is yearly, so we store the latest
 *   available month as a single point for its year.
 * - If no `EMBER_API_KEY` is set, the script emits a comment and exits 0, so it
 *   can be safely included in `pnpm data:fetch`.
 */

import { loadDotEnv } from "./dotenv";

loadDotEnv();

const EMBER_API_KEY = process.env.EMBER_API_KEY || "";
const EMBER_BASE_URL = process.env.EMBER_BASE_URL || "https://api.ember-energy.org/v1";

const DEFAULT_START_DATE = process.env.EMBER_CAPACITY_START_DATE || "2016-01";
const PINNED_DATE = process.env.EMBER_CAPACITY_DATE || "";

// Ember installed-capacity currently exposes wind+solar series (no coal/nuclear series).
// We keep coal/nuclear handled via fallbacks elsewhere in the app.
const SERIES_MAP: Record<string, { code: string; name: string }> = {
  solar: { code: "INSTALLED_CAPACITY_SOLAR_GW", name: "Installed capacity (solar)" },
  wind: { code: "INSTALLED_CAPACITY_WIND_GW", name: "Installed capacity (wind)" },
};

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

function normalizeSeriesName(series: string) {
  return series.trim().toLowerCase();
}

function getDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as Record<string, unknown>).detail;
  return typeof detail === "string" ? detail : null;
}

function tryExtractOptionValues(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const data = obj.data;
  if (Array.isArray(data)) {
    const out: string[] = [];
    for (const item of data) {
      if (typeof item === "string") out.push(item);
      else if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const value =
          (typeof rec.value === "string" && rec.value) ||
          (typeof rec.name === "string" && rec.name) ||
          (typeof rec.label === "string" && rec.label) ||
          (typeof rec.option === "string" && rec.option) ||
          null;
        if (value) out.push(value);
      }
    }
    return out;
  }

  // Some APIs return { options: [...] }.
  const options = obj.options;
  if (Array.isArray(options)) {
    return options.filter((x) => typeof x === "string") as string[];
  }

  return [];
}

function maxDateYYYYMM(values: string[]) {
  const valid = values
    .map((x) => x.trim())
    .filter((x) => /^\d{4}-\d{2}$/.test(x))
    .sort();
  return valid.length ? valid[valid.length - 1] : null;
}

function yearFromYYYYMM(month: string) {
  const year = Number.parseInt(month.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function prevYYYYMM(month: string) {
  const [yRaw, mRaw] = month.split("-");
  const y = Number.parseInt(yRaw || "", 10);
  const m = Number.parseInt(mRaw || "", 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const ym = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  if (ym.y < 1900) return null;
  return `${ym.y}-${String(ym.m).padStart(2, "0")}`;
}

function toYYYYMM(value: string) {
  const v = value.trim();
  if (/^\d{4}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

function monthToStartDate(month: string) {
  // Ember installed-capacity appears to accept YYYY-MM-01 (not YYYY-MM).
  return `${month}-01`;
}

async function main() {
  if (!EMBER_API_KEY) {
    console.log("\n-- Ember installed capacity skipped (set EMBER_API_KEY to enable)");
    return;
  }

  // Determine the latest available date unless pinned.
  let targetMonth = toYYYYMM(PINNED_DATE) || toYYYYMM(DEFAULT_START_DATE) || "2016-01";
  if (!PINNED_DATE) {
    try {
      const url = `${EMBER_BASE_URL}/options/installed-capacity/monthly/date?api_key=${encodeURIComponent(EMBER_API_KEY)}`;
      const payload = await fetchJSON<unknown>(url);
      const detail = getDetail(payload);
      if (detail) {
        console.error(`Ember API options error: ${detail}`);
        throw new Error(detail);
      }

      // Ember's options schema isn't stable in OpenAPI; be resilient.
      const asStrings = tryExtractOptionValues(payload);
      const fromExtracted = maxDateYYYYMM(asStrings);
      const fromRegex = maxDateYYYYMM(
        (JSON.stringify(payload).match(/\\d{4}-\\d{2}(?!-)/g) || []).filter((x) => /^\\d{4}-\\d{2}$/.test(x))
      );
      const latest = fromExtracted || fromRegex;

      // Newer Ember options responses include ISO timestamps; derive YYYY-MM from the max range.
      const userMax = (() => {
        if (!payload || typeof payload !== "object") return null;
        const stats = (payload as Record<string, unknown>).stats as Record<string, unknown> | undefined;
        const range = stats?.user_data_range as Record<string, unknown> | undefined;
        const max = typeof range?.max === "string" ? range.max : null;
        return max ? toYYYYMM(max) : null;
      })();

      const month = userMax || latest;
      if (month) targetMonth = month;
      if (!month) {
        console.error(
          `Could not determine latest Ember capacity month from options; using ${DEFAULT_START_DATE}.`
        );
      }
    } catch {
      console.error(
        `Could not load Ember capacity dates; using ${DEFAULT_START_DATE} (set EMBER_CAPACITY_DATE=YYYY-MM to pin).`
      );
      targetMonth = toYYYYMM(DEFAULT_START_DATE) || "2016-01";
    }
  }
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error(`Invalid EMBER_CAPACITY_DATE: "${PINNED_DATE}" (expected YYYY-MM or YYYY-MM-01...)`);
  }

  console.log("\n-- Installed capacity (Ember API)");
  for (const s of Object.values(SERIES_MAP)) {
    console.log(
      `INSERT OR IGNORE INTO indicators (code, name, unit, source, source_code, category)\n` +
        `VALUES ('${escapeSQL(s.code)}', '${escapeSQL(s.name)}', 'GW', 'Ember', ` +
        `'ember-api:installed-capacity/monthly', 'energy');`
    );
  }

  const fetchRows = async (month: string) => {
    const startDate = monthToStartDate(month);
    const qs = new URLSearchParams({
      api_key: EMBER_API_KEY,
      start_date: startDate,
    });
    const url = `${EMBER_BASE_URL}/installed-capacity/monthly?${qs.toString()}`;
    const payload = await fetchJSON<unknown>(url);
    const detail = getDetail(payload);
    if (detail) {
      // Do not hard-fail; keep Ember optional in the pipeline.
      console.error(`Ember API error: ${detail}`);
      return null;
    }
    return payload as {
      data?: Array<{
        entity_code: string;
        date: string;
        series: string;
        capacity_gw: number | null;
      }>;
    };
  };

  let activeMonth = targetMonth;
  let allRows: Array<{
    entity_code: string;
    date: string;
    series: string;
    capacity_gw: number | null;
  }> = [];

  for (let attempt = 0; attempt < 24; attempt++) {
    console.error(`Fetching Ember installed capacity for ${activeMonth}…`);
    const result = await fetchRows(activeMonth);
    if (!result) return;
    allRows = (result.data || []).filter((r) => typeof r.date === "string" && r.date.startsWith(monthToStartDate(activeMonth)));
    if (allRows.length > 0) break;
    const prev = prevYYYYMM(activeMonth);
    if (!prev) break;
    activeMonth = prev;
  }

  console.error(`Got ${allRows.length} installed-capacity rows (month used: ${activeMonth})`);

  const year = yearFromYYYYMM(activeMonth);
  if (!year) throw new Error(`Could not parse year from "${activeMonth}"`);

  const vintage = process.env.EMBER_CAPACITY_VINTAGE || `ember-installed-capacity@${activeMonth}`;

  // Reduce: keep a single solar and wind capacity point per country for the selected month.
  const bestByIsoAndKey = new Map<string, number>();
  for (const row of allRows) {
    const iso = (row.entity_code || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    if (!row.series) continue;
    const cap = row.capacity_gw;
    if (cap == null || !Number.isFinite(cap) || cap < 0) continue;

    const seriesKey = (() => {
      const low = normalizeSeriesName(row.series);
      if (low.includes("wind and solar")) return null; // ambiguous; skip
      if (low.includes("solar")) return "solar";
      if (low.includes("wind")) return "wind";
      return null;
    })();
    if (!seriesKey) continue;

    const key = `${iso}__${seriesKey}`;
    const prev = bestByIsoAndKey.get(key);
    if (prev == null || cap > prev) bestByIsoAndKey.set(key, cap);
  }

  let emitted = 0;
  for (const [key, cap] of bestByIsoAndKey) {
    const [iso, seriesKey] = key.split("__");
    const mapped = SERIES_MAP[seriesKey || ""];
    if (!mapped) continue;

    console.log(
      `INSERT OR REPLACE INTO data_points (country_id, indicator_id, year, value, source_vintage) ` +
        `SELECT c.id, i.id, ${year}, ${cap}, '${escapeSQL(vintage)}' ` +
        `FROM countries c, indicators i ` +
        `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = '${escapeSQL(mapped.code)}';`
    );
    emitted += 1;
  }

  console.error(`Installed-capacity points emitted: ${emitted}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
