/**
 * Fetch electricity generation by source from Our World in Data (OWID)
 * and generate SQL for import into D1.
 *
 * Source:
 * - https://github.com/owid/energy-data
 * - CSV: https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv
 *
 * This script prints SQL to stdout and progress to stderr.
 *
 * Note on units:
 * - OWID `*_electricity` and `electricity_generation` are in TWh.
 */

import { loadDotEnv } from "./dotenv";

loadDotEnv();

const OWID_ENERGY_REF = process.env.OWID_ENERGY_REF || "master";
const OWID_SOURCE_VINTAGE =
  process.env.OWID_ENERGY_VINTAGE || `owid-energy-data@${OWID_ENERGY_REF}`;
const OWID_CSV_URL = `https://raw.githubusercontent.com/owid/energy-data/${OWID_ENERGY_REF}/owid-energy-data.csv`;

const START_YEAR = 1990;
const END_YEAR = 2023;

type SeriesDef = {
  code: string;
  name: string;
  unit: string;
  source: string;
  sourceCode: string;
  category: string;
  owidColumn: string;
};

const SERIES: SeriesDef[] = [
  {
    code: "ELECTRICITY_GEN_TOTAL",
    name: "Electricity generation (total)",
    unit: "TWh",
    source: "Our World in Data",
    sourceCode: "owid-energy-data:electricity_generation",
    category: "energy",
    owidColumn: "electricity_generation",
  },
  {
    code: "ELECTRICITY_GEN_SOLAR",
    name: "Electricity generation (solar)",
    unit: "TWh",
    source: "Our World in Data",
    sourceCode: "owid-energy-data:solar_electricity",
    category: "energy",
    owidColumn: "solar_electricity",
  },
  {
    code: "ELECTRICITY_GEN_WIND",
    name: "Electricity generation (wind)",
    unit: "TWh",
    source: "Our World in Data",
    sourceCode: "owid-energy-data:wind_electricity",
    category: "energy",
    owidColumn: "wind_electricity",
  },
  {
    code: "ELECTRICITY_GEN_COAL",
    name: "Electricity generation (coal)",
    unit: "TWh",
    source: "Our World in Data",
    sourceCode: "owid-energy-data:coal_electricity",
    category: "energy",
    owidColumn: "coal_electricity",
  },
  {
    code: "ELECTRICITY_GEN_NUCLEAR",
    name: "Electricity generation (nuclear)",
    unit: "TWh",
    source: "Our World in Data",
    sourceCode: "owid-energy-data:nuclear_electricity",
    category: "energy",
    owidColumn: "nuclear_electricity",
  },
];

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

async function* readLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      yield line;
      idx = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.length > 0) yield buffer.replace(/\r$/, "");
}

async function main() {
  console.error(`Fetching OWID energy CSV…`);
  const res = await fetch(OWID_CSV_URL);
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} fetching OWID energy CSV`);
  }

  let header: string[] | null = null;
  let idxIso = -1;
  let idxYear = -1;
  const idxBySeries = new Map<string, number>();

  let rows = 0;
  let emitted = 0;

  console.log("\n-- Electricity generation by source (OWID energy)");
  for (const s of SERIES) {
    console.log(
      `INSERT OR IGNORE INTO indicators (code, name, unit, source, source_code, category)\n` +
        `VALUES ('${escapeSQL(s.code)}', '${escapeSQL(s.name)}', '${escapeSQL(s.unit)}', '${escapeSQL(s.source)}', '${escapeSQL(s.sourceCode)}', '${escapeSQL(s.category)}');`
    );
  }

  for await (const line of readLines(res.body)) {
    if (!header) {
      header = parseCsvLine(line);
      idxIso = header.indexOf("iso_code");
      idxYear = header.indexOf("year");
      if (idxIso === -1 || idxYear === -1) {
        throw new Error(`OWID energy CSV missing required columns: iso_code/year`);
      }

      for (const s of SERIES) {
        const idx = header.indexOf(s.owidColumn);
        if (idx === -1) {
          throw new Error(`OWID energy CSV missing required column: ${s.owidColumn}`);
        }
        idxBySeries.set(s.code, idx);
      }
      continue;
    }

    if (!line) continue;
    rows += 1;
    const cols = parseCsvLine(line);

    const iso = (cols[idxIso] || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso)) continue; // skip OWID_* aggregates and non-ISO codes

    const year = Number.parseInt(cols[idxYear] || "", 10);
    if (!Number.isFinite(year) || year < START_YEAR || year > END_YEAR) continue;

    for (const s of SERIES) {
      const idx = idxBySeries.get(s.code);
      if (idx == null) continue;
      const valueRaw = cols[idx];
      if (!valueRaw) continue;
      const value = Number(valueRaw);
      if (!Number.isFinite(value)) continue;

      console.log(
        `INSERT OR REPLACE INTO data_points (country_id, indicator_id, year, value, source_vintage) ` +
          `SELECT c.id, i.id, ${year}, ${value}, '${escapeSQL(OWID_SOURCE_VINTAGE)}' ` +
          `FROM countries c, indicators i ` +
          `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = '${escapeSQL(s.code)}';`
      );
      emitted += 1;
    }

    if (emitted > 0 && emitted % 20000 === 0) {
      console.error(`  …${emitted} electricity-generation rows emitted`);
    }
  }

  console.error(`OWID energy rows scanned: ${rows}`);
  console.error(`Electricity-generation rows emitted: ${emitted}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
