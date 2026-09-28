import type { Page, Route } from "@playwright/test";
import { TEMPLATE_PATHS } from "../../src/lib/templatePaths";

const countries = [
  {
    iso_alpha3: "POL",
    iso_alpha2: "PL",
    name: "Poland",
    region: "Europe & Central Asia",
    income_group: "High income",
  },
  {
    iso_alpha3: "GBR",
    iso_alpha2: "GB",
    name: "United Kingdom",
    region: "Europe & Central Asia",
    income_group: "High income",
  },
  {
    iso_alpha3: "NGA",
    iso_alpha2: "NG",
    name: "Nigeria",
    region: "Sub-Saharan Africa",
    income_group: "Lower middle income",
  },
  {
    iso_alpha3: "IRL",
    iso_alpha2: "IE",
    name: "Ireland",
    region: "Europe & Central Asia",
    income_group: "High income",
  },
  {
    iso_alpha3: "USA",
    iso_alpha2: "US",
    name: "United States",
    region: "North America",
    income_group: "High income",
  },
];

const indicators = [
  {
    code: "GDP_PCAP_PPP",
    name: "GDP per capita (PPP)",
    description: "GDP per capita, PPP (constant 2021 international $)",
    unit: "constant 2021 int$",
    source: "World Bank",
    category: "economic",
  },
  {
    code: "LIFE_EXPECT",
    name: "Life expectancy at birth",
    description: "Life expectancy at birth, total (years)",
    unit: "years",
    source: "World Bank",
    category: "health",
  },
  {
    code: "POPULATION",
    name: "Population",
    description: "Total population",
    unit: "persons",
    source: "World Bank",
    category: "demographic",
  },
];

const seriesByIndicatorAndIso: Record<
  string,
  Record<string, Array<{ year: number; value: number }>>
> = {
  GDP_PCAP_PPP: {
    POL: [
      { year: 2021, value: 36_500 },
      { year: 2022, value: 38_200 },
      { year: 2023, value: 40_100 },
    ],
    GBR: [
      { year: 2021, value: 49_500 },
      { year: 2022, value: 50_700 },
      { year: 2023, value: 52_000 },
    ],
    NGA: [
      { year: 2021, value: 5100 },
      { year: 2022, value: 5250 },
      { year: 2023, value: 5400 },
    ],
    IRL: [
      { year: 2021, value: 89000 },
      { year: 2022, value: 90500 },
      { year: 2023, value: 92000 },
    ],
    USA: [
      { year: 2021, value: 64000 },
      { year: 2022, value: 66000 },
      { year: 2023, value: 68000 },
    ],
  },
  LIFE_EXPECT: {
    POL: [{ year: 2023, value: 78.6 }],
    GBR: [{ year: 2023, value: 81.3 }],
    NGA: [{ year: 2023, value: 55.4 }],
    IRL: [{ year: 2023, value: 82.7 }],
    USA: [{ year: 2023, value: 77.5 }],
  },
  POPULATION: {
    POL: [{ year: 2023, value: 36_700_000 }],
    GBR: [{ year: 2023, value: 68_300_000 }],
    NGA: [{ year: 2023, value: 223_800_000 }],
    IRL: [{ year: 2023, value: 5_300_000 }],
    USA: [{ year: 2023, value: 334_900_000 }],
  },
};

function syntheticBase(code: string, iso: string) {
  let hash = 0;
  const key = `${code}:${iso}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return 800 + (hash % 12_000);
}

function syntheticSeries(code: string, iso: string): Array<{ year: number; value: number }> {
  if (code.startsWith("POPULATION_UN_")) {
    const current = seriesByIndicatorAndIso.POPULATION?.[iso]?.[0]?.value ?? 25_000_000;
    const variantFactor = code.endsWith("_LOW") ? 0.996 : code.endsWith("_HIGH") ? 1.004 : 1;
    return Array.from({ length: 111 }, (_, index) => {
      const year = 1990 + index;
      const elapsed = year - 2023;
      return {
        year,
        value: Math.round(current * Math.pow(1.01 * variantFactor, elapsed)),
        source_vintage: "un-wpp@2024",
      };
    });
  }
  const generationTWh: Record<string, number> = {
    ELECTRICITY_GEN_TOTAL: 40,
    ELECTRICITY_GEN_SOLAR: 5,
    ELECTRICITY_GEN_WIND: 10,
    ELECTRICITY_GEN_NUCLEAR: 5,
    ELECTRICITY_GEN_COAL: 20,
  };
  if (code in generationTWh) return [{ year: 2023, value: generationTWh[code] }];
  const base = syntheticBase(code, iso);
  const growth = 1 + ((syntheticBase(iso, code) % 8) + 1) / 200; // 1.5%..4.5%
  return [
    { year: 2021, value: Math.round(base) },
    { year: 2022, value: Math.round(base * growth) },
    { year: 2023, value: Math.round(base * growth * growth) },
  ];
}

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

function mockIndicator(code: string) {
  return (
    indicators.find((indicator) => indicator.code === code) ||
    ({
      code,
      name: code,
      description: null,
      unit: code.startsWith("POPULATION_UN_") ? "persons" : null,
      source: code.startsWith("POPULATION_UN_") ? "UN World Population Prospects" : "World Bank",
      source_code: code.startsWith("POPULATION_UN_") ? `WPP2024:${code}` : null,
      category: "other",
    } as const)
  );
}

// Static data snapshot (/data/<version>/...), in the format scripts/build-static-data.ts writes.
function staticDataResponse(path: string): unknown | null {
  if (path === "countries.json") return { data: countries };
  if (path === "indicators.json") return { data: indicators };
  const match = /^series\/([A-Z0-9_]+)\.json$/.exec(path);
  if (!match) return null;
  const code = match[1]!;
  // Static files hold every country, so include the implications template countries too.
  const isoCodes = new Set([
    ...countries.map((c) => c.iso_alpha3),
    ...TEMPLATE_PATHS.flatMap((t) => t.iso3),
  ]);
  const data: Record<string, Array<[number, number]>> = {};
  for (const iso of isoCodes) {
    const points = seriesByIndicatorAndIso[code]?.[iso] || syntheticSeries(code, iso);
    data[iso] = points.map((p) => [p.year, p.value]);
  }
  return {
    indicator: mockIndicator(code),
    projectedFrom: code.startsWith("POPULATION_UN_") ? 2024 : null,
    vintages: [],
    data,
  };
}

export async function installApiMocks(page: Page) {
  await page.route("**/data/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const path = pathname.replace(/^\/data\/[^/]+\//, "");
    const body = staticDataResponse(path);
    return body ? json(route, body) : json(route, { error: "Not found" }, 404);
  });
}
