export type TargetMode = "growing" | "static";
export type ViewMode = "chart" | "table";
export type TemplateMode = "china" | "us" | "eu";

export interface ShareState {
	chaser: string;
	target: string;
	indicator: string;
	cg: number;
	tg: number;
	tmode: TargetMode;
	baseYear: number;
	view?: ViewMode;
	adjC?: boolean; // Chaser adjustment enabled (default: true)
	adjT?: boolean; // Target adjustment enabled (default: true)
	goal?: number; // "Catch up in N years" calculator (default: 25)
	ms?: boolean; // Show milestone markers (default: true)
	tpl?: TemplateMode; // Template path for implications (default: china)
	ih?: number; // Implications horizon years (default: 25)
}

export const DEFAULT_SHARE_STATE: ShareState = {
	chaser: "NGA",
	target: "IRL",
	indicator: "GDP_PCAP_PPP",
	cg: 0.035,
	tg: 0.015,
	tmode: "growing",
	baseYear: 2023,
	view: "chart",
	adjC: true,
	adjT: true,
	goal: 25,
	ms: true,
	tpl: "china",
	ih: 25,
};

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function round(value: number, step: number) {
	return Math.round(value / step) * step;
}

function parseIso3(value: string | null): string | null {
	if (!value) return null;
	const iso = value.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(iso) ? iso : null;
}

function parseIndicator(value: string | null): string | null {
	if (!value) return null;
	const code = value.trim().toUpperCase();
	return /^[A-Z0-9_]{2,64}$/.test(code) ? code : null;
}

function parseRate(value: string | null): number | null {
	if (!value) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function parseIntSafe(value: string | null): number | null {
	if (!value) return null;
	const n = Number.parseInt(value, 10);
	return Number.isFinite(n) ? n : null;
}

function parseTemplate(value: string | null): TemplateMode | null {
	if (!value) return null;
	const v = value.trim().toLowerCase();
	if (v === "china" || v === "us" || v === "eu") return v;
	return null;
}

export function parseShareStateFromSearch(
	search: string,
	defaults: ShareState = DEFAULT_SHARE_STATE,
): ShareState {
	const params = new URLSearchParams(
		search.startsWith("?") ? search : `?${search}`,
	);

	const tmodeRaw = params.get("tmode")?.toLowerCase();
	const tmode: TargetMode = tmodeRaw === "static" ? "static" : "growing";

	const chaser = parseIso3(params.get("chaser")) ?? defaults.chaser;
	const target = parseIso3(params.get("target")) ?? defaults.target;
	const indicator =
		parseIndicator(params.get("indicator")) ?? defaults.indicator;

	const cgRaw = parseRate(params.get("cg"));
	const tgRaw = parseRate(params.get("tg"));
	const baseYearRaw = parseIntSafe(params.get("baseYear"));
	const goalRaw = parseIntSafe(params.get("goal"));
	const ihRaw = parseIntSafe(params.get("ih"));

		const cg = round(clamp(cgRaw ?? defaults.cg, -0.1, 0.15), 0.001);
		const baseYear = clamp(baseYearRaw ?? defaults.baseYear, 1950, 2100);
		const goal = clamp(goalRaw ?? defaults.goal ?? 25, 1, 150);
		const ih = clamp(ihRaw ?? defaults.ih ?? 25, 1, 150);

	// Parse adjustment toggles ("0" = false, anything else or missing = true)
	const adjCRaw = params.get("adjC");
	const adjTRaw = params.get("adjT");
	const adjC = adjCRaw === "0" ? false : (defaults.adjC ?? true);
	const adjT = adjTRaw === "0" ? false : (defaults.adjT ?? true);
	const msRaw = params.get("ms");
	const ms = msRaw === "0" ? false : (defaults.ms ?? true);
	const tpl = parseTemplate(params.get("tpl")) ?? (defaults.tpl ?? "china");

	if (tmode === "static") {
		return {
			...defaults,
			chaser,
			target,
			indicator,
			cg,
			tg: 0,
			tmode,
			baseYear,
			view: params.get("view") === "table" ? "table" : "chart",
			adjC,
			adjT,
			goal,
			ms,
			tpl,
			ih,
		};
	}

		const tg = round(clamp(tgRaw ?? defaults.tg, -0.1, 0.15), 0.001);

	return {
		...defaults,
		chaser,
		target,
		indicator,
		cg,
		tg,
		tmode,
		baseYear,
		view: params.get("view") === "table" ? "table" : "chart",
		adjC,
		adjT,
		goal,
		ms,
		tpl,
		ih,
	};
}

export function toSearchParams(state: ShareState): URLSearchParams {
	const params = new URLSearchParams();
	params.set("chaser", state.chaser);
	params.set("target", state.target);
	params.set("indicator", state.indicator);
	params.set("cg", round(state.cg, 0.001).toFixed(3));
	params.set("tmode", state.tmode);
	params.set(
		"tg",
		state.tmode === "static" ? "0" : round(state.tg, 0.001).toFixed(3),
	);
	params.set("baseYear", String(state.baseYear));
	if (state.view && state.view !== "chart") params.set("view", state.view);
	// Only include adjustment params when false (non-default) to keep URLs clean
	if (state.adjC === false) params.set("adjC", "0");
	if (state.adjT === false) params.set("adjT", "0");
	if ((state.goal ?? 25) !== 25) params.set("goal", String(clamp(state.goal ?? 25, 1, 150)));
	if (state.ms === false) params.set("ms", "0");
	if ((state.tpl ?? "china") !== "china") params.set("tpl", state.tpl ?? "china");
	if ((state.ih ?? 25) !== 25) params.set("ih", String(clamp(state.ih ?? 25, 1, 150)));
	return params;
}

export function toSearchString(state: ShareState): string {
	const params = toSearchParams(state);
	const s = params.toString();
	return s ? `?${s}` : "";
}
