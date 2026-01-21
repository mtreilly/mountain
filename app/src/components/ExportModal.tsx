import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { ShareState } from "../lib/shareState";
import { EmbedCodeGenerator } from "./EmbedCodeGenerator";

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
  onDownloadObservedCsv,
  onDownloadProjectionCsv,
  onDownloadReportJson,
  shareState,
  ogImageUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  baseYear: number;
  onBaseYearChange: (year: number) => void;
  onReset?: () => void;
  onDownloadObservedCsv?: () => void | Promise<void>;
  onDownloadProjectionCsv?: () => void | Promise<void>;
  onDownloadReportJson?: () => void | Promise<void>;
  shareState?: ShareState;
  ogImageUrl?: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle ESC key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
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
            className="p-2 rounded-lg hover:bg-surface transition-default"
            aria-label="Close export modal"
          >
            <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Data section */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Data
            </h3>
            <div className="space-y-2">
              <DataExportCard
                label="Historical Data (CSV)"
                description="Actual recorded values from World Bank"
                onDownload={async () => {
                  await onDownloadObservedCsv?.();
                  toast.success("Downloaded historical data");
                }}
                disabled={!onDownloadObservedCsv}
              />
              <DataExportCard
                label="Projection Data (CSV)"
                description="Calculated future values based on growth rates"
                onDownload={async () => {
                  await onDownloadProjectionCsv?.();
                  toast.success("Downloaded projection data");
                }}
                disabled={!onDownloadProjectionCsv}
              />
              <DataExportCard
                label="Full Report (JSON)"
                description="Complete data including metadata and calculations"
                onDownload={async () => {
                  await onDownloadReportJson?.();
                  toast.success("Downloaded report");
                }}
                disabled={!onDownloadReportJson}
              />
            </div>
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
