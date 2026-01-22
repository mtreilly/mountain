import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  copyShareCardToClipboard,
  downloadShareCardPng,
} from "../lib/chartExport";
import {
  SHARE_CARD_SIZES,
  type ShareCardParams,
  type ShareCardSize,
} from "../lib/shareCardSvg";
import { ShareCardPreview } from "./ShareCardPreview";

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareCardParams: ShareCardParams | null;
}

const SIZE_OPTIONS: Array<{ value: ShareCardSize; label: string; description: string }> = [
  { value: "twitter", label: "Twitter/X", description: "1200×675" },
  { value: "linkedin", label: "LinkedIn", description: "1200×627" },
  { value: "square", label: "Square", description: "1080×1080" },
];

export function ShareCardModal({
  isOpen,
  onClose,
  shareCardParams,
}: ShareCardModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark">(
    shareCardParams?.theme ?? "light"
  );
  const [selectedSize, setSelectedSize] = useState<ShareCardSize>("twitter");
  const [isCopying, setIsCopying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Update theme when params change
  useEffect(() => {
    if (shareCardParams?.theme) {
      setSelectedTheme(shareCardParams.theme);
    }
  }, [shareCardParams?.theme]);

  const paramsWithOverrides = useMemo((): ShareCardParams | null => {
    if (!shareCardParams) return null;
    return {
      ...shareCardParams,
      theme: selectedTheme,
      dimensions: SHARE_CARD_SIZES[selectedSize],
    };
  }, [shareCardParams, selectedTheme, selectedSize]);

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

  const handleCopyToClipboard = async () => {
    if (!paramsWithOverrides) return;
    setIsCopying(true);
    try {
      await copyShareCardToClipboard(paramsWithOverrides, selectedSize);
      toast.success("Copied to clipboard");
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy to clipboard");
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownload = async () => {
    if (!paramsWithOverrides) return;
    setIsDownloading(true);
    try {
      await downloadShareCardPng(paramsWithOverrides, selectedSize);
      toast.success("Downloaded share card");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download");
    } finally {
      setIsDownloading(false);
    }
  };

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
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  if (!isOpen || !shareCardParams) return null;

  const previewScale = selectedSize === "square" ? 0.35 : 0.4;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create Share Card"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-semibold text-ink">Create Share Card</h2>
            <p className="text-sm text-ink-muted">
              Generate an image optimized for social media
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            ref={closeButtonRef}
            className="p-2 rounded-lg hover:bg-surface transition-default"
            aria-label="Close share card modal"
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

        <div className="p-4 space-y-5">
          {/* Preview */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Preview
            </h3>
            <div className="flex justify-center p-4 rounded-xl border border-surface bg-surface">
              {paramsWithOverrides && (
                <ShareCardPreview
                  params={paramsWithOverrides}
                  size={selectedSize}
                  scale={previewScale}
                />
              )}
            </div>
          </section>

          {/* Options */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Options
            </h3>
            <div className="space-y-4 p-4 rounded-xl border border-surface bg-surface">
              {/* Theme toggle */}
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Theme
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTheme("light")}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-default ${
                      selectedTheme === "light"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "border-surface bg-surface-raised text-ink hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Light
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTheme("dark")}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-default ${
                      selectedTheme === "dark"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "border-surface bg-surface-raised text-ink hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      Dark
                    </span>
                  </button>
                </div>
              </div>

              {/* Size selector */}
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Size
                </label>
                <div className="flex gap-2">
                  {SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedSize(option.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-default ${
                        selectedSize === option.value
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          : "border-surface bg-surface-raised text-ink hover:bg-surface"
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-ink-faint">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                disabled={isCopying || !paramsWithOverrides}
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-default disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isCopying ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy to Clipboard
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading || !paramsWithOverrides}
                className="flex-1 px-4 py-3 rounded-xl border border-surface bg-surface-raised text-ink text-sm font-semibold hover:bg-surface transition-default disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Tip */}
          <p className="text-xs text-ink-faint text-center">
            Tip: Copy to clipboard and paste directly into Twitter, LinkedIn, or Slack
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
