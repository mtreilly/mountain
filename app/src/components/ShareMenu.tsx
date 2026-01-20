import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { copyChartPngToClipboard } from "../lib/chartExport";
import type { HeadlineData } from "../lib/headlineGenerator";
import { ShareHeadline } from "./ShareHeadline";

function getExportBackground() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const isDark = root.classList.contains("dark");
  const key = isDark ? "--color-surface-dark" : "--color-surface";
  const value = styles.getPropertyValue(key).trim();
  if (value) return value;
  return isDark ? "#0f0e0d" : "#ffffff";
}

export function ShareMenu({
  chartAvailable = true,
  disabled,
  chartSvgRef,
  headlineData,
  onOpenExportModal,
}: {
  chartAvailable?: boolean;
  disabled?: boolean;
  chartSvgRef?: RefObject<SVGSVGElement | null>;
  headlineData?: HeadlineData;
  onOpenExportModal?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popover, setPopover] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const canExportChart = chartAvailable && chartSvgRef !== undefined;

  const updatePopover = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const margin = 8;
    const maxWidth = 320;
    const width = Math.min(maxWidth, Math.max(260, rect.width * 1.2));
    const left = Math.max(
      margin,
      Math.min(rect.right - width, window.innerWidth - margin - width)
    );
    const top = rect.bottom + margin;

    setPopover({ top, left, width });
  }, []);

  const open = useCallback(() => {
    updatePopover();
    setIsOpen(true);
  }, [updatePopover]);

  const close = useCallback(() => {
    setIsOpen(false);
    setPopover(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => updatePopover();
    const onScroll = () => updatePopover();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, updatePopover]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close() : open())}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface bg-surface-raised text-sm font-medium text-ink hover:bg-surface transition-default disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>

      {isOpen &&
        popover &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Share"
            className="fixed z-50 rounded-xl border border-surface bg-surface-raised shadow-xl p-3 space-y-3"
            style={{ top: popover.top, left: popover.left, width: popover.width }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">Share</div>
              <button
                type="button"
                onClick={close}
                className="p-1.5 rounded-md hover:bg-surface transition-default"
                aria-label="Close share menu"
              >
                <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick actions */}
            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canExportChart}
                onClick={async () => {
                  if (!chartSvgRef?.current) return;
                  try {
                    await copyChartPngToClipboard(chartSvgRef.current, {
                      pixelRatio: 2,
                      background: getExportBackground(),
                      fit: "contain",
                    });
                    toast.success("Copied image");
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
                className="px-3 py-2 rounded-lg border border-surface bg-surface text-ink text-sm font-medium hover:bg-surface-raised transition-default disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Copy Image
              </button>
            </div>

            {/* Share headline */}
            {headlineData && (
              <div className="border-t border-surface pt-3">
                <ShareHeadline data={headlineData} />
              </div>
            )}

            {/* More export options link */}
            {onOpenExportModal && (
              <div className="border-t border-surface pt-3">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onOpenExportModal();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-accent)] hover:bg-surface transition-default inline-flex items-center justify-center gap-2"
                >
                  More export options
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
