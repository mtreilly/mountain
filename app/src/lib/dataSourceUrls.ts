/**
 * Data source URL mappings for citation links
 *
 * Maps data sources to their original URLs for proper attribution
 */

export type DataSourceName =
	| "World Bank"
	| "UNDP"
	| "Our World in Data"
	| string;

/**
 * URL generators for each data source
 * Takes the source_code and returns a direct link to the data
 */
const DATA_SOURCE_URL_GENERATORS: Record<
	string,
	(sourceCode: string | null) => string | null
> = {
	"World Bank": (sourceCode) => {
		if (!sourceCode) return "https://data.worldbank.org";
		return `https://data.worldbank.org/indicator/${sourceCode}`;
	},

	UNDP: () => {
		return "https://hdr.undp.org/data-center/human-development-index";
	},

	"Our World in Data": (sourceCode) => {
		if (!sourceCode) return "https://ourworldindata.org";
		// OWID source codes are in format "owid-co2-data:co2_per_capita"
		// Extract the dataset and variable
		if (sourceCode.includes(":")) {
			const [dataset, variable] = sourceCode.split(":");
			if (dataset === "owid-co2-data") {
				return `https://github.com/owid/co2-data`;
			}
			return `https://ourworldindata.org/grapher/${variable}`;
		}
		return `https://ourworldindata.org/grapher/${sourceCode}`;
	},
};

/**
 * Get the URL for a data source
 */
export function getDataSourceUrl(
	source: string | null,
	sourceCode: string | null,
): string | null {
	if (!source) return null;

	const generator = DATA_SOURCE_URL_GENERATORS[source];
	if (generator) {
		return generator(sourceCode);
	}

	// Unknown source - return null
	return null;
}

/**
 * Get the base URL for a data source (without specific indicator)
 */
export function getDataSourceBaseUrl(source: string | null): string | null {
	if (!source) return null;

	const baseUrls: Record<string, string> = {
		"World Bank": "https://data.worldbank.org",
		UNDP: "https://hdr.undp.org/data-center",
		"Our World in Data": "https://ourworldindata.org",
	};

	return baseUrls[source] ?? null;
}

/**
 * Known World Bank indicator codes for common indicators
 * Used when source_code is not available in the indicator data
 */
export const WORLD_BANK_INDICATOR_CODES: Record<string, string> = {
	GDP_PCAP_PPP: "NY.GDP.PCAP.PP.KD",
	GDP_PCAP_USD: "NY.GDP.PCAP.CD",
	POPULATION: "SP.POP.TOTL",
	LIFE_EXPECT: "SP.DYN.LE00.IN",
	LITERACY: "SE.ADT.LITR.ZS",
	INTERNET: "IT.NET.USER.ZS",
	ENERGY_USE_PCAP: "EG.USE.PCAP.KG.OE",
	ELECTRICITY_USE_PCAP: "EG.USE.ELEC.KH.PC",
	ELECTRICITY_ACCESS_PCT: "EG.ELC.ACCS.ZS",
	RENEWABLE_ENERGY_PCT: "EG.FEC.RNEW.ZS",
	ENERGY_INTENSITY: "EG.EGY.PRIM.PP.KD",
	URBAN_POP_PCT: "SP.URB.TOTL.IN.ZS",
	AGRICULTURE_VA_PCT_GDP: "NV.AGR.TOTL.ZS",
	INDUSTRY_VA_PCT_GDP: "NV.IND.TOTL.ZS",
	MANUFACTURING_VA_PCT_GDP: "NV.IND.MANF.ZS",
	SERVICES_VA_PCT_GDP: "NV.SRV.TOTL.ZS",
	CAPITAL_FORMATION_PCT_GDP: "NE.GDI.FTOT.ZS",
	FERTILITY: "SP.DYN.TFRT.IN",
};

/**
 * Get World Bank URL for an indicator code
 */
export function getWorldBankUrl(indicatorCode: string): string | null {
	const wbCode = WORLD_BANK_INDICATOR_CODES[indicatorCode];
	if (wbCode) {
		return `https://data.worldbank.org/indicator/${wbCode}`;
	}
	return null;
}

/**
 * License information for data sources
 */
export const DATA_SOURCE_LICENSES: Record<string, { name: string; url: string }> = {
	"World Bank": {
		name: "CC-BY 4.0",
		url: "https://datacatalog.worldbank.org/public-licenses#cc-by",
	},
	UNDP: {
		name: "CC-BY 3.0 IGO",
		url: "https://hdr.undp.org/copyright-and-terms-use",
	},
	"Our World in Data": {
		name: "CC-BY 4.0",
		url: "https://ourworldindata.org/faqs#can-i-use-or-reproduce-your-data-visualizations",
	},
};

/**
 * Get license info for a data source
 */
export function getDataSourceLicense(
	source: string | null,
): { name: string; url: string } | null {
	if (!source) return null;
	return DATA_SOURCE_LICENSES[source] ?? null;
}
