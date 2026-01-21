interface EmbedFooterProps {
	shareUrl: string;
	chaserName: string;
	targetName: string;
}

export function EmbedFooter({
	shareUrl,
	chaserName,
	targetName,
}: EmbedFooterProps) {
	return (
		<div className="embed-footer">
			<span className="text-ink-muted truncate">
				{chaserName} → {targetName}
			</span>
			<a
				href={shareUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1.5 text-ink hover:text-chaser transition-colors shrink-0"
			>
				<span className="font-medium">Convergence Explorer</span>
				<svg
					className="w-3.5 h-3.5"
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
		</div>
	);
}
