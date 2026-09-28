/**
 * Snapshot the D1 database into static JSON files, once per build.
 *
 * The site reads these files from the CDN instead of querying D1 on every
 * request. Data only changes when we import, so there is nothing to gain from
 * live queries.
 *
 * Output (gitignored):
 * - public/data-manifest.json                { version, generatedAt, source }  (unversioned)
 * - public/data/<version>/countries.json     { data: Country[] }
 * - public/data/<version>/indicators.json    { data: Indicator[] }
 * - public/data/<version>/series/<CODE>.json      { indicator, projectedFrom, vintages, data: { ISO3: [year, value, vintageIndex?][] } }
 *   projectedFrom is the first projected year (UN population scenarios) or null.
 *
 * <version> is a hash of the contents, so files can be cached forever and a
 * deploy with new data gets new URLs.
 *
 * Usage: tsx scripts/build-static-data.ts [--remote]
 *   Default reads the local dev database (.wrangler/state).
 *   --remote (or STATIC_DATA_SOURCE=remote) reads production D1 with one
 *   `wrangler d1 export` call; `pnpm pages:deploy` uses this.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATABASE = "convergence-db";
const OUT_DIR = "public/data";
const MANIFEST = "public/data-manifest.json";
const useLocal = !(
  process.argv.includes("--remote") || process.env.STATIC_DATA_SOURCE?.toLowerCase() === "remote"
);

interface IndicatorRow {
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  source: string | null;
  source_code: string | null;
  category: string | null;
}

type SeriesPoint =
  | [year: number, value: number]
  | [year: number, value: number, vintageIndex: number];

function exportDatabase(): string {
  const dir = mkdtempSync(join(tmpdir(), "static-data-"));
  const file = join(dir, "export.sql");
  const args = ["d1", "export", DATABASE, `--output=${file}`];
  args.push(...(useLocal ? ["--local"] : ["--remote"]));
  console.error(`Exporting ${useLocal ? "local" : "production"} D1 (${DATABASE})…`);
  try {
    execFileSync("./node_modules/.bin/wrangler", args, { stdio: ["ignore", "ignore", "inherit"] });
  } catch (err) {
    console.error(
      useLocal
        ? "Could not export the local database. Create it with `pnpm db:init && pnpm db:import`, or pass --remote."
        : "Could not export production D1. Check `wrangler whoami`.",
    );
    throw err;
  }
  const sql = readFileSync(file, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return sql;
}

function writeJson(path: string, value: unknown) {
  const body = JSON.stringify(value);
  writeFileSync(path, body);
  return body;
}

function main() {
  const db = new DatabaseSync(":memory:");
  db.exec(exportDatabase());

  const countries = db
    .prepare(
      `SELECT iso_alpha3, iso_alpha2, name, region, income_group FROM countries ORDER BY name`,
    )
    .all();
  const indicators = db
    .prepare(
      `SELECT code, name, description, unit, source, source_code, category
       FROM indicators ORDER BY category, name`,
    )
    .all() as unknown as IndicatorRow[];

  const rows = db
    .prepare(
      `SELECT i.code AS code, c.iso_alpha3 AS iso, d.year AS year, d.value AS value,
              d.source_vintage AS vintage, d.is_projection AS projected
       FROM data_points d
       JOIN countries c ON c.id = d.country_id
       JOIN indicators i ON i.id = d.indicator_id
       ORDER BY i.code, c.iso_alpha3, d.year`,
    )
    .all() as unknown as Array<{
    code: string;
    iso: string;
    year: number;
    value: number;
    vintage: string | null;
    projected: number;
  }>;

  // Group rows per indicator; vintages are stored once per file and referenced by index
  // because they repeat across nearly every point. Points without one omit the index.
  const series = new Map<
    string,
    {
      vintages: string[];
      data: Record<string, SeriesPoint[]>;
      index: Map<string, number>;
      firstProjected: number;
      lastObserved: number;
    }
  >();
  for (const indicator of indicators) {
    series.set(indicator.code, {
      vintages: [],
      data: {},
      index: new Map(),
      firstProjected: Number.POSITIVE_INFINITY,
      lastObserved: Number.NEGATIVE_INFINITY,
    });
  }
  for (const row of rows) {
    const entry = series.get(row.code);
    if (!entry) continue;
    if (row.projected) entry.firstProjected = Math.min(entry.firstProjected, row.year);
    else entry.lastObserved = Math.max(entry.lastObserved, row.year);
    let vi = -1;
    if (row.vintage) {
      vi = entry.index.get(row.vintage) ?? -1;
      if (vi === -1) {
        vi = entry.vintages.push(row.vintage) - 1;
        entry.index.set(row.vintage, vi);
      }
    }
    const points = entry.data[row.iso] ?? [];
    points.push(vi === -1 ? [row.year, row.value] : [row.year, row.value, vi]);
    entry.data[row.iso] = points;
  }

  const files: Array<[string, unknown]> = [
    ["countries.json", { data: countries }],
    ["indicators.json", { data: indicators }],
  ];
  for (const indicator of indicators) {
    const entry = series.get(indicator.code);
    const projectedFrom =
      entry && Number.isFinite(entry.firstProjected) ? entry.firstProjected : null;
    // One cutoff year per series is all the format can express.
    if (entry && projectedFrom != null && entry.lastObserved >= projectedFrom) {
      throw new Error(
        `${indicator.code}: observed data in ${entry.lastObserved} overlaps projections from ${projectedFrom}`,
      );
    }
    files.push([
      `series/${indicator.code}.json`,
      { indicator, projectedFrom, vintages: entry?.vintages ?? [], data: entry?.data ?? {} },
    ]);
  }

  const hash = createHash("sha256");
  const bodies = files.map(([path, value]) => {
    const body = JSON.stringify(value);
    hash.update(path).update(body);
    return [path, body] as const;
  });
  const version = hash.digest("hex").slice(0, 12);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(join(OUT_DIR, version, "series"), { recursive: true });
  let bytes = 0;
  for (const [path, body] of bodies) {
    writeFileSync(join(OUT_DIR, version, path), body);
    bytes += body.length;
  }
  writeJson(MANIFEST, {
    version,
    generatedAt: new Date().toISOString(),
    source: useLocal ? "local" : "remote",
  });

  console.error(
    `Wrote ${files.length} files (${(bytes / 1e6).toFixed(1)} MB, ${rows.length} points) to ${OUT_DIR}/${version}`,
  );
}

main();
