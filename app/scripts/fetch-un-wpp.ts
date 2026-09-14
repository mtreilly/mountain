/**
 * Import pinned UN World Population Prospects 2024 total-population scenarios.
 * Set WPP_CSV_GZ_PATH to use an already-downloaded official .csv.gz file.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

export const WPP_REVISION = "2024";
export const WPP_VINTAGE = `un-wpp@${WPP_REVISION}`;
export const WPP_URL =
  "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_TotalPopulationBySex.csv.gz";

const VARIANT_CODES = {
  Medium: "POPULATION_UN_MEDIUM",
  Low: "POPULATION_UN_LOW",
  High: "POPULATION_UN_HIGH",
} as const;

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

export function populationSql(params: {
  iso3: string;
  variant: keyof typeof VARIANT_CODES;
  year: number;
  populationThousands: number;
}) {
  const code = VARIANT_CODES[params.variant];
  const persons = Math.round(params.populationThousands * 1000);
  return (
    "INSERT OR REPLACE INTO data_points " +
    "(country_id, indicator_id, year, value, is_projection, source_vintage) " +
    `SELECT c.id, i.id, ${params.year}, ${persons}, ${params.year > 2023 ? 1 : 0}, '${WPP_VINTAGE}' ` +
    "FROM countries c, indicators i " +
    `WHERE c.iso_alpha3 = '${params.iso3}' AND i.code = '${code}';`
  );
}

async function inputStream() {
  const localPath = process.env.WPP_CSV_GZ_PATH;
  if (localPath) return createReadStream(localPath).pipe(createGunzip());
  const response = await fetch(WPP_URL);
  if (!response.ok || !response.body) {
    throw new Error(`UN WPP download failed with HTTP ${response.status}`);
  }
  return Readable.fromWeb(response.body as never).pipe(createGunzip());
}

async function main() {
  const lines = createInterface({ input: await inputStream(), crlfDelay: Infinity });
  let header: string[] | null = null;
  let emitted = 0;
  const countries = new Set<string>();
  const seen = new Set<string>();

  console.log("-- UN World Population Prospects 2024");
  for await (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (!header) {
      header = parseCsvLine(line);
      const headerColumns = new Set(header);
      for (const required of ["ISO3_code", "Variant", "Time", "PopTotal"]) {
        if (!headerColumns.has(required)) throw new Error(`UN WPP CSV missing ${required}`);
      }
      continue;
    }
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""]));
    const iso3 = row.ISO3_code.trim().toUpperCase();
    const variant = row.Variant.trim() as keyof typeof VARIANT_CODES;
    const year = Number.parseInt(row.Time, 10);
    const populationThousands = Number(row.PopTotal);
    if (!/^[A-Z]{3}$/.test(iso3) || !(variant in VARIANT_CODES)) continue;
    if (!Number.isInteger(year) || year < 1950 || year > 2100) continue;
    if (!Number.isFinite(populationThousands) || populationThousands < 0) continue;

    const key = `${iso3}:${variant}:${year}`;
    if (seen.has(key)) throw new Error(`Duplicate UN WPP row: ${key}`);
    seen.add(key);
    countries.add(iso3);
    console.log(populationSql({ iso3, variant, year, populationThousands }));
    emitted++;
  }

  if (emitted === 0) throw new Error("UN WPP import emitted no population points");
  if (countries.size < 150 && !process.env.WPP_ALLOW_PARTIAL) {
    throw new Error(`UN WPP country coverage too low: ${countries.size}`);
  }
  console.error(`UN WPP points emitted: ${emitted}; ISO3 locations: ${countries.size}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
