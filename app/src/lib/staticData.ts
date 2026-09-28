import type { StaticCountry, StaticIndicator, StaticSeries } from "./staticDataFormat";

// Injected by vite.config.ts from public/data-manifest.json.
declare const __DATA_VERSION__: string | undefined;
const DATA_VERSION = typeof __DATA_VERSION__ === "string" ? __DATA_VERSION__ : "missing";

export function dataUrl(path: string) {
  return `/data/${DATA_VERSION}/${path}`;
}

// One request per file per page load: files are versioned and never change, so every
// hook that needs the same file shares a single in-flight or finished request.
const cache = new Map<string, Promise<unknown>>();

async function loadJson<T>(path: string): Promise<T | null> {
  let pending = cache.get(path) as Promise<T | null> | undefined;
  if (!pending) {
    pending = fetch(dataUrl(path)).then(async (res) => {
      // Pages answers unknown paths with index.html, so anything that isn't JSON is missing.
      const isJson = res.headers.get("content-type")?.includes("json") ?? false;
      if (res.status === 404 || (res.ok && !isJson)) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    });
    // Let a later call retry after a network failure.
    pending.catch(() => cache.delete(path));
    cache.set(path, pending);
  }
  return pending;
}

export async function loadCountries(): Promise<StaticCountry[]> {
  const body = await loadJson<{ data: StaticCountry[] }>("countries.json");
  if (!body) throw new Error("Country list is missing");
  return body.data;
}

export async function loadIndicators(): Promise<StaticIndicator[]> {
  const body = await loadJson<{ data: StaticIndicator[] }>("indicators.json");
  if (!body) throw new Error("Indicator list is missing");
  return body.data;
}

/** Series for one indicator across all countries, or null when the indicator doesn't exist. */
export function loadSeries(code: string): Promise<StaticSeries | null> {
  if (!/^[A-Z0-9_]{2,64}$/.test(code)) return Promise.resolve(null);
  return loadJson<StaticSeries>(`series/${code}.json`);
}

/** Test hook: forget cached files between tests. */
export function clearStaticDataCache() {
  cache.clear();
}
