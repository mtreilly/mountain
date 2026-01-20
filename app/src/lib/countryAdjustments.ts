export interface CountryAdjustment {
	iso: string;
	indicators: string[];
	title: string;
	explanation: string;
	alternativeMetric: string;
	source?: string;
	adjustmentFactor: number;
}

/**
 * Countries with known GDP measurement quirks that significantly inflate
 * per-capita values due to structural economic factors.
 */
export const COUNTRY_ADJUSTMENTS: CountryAdjustment[] = [
	{
		iso: "IRL",
		indicators: ["GDP_PCAP_PPP", "GDP_PCAP_USD"],
		title: "Ireland's GDP is inflated",
		explanation:
			"Multinational corporations booking intellectual property and profits through Ireland inflate GDP by ~40%. GNI* (Modified Gross National Income) better reflects Irish residents' living standards.",
		alternativeMetric: "GNI* (Modified Gross National Income)",
		source: "Central Statistics Office Ireland",
		adjustmentFactor: 0.6,
	},
	{
		iso: "LUX",
		indicators: ["GDP_PCAP_PPP", "GDP_PCAP_USD"],
		title: "Luxembourg's GDP is inflated",
		explanation:
			"Nearly half of Luxembourg's workforce commutes from neighboring countries, contributing to GDP without being counted in population. This inflates per-capita figures by ~45%.",
		alternativeMetric: "GNI per capita",
		source: "STATEC Luxembourg",
		adjustmentFactor: 0.55,
	},
	{
		iso: "QAT",
		indicators: ["GDP_PCAP_PPP", "GDP_PCAP_USD"],
		title: "Qatar's GDP overstates resident welfare",
		explanation:
			"Over 85% of Qatar's population are non-citizen workers with limited access to the country's wealth. GDP per capita significantly overstates the economic welfare of residents.",
		alternativeMetric: "Citizen-adjusted GNI",
		source: "Qatar Planning and Statistics Authority",
		adjustmentFactor: 0.35,
	},
	{
		iso: "ARE",
		indicators: ["GDP_PCAP_PPP", "GDP_PCAP_USD"],
		title: "UAE's GDP overstates resident welfare",
		explanation:
			"Approximately 88% of UAE's population are expatriate workers. GDP per capita doesn't reflect the significant income inequality between citizens and the large foreign workforce.",
		alternativeMetric: "Citizen-adjusted GNI",
		source: "Federal Competitiveness and Statistics Centre",
		adjustmentFactor: 0.4,
	},
	{
		iso: "SGP",
		indicators: ["GDP_PCAP_PPP", "GDP_PCAP_USD"],
		title: "Singapore's GDP includes foreign factors",
		explanation:
			"Singapore's role as a financial hub and reliance on foreign workers means GDP slightly overstates resident income, though less severely than other small financial centers.",
		alternativeMetric: "GNI per capita",
		source: "Singapore Department of Statistics",
		adjustmentFactor: 0.85,
	},
];

/**
 * Find adjustment config for a country+indicator combination
 */
export function getAdjustment(
	iso: string,
	indicatorCode: string,
): CountryAdjustment | null {
	return (
		COUNTRY_ADJUSTMENTS.find(
			(adj) => adj.iso === iso && adj.indicators.includes(indicatorCode),
		) ?? null
	);
}

/**
 * Apply adjustment factor to a value if adjustment is enabled
 */
export function applyAdjustment(
	value: number,
	adjustment: CountryAdjustment | null,
	useAdjusted: boolean,
): number {
	if (!adjustment || !useAdjusted) {
		return value;
	}
	return value * adjustment.adjustmentFactor;
}
