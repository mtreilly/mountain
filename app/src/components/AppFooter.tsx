export function AppFooter({
	comparisonMode = "countries",
	countriesCount,
	regionsCount,
}: {
	comparisonMode?: "countries" | "regions";
	countriesCount: number;
	regionsCount?: number;
}) {
	const isRegions = comparisonMode === "regions";

	return (
		<footer className="mt-10 lg:mt-12 pt-6 border-t border-surface text-center">
			<p className="text-xs text-ink-faint">
				Data:{" "}
				{isRegions ? (
					<a
						href="https://www.oecd.org/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-[var(--color-accent)] hover:underline"
					>
						OECD
					</a>
				) : (
					<a
						href="https://data.worldbank.org/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-[var(--color-accent)] hover:underline"
					>
						World Bank
					</a>
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
