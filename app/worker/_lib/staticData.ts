import type { StaticCountry, StaticIndicator, StaticSeries } from "../../src/lib/staticDataFormat";

// Functions read the build-time data snapshot through the ASSETS binding instead of
// querying D1, so no request touches the database. Parsed files are kept per
// isolate; an isolate belongs to one deployment, so they can never be stale.

export interface StaticDataEnv {
  ASSETS: Fetcher;
}

const cache = new Map<string, Promise<unknown>>();

function loadAsset<T>(env: StaticDataEnv, requestUrl: string, path: string): Promise<T | null> {
  let pending = cache.get(path) as Promise<T | null> | undefined;
  if (!pending) {
    pending = env.ASSETS.fetch(new URL(path, requestUrl)).then(async (res) => {
      // Pages answers unknown paths with index.html, so anything that isn't JSON is missing.
      const isJson = res.headers.get("content-type")?.includes("json") ?? false;
      if (res.status === 404 || (res.ok && !isJson)) return null;
      if (!res.ok) throw new Error(`Static data ${path}: HTTP ${res.status}`);
      return (await res.json()) as T;
    });
    pending.catch(() => cache.delete(path));
    cache.set(path, pending);
  }
  return pending;
}

async function versioned<T>(env: StaticDataEnv, requestUrl: string, path: string) {
  const manifest = await loadAsset<{ version: string }>(env, requestUrl, "/data-manifest.json");
  if (!manifest) throw new Error("Static data manifest is missing");
  return loadAsset<T>(env, requestUrl, `/data/${manifest.version}/${path}`);
}

export async function loadCountries(env: StaticDataEnv, requestUrl: string) {
  const body = await versioned<{ data: StaticCountry[] }>(env, requestUrl, "countries.json");
  if (!body) throw new Error("Country list is missing");
  return body.data;
}

export async function loadIndicators(env: StaticDataEnv, requestUrl: string) {
  const body = await versioned<{ data: StaticIndicator[] }>(env, requestUrl, "indicators.json");
  if (!body) throw new Error("Indicator list is missing");
  return body.data;
}

export function loadSeries(
  env: StaticDataEnv,
  requestUrl: string,
  code: string,
): Promise<StaticSeries | null> {
  if (!/^[A-Z0-9_]{2,64}$/.test(code)) return Promise.resolve(null);
  return versioned<StaticSeries>(env, requestUrl, `series/${code}.json`);
}

// The data only changes on deploy, so let browsers and the edge keep responses for a day.
export const STATIC_DATA_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

/** Test hook: forget cached files between tests. */
export function clearStaticDataCache() {
  cache.clear();
}
