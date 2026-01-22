import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calculateSensitivityScenarios } from "../lib/sensitivityAnalysis";
import { generateSensitivityCardSvg } from "../lib/sensitivityCardSvg";
import { generateHistoricalCardSvg } from "../lib/historicalCardSvg";
import { generateImplicationsCardSvg } from "../lib/implicationsCardSvg";
import { generateShareCardSvg, type ShareCardParams, SHARE_CARD_SIZES } from "../lib/shareCardSvg";
import {
  generateCaptions,
  type ThreadCard,
  type HistoricalData,
  type ImplicationsData,
} from "../lib/threadGenerator";
import { ThreadPreview } from "./ThreadPreview";
import { ThreadExportOptions } from "./ThreadExportOptions";

export interface ThreadGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareCardParams: ShareCardParams | null;
  historicalData: HistoricalData | null;
  implicationsData: ImplicationsData | null;
  baseYear: number;
  horizonYears: number;
  appUrl: string;
}

export function ThreadGeneratorModal({
  isOpen,
  onClose,
  shareCardParams,
  historicalData,
  implicationsData,
  baseYear,
  horizonYears,
  appUrl,
}: ThreadGeneratorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark">(
    shareCardParams?.theme ?? "light"
  );
  const [cards, setCards] = useState<ThreadCard[]>([]);
  const [regenerateKey, setRegenerateKey] = useState(0);

  // Update theme when params change
  useEffect(() => {
    if (shareCardParams?.theme) {
      setSelectedTheme(shareCardParams.theme);
    }
  }, [shareCardParams?.theme]);

  // Generate all cards when modal opens or theme/regenerateKey changes
  useEffect(() => {
    if (!isOpen || !shareCardParams) {
      setCards([]);
      return;
    }

    const chaserValue = shareCardParams.projection[0]?.chaser ?? 1;
    const targetValue = shareCardParams.projection[0]?.target ?? 2;

    // Calculate sensitivity scenarios
    const sensitivity = calculateSensitivityScenarios({
      chaserValue,
      targetValue,
      chaserGrowthRate: shareCardParams.chaserGrowth,
      targetGrowthRate: shareCardParams.targetGrowth,
      baseYear,
    });

    // Generate caption context
    const captionContext = {
      chaserName: shareCardParams.chaserName,
      targetName: shareCardParams.targetName,
      yearsToConvergence: shareCardParams.yearsToConvergence,
      convergenceYear: shareCardParams.convergenceYear,
      chaserGrowthRate: shareCardParams.chaserGrowth,
      targetGrowthRate: shareCardParams.targetGrowth,
      optimisticYears: sensitivity.optimistic.yearsToConvergence,
      pessimisticYears: sensitivity.pessimistic.yearsToConvergence,
      historicalData,
      implicationsData,
      appUrl,
    };

    const captions = generateCaptions(captionContext);

    // Card 1: Main convergence chart (reuse existing share card)
    const mainCardSvg = generateShareCardSvg({
      ...shareCardParams,
      theme: selectedTheme,
      dimensions: SHARE_CARD_SIZES.twitter,
    });

    // Card 2: Sensitivity analysis
    const sensitivityCardSvg = generateSensitivityCardSvg({
      chaserName: shareCardParams.chaserName,
      targetName: shareCardParams.targetName,
      chaserValue,
      targetValue,
      metricUnit: shareCardParams.metricUnit,
      sensitivity,
      baseYear,
      theme: selectedTheme,
      siteUrl: shareCardParams.siteUrl,
      dataSource: shareCardParams.dataSource,
    });

    // Card 3: Historical context
    const historicalCardSvg = historicalData
      ? generateHistoricalCardSvg({
          chaserName: shareCardParams.chaserName,
          targetName: shareCardParams.targetName,
          historicalData,
          metricUnit: shareCardParams.metricUnit,
          theme: selectedTheme,
          siteUrl: shareCardParams.siteUrl,
          dataSource: shareCardParams.dataSource,
        })
      : generatePlaceholderSvg(
          "Historical Context",
          "Historical data not available",
          selectedTheme
        );

    // Card 4: Implications summary
    const implicationsCardSvg = implicationsData
      ? generateImplicationsCardSvg({
          chaserName: shareCardParams.chaserName,
          implicationsData,
          horizonYear: baseYear + horizonYears,
          theme: selectedTheme,
          siteUrl: shareCardParams.siteUrl,
          dataSource: shareCardParams.dataSource,
        })
      : generatePlaceholderSvg(
          "Implications Summary",
          "Implications data not available (requires GDP per capita metric)",
          selectedTheme
        );

    const newCards: ThreadCard[] = [
      { type: "main", svgString: mainCardSvg, caption: captions[0], index: 1 },
      { type: "sensitivity", svgString: sensitivityCardSvg, caption: captions[1], index: 2 },
      { type: "historical", svgString: historicalCardSvg, caption: captions[2], index: 3 },
      { type: "implications", svgString: implicationsCardSvg, caption: captions[3], index: 4 },
    ];

    setCards(newCards);
  }, [
    isOpen,
    shareCardParams,
    selectedTheme,
    historicalData,
    implicationsData,
    baseYear,
    horizonYears,
    appUrl,
    regenerateKey,
  ]);

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

  const handleCaptionChange = useCallback((index: number, caption: string) => {
    setCards((prev) =>
      prev.map((card) => (card.index === index ? { ...card, caption } : card))
    );
  }, []);

  const handleRegenerate = useCallback(() => {
    setRegenerateKey((k) => k + 1);
  }, []);

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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create Twitter Thread"
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-semibold text-ink">Create Twitter Thread</h2>
            <p className="text-sm text-ink-muted">
              Generate a 4-card thread package with captions
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            ref={closeButtonRef}
            className="p-2 rounded-lg hover:bg-surface transition-default"
            aria-label="Close thread generator modal"
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
          {/* Theme Selector */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Theme
            </h3>
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
          </section>

          {/* Preview */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Thread Preview
            </h3>
            <ThreadPreview cards={cards} onCaptionChange={handleCaptionChange} />
          </section>

          {/* Export Options */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Export
            </h3>
            <ThreadExportOptions
              cards={cards}
              chaserCode={shareCardParams.chaserCode}
              targetCode={shareCardParams.targetCode}
              theme={selectedTheme}
              onRegenerate={handleRegenerate}
            />
          </section>

          {/* Tips */}
          <p className="text-xs text-ink-faint text-center">
            Tip: Download the ZIP for all images + captions, or copy individual cards above
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Generate a placeholder SVG for missing data scenarios.
 */
function generatePlaceholderSvg(title: string, message: string, theme: "light" | "dark"): string {
  const palette = theme === "light"
    ? { bg: "#faf8f5", card: "#fffffe", border: "#e5e0d8", ink: "#1a1815", muted: "#5c574f" }
    : { bg: "#0f0e0d", card: "#1a1918", border: "#2a2826", ink: "#f5f3ef", muted: "#a8a49c" };

  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <rect width="1200" height="675" fill="${palette.bg}"/>
    <rect x="100" y="100" width="1000" height="475" rx="24" fill="${palette.card}" stroke="${palette.border}"/>
    <text x="600" y="300" text-anchor="middle" font-family="${font}" font-size="28" font-weight="700" fill="${palette.ink}">${title}</text>
    <text x="600" y="350" text-anchor="middle" font-family="${font}" font-size="16" fill="${palette.muted}">${message}</text>
  </svg>`;
}
