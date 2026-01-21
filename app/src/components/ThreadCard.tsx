import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { svgStringToPngBlob } from "../lib/chartExport";
import type { ThreadCard as ThreadCardType } from "../lib/threadGenerator";

interface ThreadCardProps {
  card: ThreadCardType;
  scale?: number;
  onCaptionChange: (index: number, caption: string) => void;
}

const CARD_LABELS: Record<string, string> = {
  main: "Main Chart",
  sensitivity: "Sensitivity Analysis",
  historical: "Historical Context",
  implications: "Implications Summary",
};

const CARD_DIMENSIONS = { width: 1200, height: 675 };

export function ThreadCard({ card, scale = 0.35, onCaptionChange }: ThreadCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scaledWidth = CARD_DIMENSIONS.width * scale;
  const scaledHeight = CARD_DIMENSIONS.height * scale;

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
    <div className="flex flex-col">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ink">
          {card.index}/4 · {CARD_LABELS[card.type] || card.type}
        </span>
        <button
          type="button"
          onClick={handleCopyCard}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink rounded-md hover:bg-surface transition-default"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy
        </button>
      </div>

      {/* Card Preview */}
      <div
        className="rounded-lg border border-surface overflow-hidden bg-surface"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        <img
          src={svgDataUrl}
          alt={`Thread card ${card.index}: ${CARD_LABELS[card.type]}`}
          width={scaledWidth}
          height={scaledHeight}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Caption Editor */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={`caption-${card.index}`} className="text-xs font-medium text-ink-muted">
            Caption
          </label>
          <button
            type="button"
            onClick={handleCopyCaption}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink rounded hover:bg-surface transition-default"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
        </div>
        <textarea
          ref={textareaRef}
          id={`caption-${card.index}`}
          value={card.caption}
          onChange={(e) => onCaptionChange(card.index, e.target.value)}
          rows={5}
          className="w-full px-3 py-2 text-sm rounded-lg border border-surface bg-surface-raised text-ink resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          style={{ width: scaledWidth }}
        />
        <div className="mt-1 text-xs text-ink-faint text-right">
          {card.caption.length} chars
        </div>
      </div>
    </div>
  );
}
