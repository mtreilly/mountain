import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HeadlineData } from "../lib/headlineGenerator";
import { ShareHeadline } from "./ShareHeadline";

export function ShareMenu({
  disabled,
  headlineData,
  onOpenExportModal,
  onOpenCitationPanel,
}: {
  disabled?: boolean;
  headlineData?: HeadlineData;
  onOpenExportModal?: () => void;
  onOpenCitationPanel?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popover, setPopover] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export Options
      </button>

      {isOpen &&
        popover &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Export Options"
            className="fixed z-50 rounded-xl border border-surface bg-surface-raised shadow-xl p-3 space-y-3"
            style={{ top: popover.top, left: popover.left, width: popover.width }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">Export Options</div>
              <button
                type="button"
                onClick={close}
                className="p-1.5 rounded-md hover:bg-surface transition-default"
                aria-label="Close export menu"
              >
                <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
              <div className={headlineData ? "border-t border-surface pt-3" : ""}>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onOpenExportModal();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-accent)] hover:bg-surface transition-default inline-flex items-center justify-center gap-2"
                >
                  Data / Embed
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Cite this option */}
            {onOpenCitationPanel && (
              <div className={onOpenExportModal || headlineData ? "border-t border-surface pt-3" : ""}>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onOpenCitationPanel();
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-surface transition-default inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Cite This
                  <span className="text-xs text-ink-faint ml-auto">⌘⇧C</span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
