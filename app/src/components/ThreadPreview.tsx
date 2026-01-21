import type { ThreadCard as ThreadCardType } from "../lib/threadGenerator";
import { ThreadCard } from "./ThreadCard";

interface ThreadPreviewProps {
  cards: ThreadCardType[];
  onCaptionChange: (index: number, caption: string) => void;
}

export function ThreadPreview({ cards, onCaptionChange }: ThreadPreviewProps) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 rounded-xl border border-dashed border-surface">
        <p className="text-sm text-ink-muted">Generating thread cards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Thread cards - vertical stack with two-column layout per card */}
      {cards.map((card) => (
        <ThreadCard
          key={card.index}
          card={card}
          onCaptionChange={onCaptionChange}
        />
      ))}

      {/* Thread summary */}
      <div className="rounded-lg bg-surface p-4 border border-surface">
        <h4 className="text-sm font-semibold text-ink mb-2">Thread Summary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2 rounded-md bg-surface-raised">
            <div className="font-medium text-ink-muted">Cards</div>
            <div className="text-lg font-semibold text-ink">{cards.length}</div>
          </div>
          <div className="p-2 rounded-md bg-surface-raised">
            <div className="font-medium text-ink-muted">Total chars</div>
            <div className="text-lg font-semibold text-ink">
              {cards.reduce((sum, c) => sum + c.caption.length, 0)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-surface-raised">
            <div className="font-medium text-ink-muted">Avg per card</div>
            <div className="text-lg font-semibold text-ink">
              {Math.round(cards.reduce((sum, c) => sum + c.caption.length, 0) / cards.length)}
            </div>
          </div>
          <div className="p-2 rounded-md bg-surface-raised">
            <div className="font-medium text-ink-muted">Status</div>
            <div className="text-lg font-semibold text-[var(--color-accent)]">Ready</div>
          </div>
        </div>
      </div>
    </div>
  );
}
