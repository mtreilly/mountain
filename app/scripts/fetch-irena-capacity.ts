/**
 * Fetch installed electricity capacity (solar/wind) from IRENASTAT (PXWeb)
 * and generate SQL for import into D1.
 *
 * Source: https://pxweb.irena.org/pxweb/en/IRENASTAT/
 *
 * Dataset used (default):
 * - Power Capacity and Generation / Country_ELECSTAT_2025_H2_PX.px
 *   "Electricity statistics by Country/area, Technology, Data Type, Grid connection and Year"
 *
 * Notes:
 * - IRENA capacity is in MW; we store GW.
 * - Wind is derived as onshore + offshore.
 */

import { loadDotEnv } from "./dotenv";

loadDotEnv();

const BASE = "https://pxweb.irena.org/api/v1/en/IRENASTAT";
const FOLDER = "Power Capacity and Generation";
const DEFAULT_TABLE = "Country_ELECSTAT_2025_H2_PX.px";
const TABLE = process.env.IRENA_ELECSTAT_TABLE || DEFAULT_TABLE;
const START_YEAR = Number.parseInt(process.env.IRENA_CAPACITY_START_YEAR || "2000", 10);
const END_YEAR = Number.parseInt(process.env.IRENA_CAPACITY_END_YEAR || "2024", 10);

const DEFAULT_VINTAGE_PREFIX = `irena-pxweb:${TABLE}`;

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${url}${text ? `\n${text.slice(0, 400)}` : ""}`);
  }
  return res.json();
}

function isYearInRange(year: number) {
  if (!Number.isFinite(year)) return false;
  if (Number.isFinite(START_YEAR) && year < START_YEAR) return false;
  if (Number.isFinite(END_YEAR) && year > END_YEAR) return false;
  return true;
}

async function resolveUpdatedTimestamp(): Promise<string | null> {
  try {
    const folderUrl = `${BASE}/${encodeURIComponent(FOLDER)}`;
    const list = await fetchJSON<Array<{ id: string; updated?: string }>>(folderUrl);
    const hit = list.find((x) => x.id === TABLE);
    const updated = hit?.updated;
    if (!updated || typeof updated !== "string") return null;
    return updated.slice(0, 10);
  } catch {
    return null;
  }
}

async function main() {
  const updated = await resolveUpdatedTimestamp();
  const vintage =
    process.env.IRENA_CAPACITY_VINTAGE ||
    (updated ? `${DEFAULT_VINTAGE_PREFIX}@${updated}` : `${DEFAULT_VINTAGE_PREFIX}@unknown`);

  const endpoint = `${BASE}/${encodeURIComponent(FOLDER)}/${encodeURIComponent(TABLE)}`;

  console.error(`Fetching IRENA capacity (solar/wind) JSON-stat2…`);
  const payload = {
    query: [
      { code: "Country/area", selection: { filter: "all", values: ["*"] } },
      { code: "Technology", selection: { filter: "item", values: ["1", "3", "4"] } }, // solar PV + wind on/offshore
      { code: "Data Type", selection: { filter: "item", values: ["0"] } }, // installed capacity (MW)
      { code: "Grid connection", selection: { filter: "item", values: ["0"] } }, // all
      { code: "Year", selection: { filter: "all", values: ["*"] } },
    ],
    response: { format: "JSON-stat2" },
  };

  const json = await fetchJSON<{
    id: string[];
    size: number[];
    dimension: Record<
      string,
      {
        label: string;
        category: { index: Record<string, number> | string[]; label: Record<string, string> };
      }
    >;
    value: Array<number | null>;
  }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // We write into existing indicator codes used by the UI.
  console.log("\n-- Installed capacity (solar/wind) (IRENASTAT)");
  console.log(
    `INSERT OR IGNORE INTO indicators (code, name, unit, source, source_code, category)\n` +
      `VALUES ('INSTALLED_CAPACITY_SOLAR_GW', 'Installed capacity (solar)', 'GW', 'IRENA', ` +
      `'irena-pxweb:${escapeSQL(TABLE)}', 'energy');`
  );
  console.log(
    `INSERT OR IGNORE INTO indicators (code, name, unit, source, source_code, category)\n` +
      `VALUES ('INSTALLED_CAPACITY_WIND_GW', 'Installed capacity (wind)', 'GW', 'IRENA', ` +
      `'irena-pxweb:${escapeSQL(TABLE)}', 'energy');`
  );

  const solarByIsoYear = new Map<string, number>();
  const windByIsoYear = new Map<string, number>();

  const dims = json.id || [];
  const sizes = json.size || [];
  if (dims.length === 0 || sizes.length !== dims.length) {
    throw new Error(`Unexpected IRENA JSON-stat2 shape (missing id/size)`);
  }

  const dimIndex = new Map<string, number>();
  for (let i = 0; i < dims.length; i++) dimIndex.set(dims[i]!, i);

  const sizeOf = (name: string) => sizes[dimIndex.get(name) ?? -1] ?? 0;
  const stride: number[] = [];
  for (let i = 0; i < sizes.length; i++) {
    let prod = 1;
    for (let j = i + 1; j < sizes.length; j++) prod *= sizes[j] ?? 1;
    stride.push(prod);
  }
  const linearIndex = (pos: Record<string, number>) => {
    let idx = 0;
    for (const [dim, dimPos] of Object.entries(pos)) {
      const di = dimIndex.get(dim);
      if (di == null) continue;
      idx += dimPos * (stride[di] ?? 0);
    }
    return idx;
  };

  const orderedCodes = (dimName: string): string[] => {
    const dim = json.dimension?.[dimName];
    if (!dim) return [];
    const idx = dim.category?.index;
    if (Array.isArray(idx)) return idx.map((x) => String(x));
    if (!idx || typeof idx !== "object") return [];
    return Object.entries(idx)
      .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))
      .map(([code]) => code);
  };

  const countries = orderedCodes("Country/area");
  const techs = orderedCodes("Technology"); // expects ["1","3","4"]
  const years = orderedCodes("Year"); // expects ["0".."24"] where labels are actual YYYY

  const yearLabels = json.dimension?.Year?.category?.label || {};
  const techLabels = json.dimension?.Technology?.category?.label || {};

  const sizeCountry = sizeOf("Country/area");
  const sizeTech = sizeOf("Technology");
  const sizeYear = sizeOf("Year");
  if (countries.length !== sizeCountry || techs.length !== sizeTech || years.length !== sizeYear) {
    // Be permissive; still attempt to iterate over ordered codes arrays.
    console.error(
      `IRENA dimension size mismatch: countries=${countries.length}/${sizeCountry} techs=${techs.length}/${sizeTech} years=${years.length}/${sizeYear}`
    );
  }

  let scanned = 0;
  for (let ci = 0; ci < countries.length; ci++) {
    const iso = (countries[ci] || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    for (let ti = 0; ti < techs.length; ti++) {
      const techCode = techs[ti] || "";
      const techLabel = techLabels[techCode] || techCode;
      for (let yi = 0; yi < years.length; yi++) {
        const yearCode = years[yi] || "";
        const yearLabel = yearLabels[yearCode] || yearCode;
        const year = Number.parseInt(String(yearLabel), 10);
        if (!isYearInRange(year)) continue;

        const idx = linearIndex({
          "Country/area": ci,
          Technology: ti,
          "Data Type": 0,
          "Grid connection": 0,
          Year: yi,
        });
        const mw = json.value?.[idx] ?? null;
        scanned += 1;
        if (mw == null || !Number.isFinite(mw) || mw < 0) continue;

        const gw = mw / 1000;
        const key = `${iso}__${year}`;
        if (techLabel === "Solar photovoltaic" || techCode === "1") {
          const prev = solarByIsoYear.get(key);
          if (prev == null || gw > prev) solarByIsoYear.set(key, gw);
        } else if (
          techLabel === "Onshore wind energy" ||
          techLabel === "Offshore wind energy" ||
          techCode === "3" ||
          techCode === "4"
        ) {
          windByIsoYear.set(key, (windByIsoYear.get(key) || 0) + gw);
        }
      }
    }
  }

  console.error(`IRENA values scanned: ${scanned}`);

  let emitted = 0;
  const emitSeries = (indicatorCode: string, m: Map<string, number>) => {
    for (const [key, value] of m) {
      const [iso, yearRaw] = key.split("__");
      const year = Number.parseInt(yearRaw || "", 10);
      if (!iso || !Number.isFinite(year)) continue;
      if (!Number.isFinite(value) || value < 0) continue;
      console.log(
        `INSERT OR REPLACE INTO data_points (country_id, indicator_id, year, value, source_vintage) ` +
          `SELECT c.id, i.id, ${year}, ${value}, '${escapeSQL(vintage)}' ` +
          `FROM countries c, indicators i ` +
          `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = '${escapeSQL(indicatorCode)}';`
      );
      emitted += 1;
    }
  };

  emitSeries("INSTALLED_CAPACITY_SOLAR_GW", solarByIsoYear);
  emitSeries("INSTALLED_CAPACITY_WIND_GW", windByIsoYear);

  console.error(`IRENA capacity points emitted: ${emitted}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
