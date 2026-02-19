/**
 * Fetch GDP-per-capita PPP data from Penn World Table (PWT) and generate SQL for D1 import.
 *
 * Source dataset:
 * - DOI: https://doi.org/10.34894/FABVLR
 * - Dataverse dataset API: https://dataverse.nl/api/datasets/:persistentId/?persistentId=doi:10.34894/FABVLR
 *
 * Method:
 * - Download the latest top-level `pwt*.xlsx` workbook from the Dataverse dataset.
 * - Read the `Data` worksheet.
 * - Compute GDP per capita (PPP) as `rgdpe / pop`.
 *
 * Usage:
 *   npx tsx scripts/fetch-pwt.ts > data-import.sql
 */

import XLSX from "xlsx";

const PWT_DATASET_PERSISTENT_ID = process.env.PWT_DATASET_PERSISTENT_ID ?? "doi:10.34894/FABVLR";
const DATAVERSE_DATASET_API = `https://dataverse.nl/api/datasets/:persistentId/?persistentId=${encodeURIComponent(
  PWT_DATASET_PERSISTENT_ID,
)}`;

const START_YEAR = Number.parseInt(process.env.PWT_START_YEAR ?? "1950", 10);
const END_YEAR = Number.parseInt(
  process.env.PWT_END_YEAR ?? new Date().getFullYear().toString(),
  10,
);

interface DataverseFileEntry {
  dataFile?: {
    id?: number;
    filename?: string;
  };
}

interface DataverseDatasetResponse {
  status: string;
  data?: {
    latestVersion?: {
      publicationDate?: string;
      files?: DataverseFileEntry[];
    };
  };
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function inferVersionFromFilename(filename: string): string | null {
  const base = filename.toLowerCase().replace(/\.xlsx$/, "");
  const match = base.match(/^pwt(\d+)$/);
  if (!match) return null;
  const digits = match[1];
  if (digits.length <= 1) return digits;
  if (digits.length === 2) return `${digits[0]}.${digits[1]}`;
  if (digits.length === 3) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return digits;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

async function resolvePwtWorkbook(): Promise<{
  fileId: number;
  filename: string;
  publicationDate: string | null;
  sourceCode: string;
  sourceVintage: string;
}> {
  console.error(`Fetching PWT dataset metadata (${PWT_DATASET_PERSISTENT_ID})...`);
  const metadata = await fetchJSON<DataverseDatasetResponse>(DATAVERSE_DATASET_API);
  const files = metadata.data?.latestVersion?.files ?? [];

  const workbook = files
    .map((f) => f.dataFile)
    .find((f) => {
      const id = f?.id;
      const name = f?.filename;
      return (
        typeof id === "number" &&
        typeof name === "string" &&
        /^pwt\d+\.xlsx$/i.test(name) &&
        !/na_data|capital_detail|labor_detail|trade_detail|sh_bilateral_cor/i.test(name)
      );
    });

  if (!workbook?.id || !workbook.filename) {
    throw new Error("Could not resolve PWT workbook file in dataset metadata.");
  }

  const publicationDate = metadata.data?.latestVersion?.publicationDate ?? null;
  const version = inferVersionFromFilename(workbook.filename);
  const sourceCode = version ? `pwt${version}:rgdpe/pop` : "pwt:rgdpe/pop";
  const sourceVintage = publicationDate
    ? `${sourceCode}@${publicationDate}`
    : `${sourceCode}@unknown-date`;

  return {
    fileId: workbook.id,
    filename: workbook.filename,
    publicationDate,
    sourceCode,
    sourceVintage,
  };
}

async function main() {
  const { fileId, filename, publicationDate, sourceCode, sourceVintage } =
    await resolvePwtWorkbook();
  const workbookUrl = `https://dataverse.nl/api/access/datafile/${fileId}`;

  console.error(`Downloading ${filename} (file id ${fileId})...`);
  const response = await fetch(workbookUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${workbookUrl}`);
  }
  const buffer = await response.arrayBuffer();

  console.error("Parsing workbook...");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets.Data;
  if (!sheet) {
    throw new Error(`Workbook missing "Data" sheet. Found: ${workbook.SheetNames.join(", ")}`);
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headerByName = new Map<string, number>();
  for (let c = 0; c <= range.e.c; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    const header = typeof cell?.v === "string" ? cell.v.trim().toLowerCase() : "";
    if (header.length > 0) headerByName.set(header, c);
  }

  const idxIso = headerByName.get("countrycode");
  const idxYear = headerByName.get("year");
  const idxRgdpe = headerByName.get("rgdpe");
  const idxPop = headerByName.get("pop");

  if (
    idxIso == null ||
    idxYear == null ||
    idxRgdpe == null ||
    idxPop == null ||
    [idxIso, idxYear, idxRgdpe, idxPop].some((idx) => !Number.isFinite(idx))
  ) {
    throw new Error("Required columns missing in PWT Data sheet (countrycode/year/rgdpe/pop).");
  }

  let maxDataRow = 1;
  for (const key of Object.keys(sheet)) {
    if (!/^A\d+$/.test(key)) continue;
    const row = Number.parseInt(key.slice(1), 10);
    if (Number.isFinite(row)) {
      maxDataRow = Math.max(maxDataRow, row);
    }
  }

  console.log("\n-- GDP_PCAP_PPP data (Penn World Table)");
  console.log(
    `INSERT OR REPLACE INTO indicators (code, name, unit, source, source_code, category)
VALUES ('GDP_PCAP_PPP', 'GDP per capita (PPP)', 'constant 2017 US$ (PPP)', 'Penn World Table', '${escapeSQL(sourceCode)}', 'economic');`,
  );
  console.log(
    `-- Replace any prior GDP_PCAP_PPP values (e.g. from other data pipelines) with PWT series`,
  );
  console.log(
    `DELETE FROM data_points WHERE indicator_id = (SELECT id FROM indicators WHERE code = 'GDP_PCAP_PPP');`,
  );

  let scanned = 0;
  let inserted = 0;
  for (let row = 2; row <= maxDataRow; row += 1) {
    const isoRaw = sheet[XLSX.utils.encode_cell({ r: row - 1, c: idxIso })]?.v;
    const yearRaw = sheet[XLSX.utils.encode_cell({ r: row - 1, c: idxYear })]?.v;
    const rgdpeRaw = sheet[XLSX.utils.encode_cell({ r: row - 1, c: idxRgdpe })]?.v;
    const popRaw = sheet[XLSX.utils.encode_cell({ r: row - 1, c: idxPop })]?.v;

    scanned += 1;

    const iso = typeof isoRaw === "string" ? isoRaw.trim().toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(iso)) continue;

    const year = Number.parseInt(String(yearRaw ?? ""), 10);
    if (!Number.isFinite(year) || year < START_YEAR || year > END_YEAR) continue;

    const rgdpe = asFiniteNumber(rgdpeRaw);
    const pop = asFiniteNumber(popRaw);
    if (rgdpe == null || pop == null || pop <= 0) continue;

    const value = rgdpe / pop;
    if (!Number.isFinite(value) || value <= 0) continue;
    const rounded = Math.round(value * 1000) / 1000;

    console.log(
      `INSERT OR REPLACE INTO data_points (country_id, indicator_id, year, value, source_vintage) ` +
        `SELECT c.id, i.id, ${year}, ${rounded}, '${escapeSQL(sourceVintage)}' ` +
        `FROM countries c, indicators i ` +
        `WHERE c.iso_alpha3 = '${escapeSQL(iso)}' AND i.code = 'GDP_PCAP_PPP';`,
    );
    inserted += 1;
  }

  console.error(
    `PWT rows scanned: ${scanned} | rows emitted: ${inserted} | publication date: ${publicationDate ?? "unknown"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
