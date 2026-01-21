import type { RefObject } from "react";
import { toast } from "sonner";
import type { HeadlineData } from "../lib/headlineGenerator";
import { copyTextToClipboard } from "../lib/clipboard";
import { ShareMenu } from "./ShareMenu";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader({
  comparisonMode,
  shareUrl,
  chartAvailable,
  chartSvgRef,
  headlineData,
  onOpenExportModal,
  theme,
  onToggleTheme,
  printChaser,
  printTarget,
  printMetric,
  disableShareActions,
}: {
  comparisonMode: "countries" | "regions";
  shareUrl: string;
  chartAvailable: boolean;
  chartSvgRef: RefObject<SVGSVGElement | null>;
  headlineData?: HeadlineData;
  onOpenExportModal: () => void;
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
                d="M15 8a3 3 0 10-6 0v8a3 3 0 006 0V8z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12h2" />
            </svg>
            Copy link
          </button>
          <ShareMenu
            chartAvailable={chartAvailable}
            disabled={disableShareActions}
            chartSvgRef={chartSvgRef}
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

