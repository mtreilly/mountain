import { getDataSourceBaseUrl } from "../lib/dataSourceUrls";

export function AppFooter({
	comparisonMode = "countries",
	countriesCount,
	regionsCount,
	dataSourceName,
}: {
	comparisonMode?: "countries" | "regions";
	countriesCount: number;
	regionsCount?: number;
	dataSourceName?: string | null;
}) {
	const isRegions = comparisonMode === "regions";
	const resolvedSourceName = isRegions
		? "OECD"
		: (dataSourceName?.trim() ? dataSourceName.trim() : "World Bank");
	const resolvedSourceUrl = isRegions
		? "https://www.oecd.org/"
		: getDataSourceBaseUrl(resolvedSourceName) ?? null;

	return (
		<footer className="mt-10 lg:mt-12 pt-6 border-t border-surface">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-ink-faint">
				<p>
					Data:{" "}
					{resolvedSourceUrl ? (
						<a
							href={resolvedSourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-[var(--color-accent)] hover:underline"
						>
							{resolvedSourceName}
						</a>
					) : (
						<span>{resolvedSourceName}</span>
					)}
					{" · "}
					Inspired by{" "}
					<a
						href="https://oliverwkim.com/The-Mountain-To-Climb/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-[var(--color-accent)] hover:underline"
					>
						Oliver Kim
					</a>
					{" · "}
					{isRegions
						? `${regionsCount ?? "TL2"} regions`
						: `${countriesCount} countries`}
				</p>
				<p className="flex items-center gap-1.5">
					<span>Built by</span>
					<a
						href="https://actuallymaybe.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-[var(--color-accent)] hover:underline"
					>
						Micheál
					</a>
					<span className="text-ink-faint/50">·</span>
					<a
						href="https://x.com/MichealReilly"
						target="_blank"
						rel="noopener noreferrer me"
						className="text-ink-faint hover:text-[var(--color-accent)] transition-colors"
						aria-label="Twitter"
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
					</a>
					<a
						href="https://bsky.app/profile/michealrs.bsky.social"
						target="_blank"
						rel="noopener noreferrer me"
						className="text-ink-faint hover:text-[var(--color-accent)] transition-colors"
						aria-label="Bluesky"
					>
						<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
						</svg>
					</a>
				</p>
			</div>
		</footer>
	);
}
