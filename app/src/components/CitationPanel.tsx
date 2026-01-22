import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { copyTextToClipboard } from "../lib/clipboard";
import type { ShareState } from "../lib/shareState";
import { toSearchString } from "../lib/shareState";

type CitationIndicator = {
  code: string;
  name: string;
  unit?: string | null;
};

function sourceLinksForIndicator(indicatorCode: string) {
  const sources: Array<{ label: string; url: string }> = [];

  // Defaults used across the app.
  sources.push({
    label: "World Bank Data API",
    url: "https://api.worldbank.org/",
  });

  // Indicator-specific additions.
  if (indicatorCode === "CO2_PCAP") {
    sources.push({
      label: "OWID CO₂ data",
      url: "https://github.com/owid/co2-data",
    });
  }

  // De-dupe by URL.
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function buildShareUrl(state: ShareState | undefined) {
  if (!state) return null;
  if (typeof window === "undefined") return null;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}${toSearchString(state)}`;
}

export function CitationPanel({
  isOpen,
  onClose,
  shareState,
  indicator,
  includeImplicationsSources,
  chaserName,
  targetName,
}: {
  isOpen: boolean;
  onClose: () => void;
  shareState?: ShareState;
  indicator: CitationIndicator | null;
  includeImplicationsSources?: boolean;
  chaserName: string;
  targetName: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  const shareUrl = useMemo(() => buildShareUrl(shareState), [shareState]);
  const indicatorLabel = indicator?.name || indicator?.code || "Metric";
  const indicatorCode = indicator?.code || "";

  const sources = useMemo(() => {
    const base = sourceLinksForIndicator(indicatorCode);
    if (includeImplicationsSources) {
      base.push(
        { label: "OWID Energy data", url: "https://github.com/owid/energy-data" },
        { label: "IRENASTAT (PXWeb)", url: "https://pxweb.irena.org/pxweb/en/IRENASTAT/" },
        { label: "Ember API (electricity datasets)", url: "https://ember-energy.org/data/api/" }
      );
    }
    const seen = new Set<string>();
    return base.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  }, [includeImplicationsSources, indicatorCode]);

  const citationText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`The Mountain to Climb (Convergence Explorer).`);
    parts.push(`Comparison: ${chaserName} vs ${targetName}.`);
    parts.push(`Metric: ${indicatorLabel}.`);
    if (includeImplicationsSources) {
      parts.push(
        `Additional context data: Our World in Data (energy), IRENASTAT (capacity), and Ember (electricity datasets, if enabled).`
      );
    }
    if (shareUrl) parts.push(`URL: ${shareUrl}`);
    parts.push(`Accessed: ${new Date().toISOString().slice(0, 10)}.`);
    return parts.join(" ");
  }, [chaserName, includeImplicationsSources, indicatorLabel, shareUrl, targetName]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

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
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.body.style.overflow = "";
    };
  }, [handleClose, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Cite this"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-semibold text-ink">Cite This</h2>
            <p className="text-sm text-ink-muted">Suggested citation and data sources</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface transition-default"
            aria-label="Close citation panel"
          >
            <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Suggested Citation
            </h3>
            <div className="p-3 rounded-lg border border-surface bg-surface">
              <div className="text-xs text-ink whitespace-pre-wrap">{citationText}</div>
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await copyTextToClipboard(citationText);
                      toast.success("Copied citation");
                    } catch {
                      toast.error("Copy failed");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-surface bg-surface-raised text-ink text-xs font-medium hover:bg-surface transition-default"
                >
                  Copy
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Data Sources
            </h3>
            <div className="space-y-2">
              {sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-3 rounded-lg border border-surface bg-surface hover:bg-surface-raised transition-default"
                >
                  <div className="text-sm font-medium text-ink">{s.label}</div>
                  <div className="text-xs text-ink-faint break-all">{s.url}</div>
                </a>
              ))}
              {sources.length === 0 && (
                <div className="text-sm text-ink-muted">No sources available.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
