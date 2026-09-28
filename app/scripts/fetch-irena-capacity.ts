/**
 * Fetch installed electricity capacity (solar/wind) from IRENASTAT (PXWeb)
 * and generate SQL for import into D1.
 *
 * Source: https://pxweb.irena.org/pxweb/en/IRENASTAT/
 *
 * Dataset used (default):
 * - Power Capacity and Generation / newest Country_ELECSTAT_*.px table
 *   "Electricity statistics by Country/area, Technology, Data Type, Grid connection and Year"
 *
 * Notes:
 * - IRENA renames the table each release and has renumbered its value codes
 *   between releases (e.g. Technology "1" moved from Solar PV to Total Renewable),
 *   so the table is discovered and every code is resolved from its label.
 * - IRENA capacity is in MW; we store GW.
 * - Wind is derived as onshore + offshore.
 */

import { loadDotEnv } from "./dotenv";

loadDotEnv();

const BASE = "https://pxweb.irena.org/api/v1/en/IRENASTAT";
const FOLDER = "Power Capacity and Generation";
const TABLE_PATTERN = /^Country_ELECSTAT_.+\.px$/;
const START_YEAR = Number.parseInt(process.env.IRENA_CAPACITY_START_YEAR || "2000", 10);
const END_YEAR = Number.parseInt(
  process.env.IRENA_CAPACITY_END_YEAR || String(new Date().getFullYear() - 1),
  10,
);

const TECH_SOLAR = "Solar photovoltaic";
const TECH_WIND = ["Onshore wind energy", "Offshore wind energy"];
const DATA_TYPE_CAPACITY = /installed capacity/i;
const GRID_ALL = "All";

interface PxVariable {
  code: string;
  values: string[];
  valueTexts: string[];
}

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

async function resolveTable(): Promise<{ table: string; updated: string | null }> {
  const folderUrl = `${BASE}/${encodeURIComponent(FOLDER)}`;
  const list = await fetchJSON<Array<{ id: string; updated?: string }>>(folderUrl);
  const pinned = process.env.IRENA_ELECSTAT_TABLE;
  const candidates = list
    .filter((x) => (pinned ? x.id === pinned : TABLE_PATTERN.test(x.id)))
    .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
  const hit = candidates[0];
  if (!hit) {
    throw new Error(
      `No IRENA table matching ${pinned ?? TABLE_PATTERN} in ${FOLDER}. Available: ${list
        .map((x) => x.id)
        .join(", ")}`,
    );
  }
  return { table: hit.id, updated: hit.updated?.slice(0, 10) ?? null };
}

function codesFor(variable: PxVariable, match: (label: string) => boolean): string[] {
  return variable.values.filter((_, i) => match(variable.valueTexts[i] ?? ""));
}

async function main() {
  const { table, updated } = await resolveTable();
  const vintagePrefix = `irena-pxweb:${table}`;
  const vintage = process.env.IRENA_CAPACITY_VINTAGE || `${vintagePrefix}@${updated ?? "unknown"}`;

  const endpoint = `${BASE}/${encodeURIComponent(FOLDER)}/${encodeURIComponent(table)}`;
  console.error(`Using IRENA table ${table} (updated ${updated ?? "unknown"})`);

  const meta = await fetchJSON<{ variables: PxVariable[] }>(endpoint);
  const variable = (code: string) => {
    const hit = meta.variables.find((v) => v.code === code);
    if (!hit) throw new Error(`IRENA table ${table} has no "${code}" variable`);
    return hit;
  };
  const requireCodes = (label: string, codes: string[]) => {
    if (codes.length === 0) throw new Error(`IRENA table ${table}: no value matching ${label}`);
    return codes;
  };
  const techCodes = requireCodes(
    "solar/wind technologies",
    codesFor(variable("Technology"), (l) => l === TECH_SOLAR || TECH_WIND.includes(l)),
  );
  const dataTypeCodes = requireCodes(
    "installed capacity",
    codesFor(variable("Data Type"), (l) => DATA_TYPE_CAPACITY.test(l)),
  );
  const gridCodes = requireCodes(
    "all grid connections",
    codesFor(variable("Grid connection"), (l) => l === GRID_ALL),
  );

  console.error(`Fetching IRENA capacity (solar/wind) JSON-stat2…`);
  const payload = {
    query: [
      { code: "Country/area", selection: { filter: "all", values: ["*"] } },
      { code: "Technology", selection: { filter: "item", values: techCodes } },
      { code: "Data Type", selection: { filter: "item", values: dataTypeCodes.slice(0, 1) } },
      { code: "Grid connection", selection: { filter: "item", values: gridCodes.slice(0, 1) } },
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
      `'${escapeSQL(vintagePrefix)}', 'energy');`,
  );
  console.log(
    `INSERT OR IGNORE INTO indicators (code, name, unit, source, source_code, category)\n` +
      `VALUES ('INSTALLED_CAPACITY_WIND_GW', 'Installed capacity (wind)', 'GW', 'IRENA', ` +
      `'${escapeSQL(vintagePrefix)}', 'energy');`,
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
  const techs = orderedCodes("Technology");
  const years = orderedCodes("Year"); // codes are not in year order; labels are YYYY

  const yearLabels = json.dimension?.Year?.category?.label || {};
  const techLabels = json.dimension?.Technology?.category?.label || {};

  const sizeCountry = sizeOf("Country/area");
  const sizeTech = sizeOf("Technology");
  const sizeYear = sizeOf("Year");
  if (countries.length !== sizeCountry || techs.length !== sizeTech || years.length !== sizeYear) {
    // Be permissive; still attempt to iterate over ordered codes arrays.
    console.error(
      `IRENA dimension size mismatch: countries=${countries.length}/${sizeCountry} techs=${techs.length}/${sizeTech} years=${years.length}/${sizeYear}`,
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
        if (techLabel === TECH_SOLAR) {
          const prev = solarByIsoYear.get(key);
          if (prev == null || gw > prev) solarByIsoYear.set(key, gw);
        } else if (TECH_WIND.includes(techLabel)) {
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
          `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = '${escapeSQL(indicatorCode)}';`,
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
