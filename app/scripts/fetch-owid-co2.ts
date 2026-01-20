/**
 * Fetch CO2 per-capita data from Our World in Data (OWID)
 * and generate SQL for import into D1.
 *
 * Source:
 * - https://github.com/owid/co2-data
 * - CSV: https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv
 *
 * This script prints SQL to stdout and progress to stderr.
 */

const OWID_CSV_URL =
  "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv";

const START_YEAR = 1990;
const END_YEAR = 2023;

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
  console.error(`Fetching OWID CO2 CSV…`);
  const res = await fetch(OWID_CSV_URL);
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} fetching OWID CSV`);
  }

  let header: string[] | null = null;
  let idxIso = -1;
  let idxYear = -1;
  let idxCo2PerCap = -1;

  let rows = 0;
  let inserted = 0;

  console.log("\n-- CO2_PCAP data (OWID)");
  console.log(
    `INSERT OR REPLACE INTO indicators (code, name, unit, source, source_code, category)
VALUES ('CO2_PCAP', 'CO2 emissions per capita', 'metric tons', 'Our World in Data', 'owid-co2-data:co2_per_capita', 'environment');`
  );

  for await (const line of readLines(res.body)) {
    if (!header) {
      header = parseCsvLine(line);
      idxIso = header.indexOf("iso_code");
      idxYear = header.indexOf("year");
      idxCo2PerCap = header.indexOf("co2_per_capita");

      if (idxIso === -1 || idxYear === -1 || idxCo2PerCap === -1) {
        throw new Error(
          `OWID CSV missing required columns: iso_code/year/co2_per_capita`
        );
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

    const valueRaw = cols[idxCo2PerCap];
    if (!valueRaw) continue;
    const value = Number(valueRaw);
    if (!Number.isFinite(value)) continue;

    // Note: country existence is enforced by the SELECT join.
    console.log(
      `INSERT OR REPLACE INTO data_points (country_id, indicator_id, year, value) ` +
        `SELECT c.id, i.id, ${year}, ${value} ` +
        `FROM countries c, indicators i ` +
        `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = 'CO2_PCAP';`
    );
    inserted += 1;

    if (inserted % 20000 === 0) console.error(`  …${inserted} CO2_PCAP rows`);
  }

  console.error(`OWID rows scanned: ${rows}`);
  console.error(`CO2_PCAP rows emitted: ${inserted}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

