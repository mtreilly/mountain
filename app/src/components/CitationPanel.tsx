import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
// Minimal indicator info needed for citations
interface IndicatorInfo {
	code: string;
	name: string;
	unit?: string | null;
	source?: string | null;
}
import type { ShareState } from "../lib/shareState";
import {
	type CitationFormat,
	createCitationContext,
	generateToolCitation,
	generateDataSourceCitation,
} from "../lib/citations";
import {
	getDataSourceUrl,
	getDataSourceLicense,
	WORLD_BANK_INDICATOR_CODES,
} from "../lib/dataSourceUrls";
import { copyTextToClipboard } from "../lib/clipboard";

const FORMATS: { key: CitationFormat; label: string }[] = [
	{ key: "bibtex", label: "BibTeX" },
	{ key: "apa", label: "APA" },
	{ key: "chicago", label: "Chicago" },
	{ key: "plaintext", label: "Plain" },
];

interface CitationPanelProps {
	isOpen: boolean;
	onClose: () => void;
	shareState: ShareState;
	indicator: IndicatorInfo | null;
	chaserName: string;
	targetName: string;
}

export function CitationPanel({
	isOpen,
	onClose,
	shareState,
	indicator,
	chaserName,
	targetName,
}: CitationPanelProps) {
	const modalRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const [selectedFormat, setSelectedFormat] = useState<CitationFormat>("bibtex");
	const formatRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const handleClose = useCallback(() => {
		onClose();
	}, [onClose]);

	// Manage focus when opening/closing
	useEffect(() => {
		if (!isOpen) return;
		const prev = document.activeElement as HTMLElement | null;
		queueMicrotask(() => closeButtonRef.current?.focus());
		return () => {
			if (prev && prev.isConnected && prev.tagName !== "BODY" && prev.tagName !== "HTML") {
				prev.focus();
				return;
			}
			document.querySelector<HTMLButtonElement>('button[aria-label="More options"]')?.focus();
		};
	}, [isOpen]);

	// Handle ESC key and click outside
	useEffect(() => {
		if (!isOpen) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleClose();
				return;
			}

			if (e.key === "Tab") {
				const root = modalRef.current;
				if (!root) return;
				const focusables = Array.from(
					root.querySelectorAll<HTMLElement>(
						'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
					),
				).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

				if (focusables.length === 0) {
					e.preventDefault();
					return;
				}

				const first = focusables[0];
				const last = focusables[focusables.length - 1];
				const active = document.activeElement as HTMLElement | null;

				if (active && !root.contains(active)) {
					e.preventDefault();
					(e.shiftKey ? last : first).focus();
					return;
				}

				if (!e.shiftKey && active === last) {
					e.preventDefault();
					first.focus();
				} else if (e.shiftKey && active === first) {
					e.preventDefault();
					last.focus();
				}

				return;
			}

			// Arrow key navigation between format tabs
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				const currentIndex = FORMATS.findIndex((f) => f.key === selectedFormat);
				if (currentIndex === -1) return;

				let newIndex: number;
				if (e.key === "ArrowLeft") {
					newIndex = currentIndex === 0 ? FORMATS.length - 1 : currentIndex - 1;
				} else {
					newIndex = currentIndex === FORMATS.length - 1 ? 0 : currentIndex + 1;
				}

				setSelectedFormat(FORMATS[newIndex].key);
				formatRefs.current[newIndex]?.focus();
			}
		};

		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (!target) return;
			if (modalRef.current?.contains(target)) return;
			handleClose();
		};

		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown, true);
		document.body.style.overflow = "hidden";

		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.body.style.overflow = "";
		};
	}, [isOpen, handleClose, selectedFormat]);

	// Generate citations
	const citationContext = useMemo(() => {
		if (typeof window === "undefined") return null;
			return createCitationContext({
				state: shareState,
				indicator,
				chaserName,
				targetName,
				toolUrl: `${window.location.origin}${window.location.pathname}`,
				accessDate: new Date(),
			});
		}, [shareState, indicator, chaserName, targetName]);

	const toolCitation = useMemo(() => {
		if (!citationContext) return "";
		return generateToolCitation(citationContext, selectedFormat);
	}, [citationContext, selectedFormat]);

	const dataSourceCitation = useMemo(() => {
		if (!indicator?.source) return "";
		const sourceCode =
			indicator.source === "World Bank"
				? WORLD_BANK_INDICATOR_CODES[indicator.code] ?? null
				: null;
		return generateDataSourceCitation(
			indicator.source,
			sourceCode,
			indicator.name,
			indicator.code,
			new Date(),
			selectedFormat,
		);
	}, [indicator, selectedFormat]);

	const dataSourceUrl = useMemo(() => {
		if (!indicator?.source) return null;
		const sourceCode =
			indicator.source === "World Bank"
				? WORLD_BANK_INDICATOR_CODES[indicator.code] ?? null
				: null;
		return getDataSourceUrl(indicator.source, sourceCode);
	}, [indicator]);

	const license = useMemo(() => {
		return getDataSourceLicense(indicator?.source ?? null);
	}, [indicator]);

	const handleCopyToolCitation = useCallback(async () => {
		await copyTextToClipboard(toolCitation);
		toast.success("Citation copied to clipboard");
	}, [toolCitation]);

	const handleCopyDataCitation = useCallback(async () => {
		await copyTextToClipboard(dataSourceCitation);
		toast.success("Data source citation copied");
	}, [dataSourceCitation]);

	const handleCopyBoth = useCallback(async () => {
		const combined = dataSourceCitation
			? `${toolCitation}\n\n${dataSourceCitation}`
			: toolCitation;
		await copyTextToClipboard(combined);
		toast.success("Both citations copied");
	}, [toolCitation, dataSourceCitation]);

	if (!isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
			<div
				ref={modalRef}
				role="dialog"
				aria-modal="true"
				aria-label="Cite this comparison"
				className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
			>
				{/* Header */}
				<div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
					<div>
						<h2 className="text-lg font-semibold text-ink">Cite This</h2>
						<p className="text-sm text-ink-muted">
							{chaserName} → {targetName}
						</p>
					</div>
					<button
						type="button"
						onClick={handleClose}
						ref={closeButtonRef}
						className="p-2 rounded-lg hover:bg-surface transition-default"
						aria-label="Close citation panel"
					>
						<svg
							className="w-5 h-5 text-ink-muted"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				<div className="p-4 space-y-6">
					{/* Format selector tabs */}
					<div>
						<label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
							Format
						</label>
						<div
							className="flex gap-1 p-1 rounded-lg bg-surface-sunken"
							role="tablist"
							aria-label="Citation format"
						>
							{FORMATS.map((format, index) => (
								<button
									key={format.key}
									ref={(el) => {
										formatRefs.current[index] = el;
									}}
									type="button"
									role="tab"
									aria-selected={selectedFormat === format.key}
									tabIndex={selectedFormat === format.key ? 0 : -1}
									onClick={() => setSelectedFormat(format.key)}
									className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-default ${
										selectedFormat === format.key
											? "bg-surface-raised text-ink shadow-sm"
											: "text-ink-muted hover:text-ink hover:bg-surface/50"
									}`}
								>
									{format.label}
								</button>
							))}
						</div>
						<p className="mt-2 text-xs text-ink-faint">
							Use arrow keys to switch formats
						</p>
					</div>

					{/* Tool citation */}
					<section>
						<h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
							Tool Citation
						</h3>
						<div className="relative">
							<pre
								className="p-3 rounded-lg bg-surface-sunken border border-surface text-xs text-ink overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed"
								aria-label="Tool citation text"
							>
								{toolCitation}
							</pre>
							<button
								type="button"
								onClick={handleCopyToolCitation}
								className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded bg-surface-raised border border-surface text-ink hover:bg-surface transition-default inline-flex items-center gap-1"
							>
								<svg
									className="w-3 h-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
									/>
								</svg>
								Copy
							</button>
						</div>
					</section>

					{/* Data source citation */}
					{indicator?.source && (
						<section>
							<h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
								Data Source
							</h3>
							<div className="p-4 rounded-lg border border-surface bg-surface space-y-3">
								{/* Source info */}
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="text-sm font-medium text-ink">
											{indicator.source}
										</div>
										<div className="text-xs text-ink-muted mt-0.5">
											{indicator.name}
										</div>
										{indicator.source === "World Bank" &&
											WORLD_BANK_INDICATOR_CODES[indicator.code] && (
											<div className="text-xs text-ink-faint mt-1 font-mono">
												{WORLD_BANK_INDICATOR_CODES[indicator.code]}
											</div>
										)}
									</div>
									{dataSourceUrl && (
										<a
											href={dataSourceUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="shrink-0 px-2 py-1 text-xs font-medium rounded border border-surface bg-surface-raised text-ink hover:bg-surface transition-default inline-flex items-center gap-1"
										>
											View
											<svg
												className="w-3 h-3"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>
									)}
								</div>

								{/* Data citation */}
								<div className="relative">
									<pre
										className="p-3 rounded-lg bg-surface-sunken border border-surface text-xs text-ink overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed"
										aria-label="Data source citation text"
									>
										{dataSourceCitation}
									</pre>
									<button
										type="button"
										onClick={handleCopyDataCitation}
										className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded bg-surface-raised border border-surface text-ink hover:bg-surface transition-default inline-flex items-center gap-1"
									>
										<svg
											className="w-3 h-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
											/>
										</svg>
										Copy
									</button>
								</div>
							</div>
						</section>
					)}

					{/* License info */}
					<section>
						<h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
							License
						</h3>
						<div className="p-4 rounded-lg border border-surface bg-surface space-y-2">
							<div className="flex items-center gap-2">
								<svg
									className="w-4 h-4 text-ink-muted shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
									/>
								</svg>
								<span className="text-sm text-ink">
									Visualizations:{" "}
									<span className="font-medium">CC-BY 4.0</span>
								</span>
							</div>
							{license && (
								<div className="flex items-center gap-2">
									<svg
										className="w-4 h-4 text-ink-muted shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
										/>
									</svg>
									<span className="text-sm text-ink">
										Data:{" "}
										<a
											href={license.url}
											target="_blank"
											rel="noopener noreferrer"
											className="font-medium text-chaser hover:underline"
										>
											{license.name}
										</a>
									</span>
								</div>
							)}
							<p className="text-xs text-ink-faint mt-2">
								Attribution required when sharing or publishing.
							</p>
						</div>
					</section>

					{/* Copy both button */}
					<div className="pt-2">
						<button
							type="button"
							onClick={handleCopyBoth}
							className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)] transition-default inline-flex items-center justify-center gap-2"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
								/>
							</svg>
							Copy All Citations
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
