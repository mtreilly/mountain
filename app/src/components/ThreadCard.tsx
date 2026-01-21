import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { svgStringToPngBlob } from "../lib/chartExport";
import type { ThreadCard as ThreadCardType } from "../lib/threadGenerator";

interface ThreadCardProps {
  card: ThreadCardType;
  onCaptionChange: (index: number, caption: string) => void;
}

const CARD_LABELS: Record<string, string> = {
  main: "Main Chart",
  sensitivity: "Sensitivity Analysis",
  historical: "Historical Context",
  implications: "Implications Summary",
};

const CARD_DIMENSIONS = { width: 1200, height: 675 };

export function ThreadCard({ card, onCaptionChange }: ThreadCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const svgDataUrl = useMemo(() => {
    const blob = new Blob([card.svgString], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [card.svgString]);

  const handleCopyCard = useCallback(async () => {
    try {
      const pngBlob = await svgStringToPngBlob(card.svgString, CARD_DIMENSIONS, 2);
      const item = new ClipboardItem({ "image/png": pngBlob });
      await navigator.clipboard.write([item]);
      toast.success(`Copied card ${card.index} to clipboard`);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy image");
    }
  }, [card.svgString, card.index]);

  const handleCopyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(card.caption);
      toast.success("Copied caption");
    } catch {
      toast.error("Failed to copy caption");
    }
  }, [card.caption]);

  return (
    <div className="rounded-xl border border-surface bg-surface-raised p-4">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-surface">
        <span className="text-sm font-semibold text-ink">
          {card.index}/4 · {CARD_LABELS[card.type] || card.type}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCaption}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink rounded-md hover:bg-surface transition-default"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy text
          </button>
          <button
            type="button"
            onClick={handleCopyCard}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink rounded-md hover:bg-surface transition-default"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Copy image
          </button>
        </div>
      </div>

      {/* Two-column layout: Caption left, Image right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Caption/Tweet */}
        <div className="flex flex-col">
          <label htmlFor={`caption-${card.index}`} className="text-xs font-medium text-ink-muted mb-2">
            Tweet
          </label>
          <textarea
            ref={textareaRef}
            id={`caption-${card.index}`}
            value={card.caption}
            onChange={(e) => onCaptionChange(card.index, e.target.value)}
            rows={8}
            className="flex-1 w-full px-3 py-2 text-sm rounded-lg border border-surface bg-surface text-ink resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-ink-faint">
            <span>{card.caption.length} chars</span>
            {card.caption.length > 280 && (
              <span className="text-amber-600 dark:text-amber-400">Over 280 limit</span>
            )}
          </div>
        </div>

        {/* Right: Image Preview */}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-ink-muted mb-2">Image</span>
          <div className="flex-1 rounded-lg border border-surface overflow-hidden bg-surface">
            <img
              src={svgDataUrl}
              alt={`Thread card ${card.index}: ${CARD_LABELS[card.type]}`}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
