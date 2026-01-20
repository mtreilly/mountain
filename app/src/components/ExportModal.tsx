import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { downloadChartPng, downloadChartSvg } from "../lib/chartExport";
import { downloadFromUrl } from "../lib/fetchDownload";

function getExportBackground() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const isDark = root.classList.contains("dark");
  const key = isDark ? "--color-surface-dark" : "--color-surface";
  const value = styles.getPropertyValue(key).trim();
  if (value) return value;
  return isDark ? "#0f0e0d" : "#ffffff";
}

interface ImagePreviewProps {
  label: string;
  description: string;
  onDownload: () => void | Promise<void>;
  previewElement?: React.ReactNode;
  previewUrl?: string;
  loading?: boolean;
}

function ImagePreviewCard({
  label,
  description,
  onDownload,
  previewElement,
  previewUrl,
  loading,
}: ImagePreviewProps) {
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
    <div className="flex flex-col">
      <div className="relative aspect-video rounded-lg border border-surface bg-surface overflow-hidden mb-2">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-t-[var(--color-accent)] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
        ) : previewElement ? (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            {previewElement}
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={label}
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-faint text-xs">
            Preview unavailable
          </div>
        )}
      </div>
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="text-xs text-ink-muted mb-2">{description}</div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
      >
        {isDownloading ? (
          <>
            <div className="w-3 h-3 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </>
        )}
      </button>
    </div>
  );
}

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

interface ChartPreviewProps {
  svgRef: RefObject<SVGSVGElement | null>;
}

function ChartPreview({ svgRef }: ChartPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clone and serialize the SVG for preview
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "100%");
    setPreviewHtml(clone.outerHTML);
  }, [svgRef]);

  if (!previewHtml) return null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG from chart
      dangerouslySetInnerHTML={{ __html: previewHtml }}
    />
  );
}

export function ExportModal({
  isOpen,
  onClose,
  chartSvgRef,
  chartAvailable,
  ogImageUrl,
  exportBasename,
  baseYear,
  onBaseYearChange,
  onReset,
  onDownloadObservedCsv,
  onDownloadProjectionCsv,
  onDownloadReportJson,
}: {
  isOpen: boolean;
  onClose: () => void;
  chartSvgRef?: RefObject<SVGSVGElement | null>;
  chartAvailable?: boolean;
  ogImageUrl: string;
  exportBasename?: string;
  baseYear: number;
  onBaseYearChange: (year: number) => void;
  onReset?: () => void;
  onDownloadObservedCsv?: () => void | Promise<void>;
  onDownloadProjectionCsv?: () => void | Promise<void>;
  onDownloadReportJson?: () => void | Promise<void>;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const canExportChart = chartAvailable && chartSvgRef !== undefined;

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
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-semibold text-ink">Export Options</h2>
            <p className="text-sm text-ink-muted">Download charts, data, and social images</p>
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
          {/* Images section */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Images
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Chart Preview */}
              <ImagePreviewCard
                label="Chart"
                description="Current view"
                previewElement={
                  canExportChart && chartSvgRef ? (
                    <ChartPreview svgRef={chartSvgRef} />
                  ) : undefined
                }
                loading={!canExportChart}
                onDownload={async () => {
                  if (!chartSvgRef?.current) return;
                  await downloadChartPng(chartSvgRef.current, `${exportBasename || "chart"}.png`, {
                    pixelRatio: 2,
                    background: getExportBackground(),
                    fit: "contain",
                  });
                  toast.success("Downloaded chart");
                }}
              />

              {/* Social Card Preview */}
              <ImagePreviewCard
                label="Social Card"
                description="1200×630 for Twitter/Facebook"
                previewUrl={ogImageUrl}
                onDownload={async () => {
                  try {
                    const result = await downloadFromUrl(
                      ogImageUrl,
                      `${exportBasename || "chart"}-social.png`
                    );
                    toast.success(
                      result.contentType.includes("image/png")
                        ? "Downloaded social card"
                        : "Downloaded social card"
                    );
                  } catch {
                    toast.error("Download failed");
                  }
                }}
              />

              {/* Square Preview */}
              <ImagePreviewCard
                label="Square"
                description="1080×1080 for Instagram"
                previewElement={
                  canExportChart && chartSvgRef ? (
                    <ChartPreview svgRef={chartSvgRef} />
                  ) : undefined
                }
                loading={!canExportChart}
                onDownload={async () => {
                  if (!chartSvgRef?.current) return;
                  await downloadChartPng(
                    chartSvgRef.current,
                    `${exportBasename || "chart"}-square.png`,
                    {
                      width: 1080,
                      height: 1080,
                      pixelRatio: 1,
                      padding: 48,
                      background: getExportBackground(),
                      fit: "contain",
                    }
                  );
                  toast.success("Downloaded square image");
                }}
              />
            </div>

            {/* Additional image sizes */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canExportChart}
                onClick={async () => {
                  if (!chartSvgRef?.current) return;
                  downloadChartSvg(chartSvgRef.current, `${exportBasename || "chart"}.svg`);
                  toast.success("Downloaded SVG");
                }}
                className="px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default disabled:opacity-50"
              >
                SVG (vector)
              </button>
              <button
                type="button"
                disabled={!canExportChart}
                onClick={async () => {
                  if (!chartSvgRef?.current) return;
                  await downloadChartPng(
                    chartSvgRef.current,
                    `${exportBasename || "chart"}-1600x900.png`,
                    {
                      width: 1600,
                      height: 900,
                      pixelRatio: 1,
                      padding: 40,
                      background: getExportBackground(),
                      fit: "contain",
                    }
                  );
                  toast.success("Downloaded widescreen image");
                }}
                className="px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default disabled:opacity-50"
              >
                Widescreen (1600×900)
              </button>
              <button
                type="button"
                disabled={!canExportChart}
                onClick={async () => {
                  if (!chartSvgRef?.current) return;
                  await downloadChartPng(
                    chartSvgRef.current,
                    `${exportBasename || "chart"}-1200x630.png`,
                    {
                      width: 1200,
                      height: 630,
                      pixelRatio: 1,
                      padding: 32,
                      background: getExportBackground(),
                      fit: "contain",
                    }
                  );
                  toast.success("Downloaded social size image");
                }}
                className="px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default disabled:opacity-50"
              >
                Social size (1200×630)
              </button>
            </div>
          </section>

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
