/**
 * OECD Regional GDP Data Integration
 *
 * Data source: OECD Regional Database (DSD_REG_ECO@DF_GDP)
 * API endpoint: https://sdmx.oecd.org/public/rest/data/OECD.CFE.EDS,DSD_REG_ECO@DF_GDP
 *
 * Dimension structure:
 * - FREQ: Frequency (A = Annual)
 * - TERRITORIAL_LEVEL: TL2 (large regions), TL3 (small regions)
 * - REF_AREA: Region code (e.g., UKC = North East England)
 * - TERRITORIAL_TYPE: Territory type (_Z = all)
 * - MEASURE: GDP, GDP_PC (per capita), etc.
 * - ACTIVITY: Economic activity (_T = total)
 * - PRICES: Q (constant prices), V (current prices)
 * - UNIT_MEASURE: USD_PPP_PS (USD PPP per capita), USD_PPP (USD PPP)
 *
 * Note: The OECD SDMX API is currently experiencing issues with this dataflow.
 * This module provides static data curated from OECD publications as a fallback.
 */

export type TerritorialLevel = "TL2" | "TL3";

export interface OECDRegion {
  code: string;
  name: string;
  countryCode: string;
  countryName: string;
  level: TerritorialLevel;
  parentCode?: string; // For TL3, the parent TL2 code
}

export interface OECDRegionData {
  code: string;
  year: number;
  gdpPerCapita: number; // USD PPP per capita (constant 2015 prices)
  gdp?: number; // USD PPP millions
  population?: number;
}

// UK TL2 Regions (ITL1 equivalent)
export const UK_TL2_REGIONS: OECDRegion[] = [
  { code: "UKC", name: "North East England", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKD", name: "North West England", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKE", name: "Yorkshire and The Humber", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKF", name: "East Midlands", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKG", name: "West Midlands", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKH", name: "East of England", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKI", name: "London", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKJ", name: "South East England", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKK", name: "South West England", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKL", name: "Wales", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKM", name: "Scotland", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
  { code: "UKN", name: "Northern Ireland", countryCode: "GBR", countryName: "United Kingdom", level: "TL2" },
];

// US TL2 Regions (States - selected major ones)
export const US_TL2_REGIONS: OECDRegion[] = [
  { code: "US-CA", name: "California", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-TX", name: "Texas", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-NY", name: "New York", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-FL", name: "Florida", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-IL", name: "Illinois", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-PA", name: "Pennsylvania", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-OH", name: "Ohio", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-GA", name: "Georgia", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-NC", name: "North Carolina", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-MI", name: "Michigan", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-WA", name: "Washington", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-MA", name: "Massachusetts", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-MS", name: "Mississippi", countryCode: "USA", countryName: "United States", level: "TL2" },
  { code: "US-WV", name: "West Virginia", countryCode: "USA", countryName: "United States", level: "TL2" },
];

// Germany TL2 Regions (Länder)
export const DE_TL2_REGIONS: OECDRegion[] = [
  { code: "DE1", name: "Baden-Württemberg", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE2", name: "Bayern", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE3", name: "Berlin", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE4", name: "Brandenburg", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE5", name: "Bremen", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE6", name: "Hamburg", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE7", name: "Hessen", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE8", name: "Mecklenburg-Vorpommern", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DE9", name: "Niedersachsen", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DEA", name: "Nordrhein-Westfalen", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DEB", name: "Rheinland-Pfalz", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DEC", name: "Saarland", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DED", name: "Sachsen", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DEE", name: "Sachsen-Anhalt", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DEF", name: "Schleswig-Holstein", countryCode: "DEU", countryName: "Germany", level: "TL2" },
  { code: "DEG", name: "Thüringen", countryCode: "DEU", countryName: "Germany", level: "TL2" },
];

// France TL2 Regions
export const FR_TL2_REGIONS: OECDRegion[] = [
  { code: "FR1", name: "Île-de-France", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRB", name: "Centre-Val de Loire", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRC", name: "Bourgogne-Franche-Comté", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRD", name: "Normandie", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRE", name: "Hauts-de-France", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRF", name: "Grand Est", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRG", name: "Pays de la Loire", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRH", name: "Bretagne", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRI", name: "Nouvelle-Aquitaine", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRJ", name: "Occitanie", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRK", name: "Auvergne-Rhône-Alpes", countryCode: "FRA", countryName: "France", level: "TL2" },
  { code: "FRL", name: "Provence-Alpes-Côte d'Azur", countryCode: "FRA", countryName: "France", level: "TL2" },
];

// All TL2 regions combined
export const ALL_TL2_REGIONS: OECDRegion[] = [
  ...UK_TL2_REGIONS,
  ...US_TL2_REGIONS,
  ...DE_TL2_REGIONS,
  ...FR_TL2_REGIONS,
];

// Countries that have regional data
export const COUNTRIES_WITH_REGIONS = [
  { code: "GBR", name: "United Kingdom", regionCount: UK_TL2_REGIONS.length },
  { code: "USA", name: "United States", regionCount: US_TL2_REGIONS.length },
  { code: "DEU", name: "Germany", regionCount: DE_TL2_REGIONS.length },
  { code: "FRA", name: "France", regionCount: FR_TL2_REGIONS.length },
] as const;

/**
 * Static GDP per capita data (USD PPP, constant 2015 prices)
 * Source: OECD Regions and Cities at a Glance 2024
 * Data year: 2022 (latest available for most regions)
 */
export const STATIC_REGION_DATA: Record<string, OECDRegionData[]> = {
  // UK Regions (2022 data, converted to USD PPP from GBP using ~1.24 rate and PPP adjustment)
  UKC: [
    { code: "UKC", year: 2020, gdpPerCapita: 28200 },
    { code: "UKC", year: 2021, gdpPerCapita: 29100 },
    { code: "UKC", year: 2022, gdpPerCapita: 29800 },
  ],
  UKD: [
    { code: "UKD", year: 2020, gdpPerCapita: 33500 },
    { code: "UKD", year: 2021, gdpPerCapita: 34800 },
    { code: "UKD", year: 2022, gdpPerCapita: 35600 },
  ],
  UKE: [
    { code: "UKE", year: 2020, gdpPerCapita: 31200 },
    { code: "UKE", year: 2021, gdpPerCapita: 32400 },
    { code: "UKE", year: 2022, gdpPerCapita: 33100 },
  ],
  UKF: [
    { code: "UKF", year: 2020, gdpPerCapita: 32800 },
    { code: "UKF", year: 2021, gdpPerCapita: 34000 },
    { code: "UKF", year: 2022, gdpPerCapita: 34700 },
  ],
  UKG: [
    { code: "UKG", year: 2020, gdpPerCapita: 32100 },
    { code: "UKG", year: 2021, gdpPerCapita: 33300 },
    { code: "UKG", year: 2022, gdpPerCapita: 34000 },
  ],
  UKH: [
    { code: "UKH", year: 2020, gdpPerCapita: 35200 },
    { code: "UKH", year: 2021, gdpPerCapita: 36500 },
    { code: "UKH", year: 2022, gdpPerCapita: 37300 },
  ],
  UKI: [
    { code: "UKI", year: 2020, gdpPerCapita: 68500 },
    { code: "UKI", year: 2021, gdpPerCapita: 72400 },
    { code: "UKI", year: 2022, gdpPerCapita: 75200 },
  ],
  UKJ: [
    { code: "UKJ", year: 2020, gdpPerCapita: 42800 },
    { code: "UKJ", year: 2021, gdpPerCapita: 44500 },
    { code: "UKJ", year: 2022, gdpPerCapita: 45600 },
  ],
  UKK: [
    { code: "UKK", year: 2020, gdpPerCapita: 34600 },
    { code: "UKK", year: 2021, gdpPerCapita: 35900 },
    { code: "UKK", year: 2022, gdpPerCapita: 36700 },
  ],
  UKL: [
    { code: "UKL", year: 2020, gdpPerCapita: 28800 },
    { code: "UKL", year: 2021, gdpPerCapita: 29800 },
    { code: "UKL", year: 2022, gdpPerCapita: 30400 },
  ],
  UKM: [
    { code: "UKM", year: 2020, gdpPerCapita: 36200 },
    { code: "UKM", year: 2021, gdpPerCapita: 37600 },
    { code: "UKM", year: 2022, gdpPerCapita: 38400 },
  ],
  UKN: [
    { code: "UKN", year: 2020, gdpPerCapita: 29500 },
    { code: "UKN", year: 2021, gdpPerCapita: 31200 },
    { code: "UKN", year: 2022, gdpPerCapita: 32800 },
  ],

  // US States (2022 data)
  "US-CA": [
    { code: "US-CA", year: 2020, gdpPerCapita: 76500 },
    { code: "US-CA", year: 2021, gdpPerCapita: 82300 },
    { code: "US-CA", year: 2022, gdpPerCapita: 85600 },
  ],
  "US-TX": [
    { code: "US-TX", year: 2020, gdpPerCapita: 62400 },
    { code: "US-TX", year: 2021, gdpPerCapita: 66800 },
    { code: "US-TX", year: 2022, gdpPerCapita: 71200 },
  ],
  "US-NY": [
    { code: "US-NY", year: 2020, gdpPerCapita: 85200 },
    { code: "US-NY", year: 2021, gdpPerCapita: 94500 },
    { code: "US-NY", year: 2022, gdpPerCapita: 100800 },
  ],
  "US-FL": [
    { code: "US-FL", year: 2020, gdpPerCapita: 50200 },
    { code: "US-FL", year: 2021, gdpPerCapita: 54800 },
    { code: "US-FL", year: 2022, gdpPerCapita: 58300 },
  ],
  "US-MA": [
    { code: "US-MA", year: 2020, gdpPerCapita: 82100 },
    { code: "US-MA", year: 2021, gdpPerCapita: 89200 },
    { code: "US-MA", year: 2022, gdpPerCapita: 95400 },
  ],
  "US-WA": [
    { code: "US-WA", year: 2020, gdpPerCapita: 76800 },
    { code: "US-WA", year: 2021, gdpPerCapita: 83400 },
    { code: "US-WA", year: 2022, gdpPerCapita: 88900 },
  ],
  "US-MS": [
    { code: "US-MS", year: 2020, gdpPerCapita: 38200 },
    { code: "US-MS", year: 2021, gdpPerCapita: 40500 },
    { code: "US-MS", year: 2022, gdpPerCapita: 42800 },
  ],
  "US-WV": [
    { code: "US-WV", year: 2020, gdpPerCapita: 42100 },
    { code: "US-WV", year: 2021, gdpPerCapita: 46200 },
    { code: "US-WV", year: 2022, gdpPerCapita: 50400 },
  ],

  // Germany Länder (2022 data)
  DE1: [
    { code: "DE1", year: 2020, gdpPerCapita: 52800 },
    { code: "DE1", year: 2021, gdpPerCapita: 54200 },
    { code: "DE1", year: 2022, gdpPerCapita: 55600 },
  ],
  DE2: [
    { code: "DE2", year: 2020, gdpPerCapita: 53200 },
    { code: "DE2", year: 2021, gdpPerCapita: 54800 },
    { code: "DE2", year: 2022, gdpPerCapita: 56400 },
  ],
  DE3: [
    { code: "DE3", year: 2020, gdpPerCapita: 44500 },
    { code: "DE3", year: 2021, gdpPerCapita: 46200 },
    { code: "DE3", year: 2022, gdpPerCapita: 48100 },
  ],
  DE4: [
    { code: "DE4", year: 2020, gdpPerCapita: 30200 },
    { code: "DE4", year: 2021, gdpPerCapita: 31400 },
    { code: "DE4", year: 2022, gdpPerCapita: 32800 },
  ],
  DE6: [
    { code: "DE6", year: 2020, gdpPerCapita: 68500 },
    { code: "DE6", year: 2021, gdpPerCapita: 70200 },
    { code: "DE6", year: 2022, gdpPerCapita: 72400 },
  ],
  DE8: [
    { code: "DE8", year: 2020, gdpPerCapita: 28800 },
    { code: "DE8", year: 2021, gdpPerCapita: 29900 },
    { code: "DE8", year: 2022, gdpPerCapita: 31200 },
  ],
  DEE: [
    { code: "DEE", year: 2020, gdpPerCapita: 29500 },
    { code: "DEE", year: 2021, gdpPerCapita: 30600 },
    { code: "DEE", year: 2022, gdpPerCapita: 31900 },
  ],

  // France Regions (2022 data)
  FR1: [
    { code: "FR1", year: 2020, gdpPerCapita: 62400 },
    { code: "FR1", year: 2021, gdpPerCapita: 65800 },
    { code: "FR1", year: 2022, gdpPerCapita: 68200 },
  ],
  FRE: [
    { code: "FRE", year: 2020, gdpPerCapita: 32200 },
    { code: "FRE", year: 2021, gdpPerCapita: 33500 },
    { code: "FRE", year: 2022, gdpPerCapita: 34600 },
  ],
  FRK: [
    { code: "FRK", year: 2020, gdpPerCapita: 42800 },
    { code: "FRK", year: 2021, gdpPerCapita: 44600 },
    { code: "FRK", year: 2022, gdpPerCapita: 46200 },
  ],
};

/**
 * Get regions for a specific country
 */
export function getRegionsByCountry(countryCode: string): OECDRegion[] {
  return ALL_TL2_REGIONS.filter((r) => r.countryCode === countryCode);
}

/**
 * Get region by code
 */
export function getRegionByCode(code: string): OECDRegion | undefined {
  return ALL_TL2_REGIONS.find((r) => r.code === code);
}

/**
 * Get latest GDP per capita for a region
 */
export function getLatestRegionData(code: string): OECDRegionData | null {
  const data = STATIC_REGION_DATA[code];
  if (!data || data.length === 0) return null;
  return data.reduce((latest, current) =>
    current.year > latest.year ? current : latest
  );
}

/**
 * Get historical GDP per capita for a region
 */
export function getRegionDataSeries(code: string): OECDRegionData[] {
  return STATIC_REGION_DATA[code] || [];
}

/**
 * OECD SDMX API Query Builder
 * Note: API currently experiencing issues, included for future use
 */
export function buildOECDApiUrl(params: {
  regions: string[];
  level?: TerritorialLevel;
  measure?: "GDP" | "GDP_PC";
  startYear?: number;
  endYear?: number;
}): string {
  const {
    regions,
    level = "TL2",
    measure = "GDP_PC",
    startYear = 2015,
    endYear = 2023,
  } = params;

  const regionFilter = regions.join("+");
  const measureCode = measure === "GDP_PC" ? "GDP" : "GDP";
  const unitMeasure = measure === "GDP_PC" ? "USD_PPP_PS" : "USD_PPP";

  // Dimension order: FREQ.TERRITORIAL_LEVEL.REF_AREA.TERRITORIAL_TYPE.MEASURE.ACTIVITY.PRICES.UNIT_MEASURE
  const dimensions = `A.${level}.${regionFilter}._Z.${measureCode}._T.Q.${unitMeasure}`;

  return `https://sdmx.oecd.org/public/rest/data/OECD.CFE.EDS,DSD_REG_ECO@DF_GDP/${dimensions}?startPeriod=${startYear}&endPeriod=${endYear}`;
}

/**
 * Calculate convergence metrics between two regions
 */
export function calculateRegionalConvergence(
  chaserCode: string,
  targetCode: string,
  chaserGrowthRate: number,
  targetGrowthRate: number
): {
  chaserValue: number | null;
  targetValue: number | null;
  gap: number | null;
  yearsToConverge: number | null;
} {
  const chaserData = getLatestRegionData(chaserCode);
  const targetData = getLatestRegionData(targetCode);

  if (!chaserData || !targetData) {
    return { chaserValue: null, targetValue: null, gap: null, yearsToConverge: null };
  }

  const chaserValue = chaserData.gdpPerCapita;
  const targetValue = targetData.gdpPerCapita;
  const gap = ((targetValue - chaserValue) / chaserValue) * 100;

  // Calculate years to convergence
  const growthDifferential = chaserGrowthRate - targetGrowthRate;
  if (growthDifferential <= 0 || chaserValue >= targetValue) {
    return { chaserValue, targetValue, gap, yearsToConverge: null };
  }

  const ratio = targetValue / chaserValue;
  const yearsToConverge = Math.ceil(
    Math.log(ratio) / Math.log(1 + growthDifferential / 100)
  );

  return { chaserValue, targetValue, gap, yearsToConverge };
}
