import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HeadlineData } from "../lib/headlineGenerator";
import { ShareHeadline } from "./ShareHeadline";

export function ShareMenu({
  disabled,
  headlineData,
  onOpenExportModal,
  onOpenCitationPanel,
  theme,
  onToggleTheme,
}: {
  disabled?: boolean;
  headlineData?: HeadlineData;
  onOpenExportModal?: () => void;
  onOpenCitationPanel?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [popover, setPopover] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const focusFirstMenuItem = useCallback(() => {
    const root = popoverRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, []);

  const focusLastMenuItem = useCallback(() => {
    const root = popoverRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items.at(-1)?.focus();
  }, []);

  const updatePopover = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const margin = 8;
    const width = 220;
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

  const close = useCallback((opts?: { restoreFocus?: boolean }) => {
    setIsOpen(false);
    setPopover(null);
    if (opts?.restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
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
      if (e.key === "Escape") close({ restoreFocus: true });
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

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };

    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
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

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => focusFirstMenuItem());
  }, [focusFirstMenuItem, isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close({ restoreFocus: true }) : open())}
        disabled={disabled}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) open();
            queueMicrotask(() => focusFirstMenuItem());
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) open();
            queueMicrotask(() => focusLastMenuItem());
          }
        }}
        className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-surface bg-surface-raised text-ink-muted hover:text-ink hover:bg-surface transition-default disabled:opacity-50"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen &&
        popover &&
        createPortal(
          <div
            ref={popoverRef}
            id={menuId}
            role="menu"
            aria-label="More options"
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End")
                return;

              const root = popoverRef.current;
              if (!root) return;
              const items = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
              if (!items.length) return;

              const active = document.activeElement as HTMLElement | null;
              const currentIndex = active ? items.indexOf(active) : -1;

              const focusIndex = (idx: number) => {
                const target = items.at(idx);
                if (target) target.focus();
              };

              e.preventDefault();
              if (e.key === "Home") {
                focusIndex(0);
                return;
              }
              if (e.key === "End") {
                focusIndex(-1);
                return;
              }
              if (e.key === "ArrowDown") {
                focusIndex(currentIndex === -1 ? 0 : (currentIndex + 1) % items.length);
              }
              if (e.key === "ArrowUp") {
                focusIndex(currentIndex === -1 ? -1 : (currentIndex - 1 + items.length) % items.length);
              }
            }}
            className="fixed z-50 rounded-xl border border-surface bg-surface-raised shadow-xl py-1"
            style={{ top: popover.top, left: popover.left, width: popover.width }}
          >
            {/* Theme toggle */}
            {onToggleTheme && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToggleTheme();
                }}
                className="w-full px-3 py-2 text-sm text-left text-ink hover:bg-surface transition-default inline-flex items-center gap-3"
              >
                {theme === "dark" ? (
                  <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            )}

            {/* Data / Embed */}
            {onOpenExportModal && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onOpenExportModal();
                }}
                className="w-full px-3 py-2 text-sm text-left text-ink hover:bg-surface transition-default inline-flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Data / Embed
              </button>
            )}

            {/* Cite This */}
            {onOpenCitationPanel && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onOpenCitationPanel();
                }}
                className="w-full px-3 py-2 text-sm text-left text-ink hover:bg-surface transition-default inline-flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Cite This
              </button>
            )}

            {/* Share headline */}
            {headlineData && (
              <>
                <div className="my-1 border-t border-surface" />
                <div className="px-3 py-2">
                  <ShareHeadline data={headlineData} compact onCopied={close} />
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
