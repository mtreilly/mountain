import type { Page, Route } from "@playwright/test";

const countries = [
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
    code: "LIFE_EXPECTANCY",
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
  LIFE_EXPECTANCY: {
    NGA: [{ year: 2023, value: 55.4 }],
    IRL: [{ year: 2023, value: 82.7 }],
    USA: [{ year: 2023, value: 77.5 }],
  },
  POPULATION: {
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

export async function installApiMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === "/api/countries") {
      return json(route, { data: countries });
    }

    if (pathname === "/api/indicators") {
      return json(route, { data: indicators });
    }

    if (pathname.startsWith("/api/data/")) {
      const indicator = pathname.replace("/api/data/", "").toUpperCase();
      const requested = (url.searchParams.get("countries") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const data: Record<string, Array<{ year: number; value: number }>> = {};
      for (const iso of requested) {
        data[iso] = seriesByIndicatorAndIso[indicator]?.[iso] || syntheticSeries(indicator, iso);
      }

      const indicatorInfo =
        indicators.find((i) => i.code === indicator) ||
        ({ code: indicator, name: indicator, unit: null, source: "World Bank" } as const);

      return json(route, {
        indicator: indicatorInfo,
        data,
      });
    }

    if (pathname === "/api/batch-data") {
      const requestedCountries = (url.searchParams.get("countries") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const requestedIndicators = (url.searchParams.get("indicators") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const data: Record<string, Record<string, Array<{ year: number; value: number }>>> = {};
      for (const code of requestedIndicators) {
        data[code] = {};
        for (const iso of requestedCountries) {
          data[code][iso] = seriesByIndicatorAndIso[code]?.[iso] || syntheticSeries(code, iso);
        }
      }

      const indicatorByCode: Record<string, unknown> = {};
      for (const code of requestedIndicators) {
        indicatorByCode[code] =
          indicators.find((i) => i.code === code) ||
          ({
            code,
            name: code,
            description: null,
            unit: null,
            source: "World Bank",
            category: "other",
          } as const);
      }

      return json(route, { data, indicators: indicatorByCode });
    }

    return json(route, { error: "Not found" }, 404);
  });
}
