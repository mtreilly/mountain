import { toast } from "sonner";
import type { HeadlineData } from "../lib/headlineGenerator";
import { copyTextToClipboard } from "../lib/clipboard";
import { ShareMenu } from "./ShareMenu";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader({
  comparisonMode,
  shareUrl,
  headlineData,
  onOpenExportModal,
  onOpenShareCardModal,
  shareCardAvailable,
  theme,
  onToggleTheme,
  printChaser,
  printTarget,
  printMetric,
  disableShareActions,
}: {
  comparisonMode: "countries" | "regions";
  shareUrl: string;
  headlineData?: HeadlineData;
  onOpenExportModal: () => void;
  onOpenShareCardModal?: () => void;
  shareCardAvailable?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  printChaser: string;
  printTarget: string;
  printMetric: string;
  disableShareActions?: boolean;
}) {
  return (
    <header className="mb-6 lg:mb-8 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-semibold tracking-tight text-ink">
            The Mountain to Climb
          </h1>
          <p className="mt-1 text-sm sm:text-base text-ink-muted">
            Explore economic convergence timelines between{" "}
            {comparisonMode === "regions" ? "regions" : "countries"}.
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            disabled={!shareUrl || disableShareActions}
            onClick={async () => {
              try {
                await copyTextToClipboard(shareUrl);
                toast.success("Copied share link");
              } catch {
                toast.error("Copy failed");
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-light)] transition-default focus-ring disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Copy link
          </button>
          <button
            type="button"
            disabled={!shareCardAvailable || disableShareActions}
            onClick={onOpenShareCardModal}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-light)] transition-default focus-ring disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Share Card
          </button>
          <ShareMenu
            disabled={disableShareActions}
            headlineData={headlineData}
            onOpenExportModal={onOpenExportModal}
          />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <div className="print-only mt-3 text-sm text-ink-muted">
        <span className="font-medium text-ink">Chaser:</span> {printChaser}
        {" · "}
        <span className="font-medium text-ink">Target:</span> {printTarget}
        {" · "}
        <span className="font-medium text-ink">Metric:</span> {printMetric}
      </div>
    </header>
  );
}

