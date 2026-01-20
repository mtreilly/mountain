/**
 * Fetch country and indicator data from World Bank API
 * Generates SQL for import into D1
 *
 * Usage: npx tsx scripts/fetch-worldbank.ts > data-import.sql
 * Then:  npx wrangler d1 execute convergence-db --local --file=./data-import.sql
 */

const WORLD_BANK_API = "https://api.worldbank.org/v2";

interface WBCountry {
  id: string;
  iso2Code: string;
  name: string;
  region: { value: string };
  incomeLevel: { value: string };
}

interface WBDataPoint {
  country: { id: string; value: string };
  date: string;
  value: number | null;
}

// Indicators to fetch
const INDICATORS = [
  { code: "NY.GDP.PCAP.PP.KD", name: "GDP_PCAP_PPP" },
  { code: "SP.POP.TOTL", name: "POPULATION" },
  { code: "SP.DYN.LE00.IN", name: "LIFE_EXPECT" },
  { code: "IT.NET.USER.ZS", name: "INTERNET" },
  { code: "SP.DYN.TFRT.IN", name: "FERTILITY" },
];

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

async function fetchCountries(): Promise<WBCountry[]> {
  console.error("Fetching countries...");

  // World Bank API returns paginated results, get all at once
  const url = `${WORLD_BANK_API}/country?format=json&per_page=300`;
  const [, countries] = await fetchJSON<[unknown, WBCountry[]]>(url);

  // Filter to actual countries (exclude aggregates like "World", "EU", etc.)
  const realCountries = countries.filter(
    (c) =>
      c.region.value !== "Aggregates" &&
      c.iso2Code.length === 2 &&
      c.id.length === 3
  );

  console.error(`Found ${realCountries.length} countries`);
  return realCountries;
}

async function fetchIndicatorData(
  indicatorCode: string,
  startYear: number = 1990,
  endYear: number = 2023
): Promise<WBDataPoint[]> {
  console.error(`Fetching ${indicatorCode} data...`);

  const url = `${WORLD_BANK_API}/country/all/indicator/${indicatorCode}?format=json&date=${startYear}:${endYear}&per_page=20000`;
  const [, data] = await fetchJSON<[unknown, WBDataPoint[] | null]>(url);

  if (!data) {
    console.error(`No data for ${indicatorCode}`);
    return [];
  }

  // Filter out null values
  const validData = data.filter((d) => d.value !== null);
  console.error(`Got ${validData.length} data points for ${indicatorCode}`);
  if (validData.length > 0) {
    console.error(`  Sample data point: country.id="${validData[0].country.id}", date="${validData[0].date}", value=${validData[0].value}`);
  }

  return validData;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function main() {
  const countries = await fetchCountries();

  // Generate country inserts
  console.log("-- Countries");
  console.log("DELETE FROM countries WHERE id > 0;");

  for (const country of countries) {
    const region = escapeSQL(country.region.value);
    const name = escapeSQL(country.name);
    const income = escapeSQL(country.incomeLevel.value);

    console.log(
      `INSERT OR REPLACE INTO countries (iso_alpha3, iso_alpha2, name, region, income_group) VALUES ('${country.id}', '${country.iso2Code}', '${name}', '${region}', '${income}');`
    );
  }

  // Create maps for lookup - API data uses ISO2 codes
  const countryByIso3 = new Map(countries.map((c) => [c.id, c]));
  const countryByIso2 = new Map(countries.map((c) => [c.iso2Code, c]));
  console.error(`Country maps: ${countryByIso3.size} by ISO3, ${countryByIso2.size} by ISO2`);

  // Fetch and generate data for each indicator
  for (const indicator of INDICATORS) {
    console.log(`\n-- ${indicator.name} data`);

    const data = await fetchIndicatorData(indicator.code);

    // Group by country (ISO3) to reduce queries
    // API data uses ISO2 codes, so we need to look up by ISO2 and store by ISO3
    const byCountry = new Map<string, WBDataPoint[]>();
    let skipped = 0;
    for (const point of data) {
      const countryCode = point.country.id;
      // Try to find country by ISO2 first (most common), then ISO3
      const country = countryByIso2.get(countryCode) || countryByIso3.get(countryCode);

      if (!country) {
        skipped++;
        continue; // Skip aggregates or unknown
      }

      const iso3 = country.id;
      if (!byCountry.has(iso3)) {
        byCountry.set(iso3, []);
      }
      byCountry.get(iso3)!.push(point);
    }
    console.error(`  Grouped into ${byCountry.size} countries, skipped ${skipped} aggregate entries`);

    for (const [iso3, points] of byCountry) {
      for (const point of points) {
        const year = parseInt(point.date);
        const value = point.value;

        console.log(
          `INSERT OR REPLACE INTO data_points (country_id, indicator_id, year, value) ` +
            `SELECT c.id, i.id, ${year}, ${value} ` +
            `FROM countries c, indicators i ` +
            `WHERE c.iso_alpha3 = '${iso3}' AND i.code = '${indicator.name}';`
        );
      }
    }

    // Small delay to be nice to the API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.error("\nDone! Pipe output to a .sql file and import with wrangler.");
}

main().catch(console.error);
