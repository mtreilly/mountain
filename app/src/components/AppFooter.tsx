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
		<footer className="mt-10 lg:mt-12 pt-6 border-t border-surface text-center">
			<p className="text-xs text-ink-faint">
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
		</footer>
	);
}
