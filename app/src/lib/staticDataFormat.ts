// Shape of the static data snapshot written by scripts/build-static-data.ts.
// Shared by the browser loader and the Pages Functions so both read it the same way.

export interface StaticIndicator {
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  source: string | null;
  source_code: string | null;
  category: string | null;
}

export interface StaticCountry {
  iso_alpha3: string;
  iso_alpha2: string;
  name: string;
  region: string | null;
  income_group: string | null;
}

type StaticPoint = [year: number, value: number] | [year: number, value: number, vintage: number];

export interface StaticSeries {
  indicator: StaticIndicator;
  /** First projected year (UN population scenarios), or null when every point is observed. */
  projectedFrom: number | null;
  vintages: string[];
  data: Record<string, StaticPoint[]>;
}

export interface SeriesPoint {
  year: number;
  value: number;
  source_vintage?: string | null;
}

/** Points for one country, filtered to a year range, in the shape the API has always returned. */
export function seriesPoints(
  series: StaticSeries,
  iso: string,
  options: { startYear?: number; endYear?: number; includeSourceVintage?: boolean } = {},
): SeriesPoint[] {
  const { startYear = -Infinity, endYear = Infinity, includeSourceVintage = false } = options;
  const out: SeriesPoint[] = [];
  for (const point of series.data[iso] ?? []) {
    const [year, value, vintage] = point;
    if (year < startYear || year > endYear) continue;
    out.push(
      includeSourceVintage
        ? {
            year,
            value,
            source_vintage: vintage == null ? null : (series.vintages[vintage] ?? null),
          }
        : { year, value },
    );
  }
  return out;
}

/** Latest observed (non-projected) point for a country, or null. */
export function latestObserved(series: StaticSeries, iso: string): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const [year, value] of series.data[iso] ?? []) {
    if (series.projectedFrom != null && year >= series.projectedFrom) continue;
    if (!best || year > best.year) best = { year, value };
  }
  return best;
}

/** Data for several countries, keyed by ISO3; countries with no points are omitted. */
export function seriesForCountries(
  series: StaticSeries,
  countries: string[],
  options?: Parameters<typeof seriesPoints>[2],
): Record<string, SeriesPoint[]> {
  const out: Record<string, SeriesPoint[]> = {};
  for (const iso of countries) {
    const points = seriesPoints(series, iso, options);
    if (points.length > 0) out[iso] = points;
  }
  return out;
}
