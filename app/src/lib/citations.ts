import type { ShareState } from "./shareState";
import { toSearchString } from "./shareState";
import { getDataSourceUrl } from "./dataSourceUrls";

// Minimal indicator info needed for citations
interface IndicatorInfo {
	code: string;
	name: string;
	unit?: string | null;
	source?: string | null;
}

export type CitationFormat = "bibtex" | "apa" | "chicago" | "plaintext";

export interface CitationContext {
	// Tool info
	toolName: string;
	toolUrl: string;
	accessDate: Date;

	// Comparison context
	chaserName: string;
	chaserIso: string;
	targetName: string;
	targetIso: string;
	indicatorName: string;
	indicatorCode: string;

	// Data source
	dataSource: string | null;
	dataSourceCode: string | null;

	// Share state for permalink
	state: ShareState;
}

/**
 * Format a date for citations
 */
function formatDate(date: Date, format: CitationFormat): string {
	const year = date.getFullYear();
	const month = date.toLocaleString("en-US", { month: "long" });
	const day = date.getDate();

	switch (format) {
		case "bibtex":
			return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		case "apa":
			return `${month} ${day}, ${year}`;
		case "chicago":
			return `${month} ${day}, ${year}`;
		case "plaintext":
			return `${month} ${day}, ${year}`;
	}
}

/**
 * Escape special characters for BibTeX
 */
function escapeBibtex(str: string): string {
	return str
		.replace(/&/g, "\\&")
		.replace(/%/g, "\\%")
		.replace(/\$/g, "\\$")
		.replace(/#/g, "\\#")
		.replace(/_/g, "\\_")
		.replace(/{/g, "\\{")
		.replace(/}/g, "\\}");
}

/**
 * Generate a BibTeX key from context
 */
function generateBibtexKey(ctx: CitationContext): string {
	const year = ctx.accessDate.getFullYear();
	const chaser = ctx.chaserIso.toLowerCase();
	const target = ctx.targetIso.toLowerCase();
	return `convergence${year}${chaser}${target}`;
}

/**
 * Generate a BibTeX key for a data source
 */
function generateDataSourceBibtexKey(
	source: string,
	indicatorCode: string,
	year: number,
): string {
	const sourcePart = source.toLowerCase().replace(/\s+/g, "");
	const codePart = indicatorCode.toLowerCase().replace(/_/g, "");
	return `${sourcePart}${year}${codePart}`;
}

/**
 * Build the permalink URL for a comparison
 */
export function buildPermalink(toolUrl: string, state: ShareState): string {
	const search = toSearchString(state);
	// Add version param for URL schema stability
	const versionedSearch = search ? `${search}&v=1` : "?v=1";
	const [noHash, hash] = toolUrl.split("#", 2);
	const base = noHash.split("?", 2)[0];
	return `${base}${versionedSearch}${hash ? `#${hash}` : ""}`;
}

/**
 * Generate a tool citation in the specified format
 */
export function generateToolCitation(
	ctx: CitationContext,
	format: CitationFormat,
): string {
	const permalink = buildPermalink(ctx.toolUrl, ctx.state);
	const dateStr = formatDate(ctx.accessDate, format);
	const title = `${ctx.chaserName} to ${ctx.targetName}: ${ctx.indicatorName} convergence analysis`;

	switch (format) {
		case "bibtex": {
			const key = generateBibtexKey(ctx);
			return `@misc{${key},
  title = {${escapeBibtex(ctx.toolName)}: ${escapeBibtex(title)}},
  url = {${permalink}},
  note = {Interactive economic convergence visualization tool},
  urldate = {${dateStr}}
}`;
		}

		case "apa":
			return `${ctx.toolName}. (n.d.). ${title}. Retrieved ${dateStr}, from ${permalink}`;

		case "chicago":
			return `"${title}." ${ctx.toolName}. Accessed ${dateStr}. ${permalink}`;

		case "plaintext":
			return `${ctx.toolName} - ${title}
URL: ${permalink}
Accessed: ${dateStr}`;
	}
}

/**
 * Generate a data source citation in the specified format
 */
export function generateDataSourceCitation(
	source: string,
	sourceCode: string | null,
	indicatorName: string,
	indicatorCode: string,
	accessDate: Date,
	format: CitationFormat,
): string {
	const dateStr = formatDate(accessDate, format);
	const year = accessDate.getFullYear();
	const sourceUrl = getDataSourceUrl(source, sourceCode);

	switch (format) {
		case "bibtex": {
			const key = generateDataSourceBibtexKey(source, indicatorCode, year);
			const urlLine = sourceUrl ? `\n  url = {${sourceUrl}},` : "";
			return `@misc{${key},
  author = {{${escapeBibtex(source)}}},
  title = {${escapeBibtex(indicatorName)}},${urlLine}
  note = {${escapeBibtex(source)} data},
  urldate = {${dateStr}}
}`;
		}

		case "apa": {
			const urlPart = sourceUrl ? ` ${sourceUrl}` : "";
			return `${source}. (${year}). ${indicatorName} [Data set].${urlPart}`;
		}

		case "chicago": {
			const urlPart = sourceUrl ? ` ${sourceUrl}` : "";
			return `${source}. "${indicatorName}." Accessed ${dateStr}.${urlPart}`;
		}

		case "plaintext": {
			const urlPart = sourceUrl ? `\nURL: ${sourceUrl}` : "";
			const codePart = sourceCode ? ` (${sourceCode})` : "";
			return `Data Source: ${source} - ${indicatorName}${codePart}${urlPart}
Accessed: ${dateStr}`;
		}
	}
}

/**
 * Generate both tool and data source citations combined
 */
export function generateFullCitation(
	ctx: CitationContext,
	format: CitationFormat,
): string {
	const toolCitation = generateToolCitation(ctx, format);

	if (!ctx.dataSource) {
		return toolCitation;
	}

	const dataCitation = generateDataSourceCitation(
		ctx.dataSource,
		ctx.dataSourceCode,
		ctx.indicatorName,
		ctx.indicatorCode,
		ctx.accessDate,
		format,
	);

	const separator = format === "bibtex" ? "\n\n" : "\n\n";
	return `${toolCitation}${separator}${dataCitation}`;
}

/**
 * Create a CitationContext from app state
 */
export function createCitationContext(params: {
	state: ShareState;
	indicator: IndicatorInfo | null;
	chaserName: string;
	targetName: string;
	toolUrl?: string;
	accessDate?: Date;
}): CitationContext {
	const {
		state,
		indicator,
		chaserName,
		targetName,
		toolUrl = "https://convergence.example.com",
		accessDate = new Date(),
	} = params;

	return {
		toolName: "Convergence Explorer",
		toolUrl,
		accessDate,
		chaserName,
		chaserIso: state.chaser,
		targetName,
		targetIso: state.target,
		indicatorName: indicator?.name ?? state.indicator,
		indicatorCode: indicator?.code ?? state.indicator,
		dataSource: indicator?.source ?? null,
		dataSourceCode: getSourceCode(indicator),
		state,
	};
}

/**
 * Extract source_code from indicator (stored in description or as separate field)
 * This handles the current schema where source_code may be in the indicator
 */
function getSourceCode(indicator: IndicatorInfo | null): string | null {
	if (!indicator) return null;
	// The source_code field is stored in the database but not in the TypeScript type
	// For now, we can derive it from common patterns or return null
	// TODO: Add source_code to Indicator type when available
	return null;
}

/**
 * Get all citation formats for a context
 */
export function getAllCitationFormats(ctx: CitationContext): Record<CitationFormat, string> {
	return {
		bibtex: generateFullCitation(ctx, "bibtex"),
		apa: generateFullCitation(ctx, "apa"),
		chicago: generateFullCitation(ctx, "chicago"),
		plaintext: generateFullCitation(ctx, "plaintext"),
	};
}
