import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { copyTextToClipboard } from "../lib/clipboard";
import type { HeadlineData } from "../lib/headlineGenerator";
import { ShareMenu } from "./ShareMenu";

export function AppHeader({
  comparisonMode,
  shareUrl,
  headlineData,
  onOpenExportModal,
  onOpenShareCardModal,
  onOpenCitationPanel,
  onOpenThreadGenerator,
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
  onOpenCitationPanel?: () => void;
  onOpenThreadGenerator?: () => void;
  shareCardAvailable?: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  printChaser: string;
  printTarget: string;
  printMetric: string;
  disableShareActions?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <header className="app-header mb-4 lg:mb-4 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-semibold tracking-tight text-ink truncate">
            {t("app.title")}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-ink-muted truncate">
            {t("app.subtitle", {
              mode: comparisonMode === "regions" ? t("mode.regions") : t("mode.countries"),
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 no-print">
          <button
            type="button"
            disabled={!shareUrl || disableShareActions}
            onClick={async () => {
              try {
                await copyTextToClipboard(shareUrl);
                toast.success(t("header.copiedShareLink"));
              } catch {
                toast.error(t("header.copyFailed"));
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs sm:text-sm font-medium hover:bg-[var(--color-accent-light)] transition-default focus-ring disabled:opacity-50"
          >
            <svg
              className="size-3.5 sm:size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span className="sr-only sm:not-sr-only">{t("header.link")}</span>
          </button>
          <button
            type="button"
            disabled={!shareCardAvailable || disableShareActions}
            onClick={onOpenShareCardModal}
            className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs sm:text-sm font-medium hover:bg-[var(--color-accent-light)] transition-default focus-ring disabled:opacity-50"
          >
            <svg
              className="size-3.5 sm:size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="sr-only sm:not-sr-only">{t("header.share")}</span>
          </button>
          <button
            type="button"
            disabled={!shareCardAvailable || disableShareActions}
            onClick={onOpenThreadGenerator}
            className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs sm:text-sm font-medium hover:bg-[var(--color-accent-light)] transition-default focus-ring disabled:opacity-50"
          >
            <svg
              className="size-3.5 sm:size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span className="sr-only sm:not-sr-only">{t("header.thread")}</span>
          </button>
          <ShareMenu
            disabled={disableShareActions}
            headlineData={headlineData}
            onOpenExportModal={onOpenExportModal}
            onOpenCitationPanel={onOpenCitationPanel}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        </div>
      </div>
      <div className="print-only mt-3 text-sm text-ink-muted">
        <span className="font-medium text-ink">{t("header.chaser")}</span> {printChaser}
        {" · "}
        <span className="font-medium text-ink">{t("header.target")}</span> {printTarget}
        {" · "}
        <span className="font-medium text-ink">{t("header.metric")}</span> {printMetric}
      </div>
    </header>
  );
}
