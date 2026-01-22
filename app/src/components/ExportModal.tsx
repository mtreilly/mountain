import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { ShareState } from "../lib/shareState";
import { EmbedCodeGenerator } from "./EmbedCodeGenerator";

type DownloadCallback = () => void | string | Promise<void | string>;

interface DataExportCardProps {
  label: string;
  description: string;
  onDownload: () => void | Promise<void>;
  disabled?: boolean;
}

function DataExportCard({ label, description, onDownload, disabled }: DataExportCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-surface bg-surface">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-ink-muted">{description}</div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || isDownloading}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-surface bg-surface-raised text-ink text-xs font-medium hover:bg-surface transition-default disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        {isDownloading ? (
          <div className="w-3 h-3 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        Download
      </button>
    </div>
  );
}

export function ExportModal({
  isOpen,
  onClose,
  baseYear,
  onBaseYearChange,
  onReset,
  comparisonMode = "countries",
  onDownloadObservedCsv,
  onDownloadProjectionCsv,
  onDownloadReportJson,
  shareState,
  ogImageUrl,
  onOpenCitationPanel,
}: {
  isOpen: boolean;
  onClose: () => void;
  baseYear: number;
  onBaseYearChange: (year: number) => void;
  onReset?: () => void;
  comparisonMode?: "countries" | "regions";
  onDownloadObservedCsv?: DownloadCallback;
  onDownloadProjectionCsv?: DownloadCallback;
  onDownloadReportJson?: DownloadCallback;
  shareState?: ShareState;
  ogImageUrl?: string;
  onOpenCitationPanel?: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isRegionsMode = comparisonMode === "regions";

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
      if (e.key === "Escape") handleClose();

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
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Export Options"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-semibold text-ink">Export Data</h2>
            <p className="text-sm text-ink-muted">Download data and reports</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            ref={closeButtonRef}
            className="p-2 rounded-lg hover:bg-surface transition-default"
            aria-label="Close export modal"
          >
            <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Data section */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Data
            </h3>
            <div className="space-y-2">
              <DataExportCard
                label="Historical Data (CSV)"
                description={
                  isRegionsMode
                    ? "Recorded values from OECD regional dataset"
                    : "Actual recorded values from World Bank"
                }
                onDownload={async () => {
                  const filename = await onDownloadObservedCsv?.();
                  toast.success(
                    typeof filename === "string" && filename.length
                      ? `Downloaded historical data: ${filename}`
                      : "Downloaded historical data"
                  );
                }}
                disabled={!onDownloadObservedCsv}
              />
              <DataExportCard
                label="Projection Data (CSV)"
                description={
                  isRegionsMode
                    ? "Calculated future GDP per capita based on growth rates"
                    : "Calculated future values based on growth rates"
                }
                onDownload={async () => {
                  const filename = await onDownloadProjectionCsv?.();
                  toast.success(
                    typeof filename === "string" && filename.length
                      ? `Downloaded projection data: ${filename}`
                      : "Downloaded projection data"
                  );
                }}
                disabled={!onDownloadProjectionCsv}
              />
              <DataExportCard
                label="Full Report (JSON)"
                description={
                  isRegionsMode
                    ? "Complete report including metadata, observed series, and projections"
                    : "Complete data including metadata and calculations"
                }
                onDownload={async () => {
                  const filename = await onDownloadReportJson?.();
                  toast.success(
                    typeof filename === "string" && filename.length
                      ? `Downloaded report: ${filename}`
                      : "Downloaded report"
                  );
                }}
                disabled={!onDownloadReportJson}
              />
            </div>
            {onOpenCitationPanel && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenCitationPanel();
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-surface bg-surface text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface-raised transition-default inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Cite This
                </button>
              </div>
            )}
          </section>

          {/* Embed section */}
          {shareState && (
            <section>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
                Embed
              </h3>
              <div className="p-4 rounded-lg border border-surface bg-surface">
                <EmbedCodeGenerator
                  shareState={shareState}
                  ogImageUrl={ogImageUrl}
                />
              </div>
            </section>
          )}

          {/* Cite section */}
          {onOpenCitationPanel && (
            <section>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
                Citation
              </h3>
              <div className="p-4 rounded-lg border border-surface bg-surface">
                <p className="text-sm text-ink-muted mb-3">
                  Generate properly formatted citations for academic papers, blog posts, and publications.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenCitationPanel();
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-surface bg-surface-raised text-ink text-sm font-medium hover:bg-surface transition-default inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Open Citation Panel
                  <span className="text-xs text-ink-faint ml-auto">⌘⇧C</span>
                </button>
              </div>
            </section>
          )}

          {/* Settings section */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Settings
            </h3>
            <div className="p-4 rounded-lg border border-surface bg-surface space-y-4">
              <div>
                <label htmlFor="base-year-input" className="block text-sm font-medium text-ink mb-1">
                  Base year
                </label>
                <input
                  id="base-year-input"
                  type="number"
                  min={1950}
                  max={2100}
                  value={baseYear}
                  onChange={(e) => onBaseYearChange(Number.parseInt(e.target.value || "0", 10))}
                  className="w-full max-w-[120px] px-3 py-2 rounded-lg border border-surface bg-surface-raised text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <p className="mt-1 text-xs text-ink-faint">
                  Affects the projection start year and convergence calculations
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-surface">
                <button
                  type="button"
                  onClick={() => {
                    onReset?.();
                    toast.success("Reset to defaults");
                  }}
                  disabled={!onReset}
                  className="px-3 py-1.5 rounded-lg border border-surface bg-surface-raised text-ink text-xs font-medium hover:bg-surface transition-default disabled:opacity-50"
                >
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    window.print();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-surface bg-surface-raised text-ink text-xs font-medium hover:bg-surface transition-default"
                >
                  Print page
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
