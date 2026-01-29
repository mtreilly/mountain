import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: "md" | "lg" | "xl";
}

const WIDTH_CLASSES = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-[640px]",
} as const;

export function SlideOver({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = "xl",
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    queueMicrotask(() => closeButtonRef.current?.focus());
    return () => {
      if (prev && prev.isConnected && prev.tagName !== "BODY" && prev.tagName !== "HTML") {
        prev.focus();
      }
    };
  }, [isOpen]);

  // Keyboard and click-outside handling
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }

      // Focus trap
      if (e.key === "Tab") {
        const root = panelRef.current;
        if (!root) return;

        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
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
      if (panelRef.current?.contains(target)) return;
      handleClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="slide-over-backdrop animate-fade-in" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`slide-over-panel ${WIDTH_CLASSES[width]} animate-slide-in-right`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 border-b border-surface bg-surface-raised">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink truncate">{title}</h2>
            {subtitle && (
              <p className="text-sm text-ink-muted truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg hover:bg-surface transition-default flex-shrink-0"
            aria-label={`Close ${title}`}
          >
            <svg
              className="w-5 h-5 text-ink-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>,
    document.body
  );
}
