import { useState } from "react";
import { toast } from "sonner";
import {
  copyAllCaptions,
  downloadThreadZip,
  type ThreadCard,
  type ThreadPackage,
} from "../lib/threadGenerator";

interface ThreadExportOptionsProps {
  cards: ThreadCard[];
  chaserCode: string;
  targetCode: string;
  theme: "light" | "dark";
  onRegenerate: () => void;
}

export function ThreadExportOptions({
  cards,
  chaserCode,
  targetCode,
  theme,
  onRegenerate,
}: ThreadExportOptionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const handleDownloadZip = async () => {
    if (cards.length === 0) return;

    setIsDownloading(true);
    try {
      const pkg: ThreadPackage = {
        cards,
        theme,
        chaserCode,
        targetCode,
      };
      await downloadThreadZip(pkg);
      toast.success("Downloaded thread package");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download ZIP");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyAllCaptions = async () => {
    if (cards.length === 0) return;

    setIsCopying(true);
    try {
      await copyAllCaptions(cards);
      toast.success("Copied all captions");
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy captions");
    } finally {
      setIsCopying(false);
    }
  };

  const isDisabled = cards.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Primary: Download ZIP */}
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={isDownloading || isDisabled}
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-default disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              Creating ZIP...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download ZIP
            </>
          )}
        </button>

        {/* Secondary: Copy All Captions */}
        <button
          type="button"
          onClick={handleCopyAllCaptions}
          disabled={isCopying || isDisabled}
          className="flex-1 px-4 py-3 rounded-xl border border-surface bg-surface-raised text-ink text-sm font-semibold hover:bg-surface transition-default disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {isCopying ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-t-current border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              Copying...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy All Captions
            </>
          )}
        </button>

        {/* Regenerate */}
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isDisabled}
          className="px-4 py-3 rounded-xl border border-surface bg-surface-raised text-ink-muted text-sm font-medium hover:bg-surface hover:text-ink transition-default disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Regenerate
        </button>
      </div>

      {/* ZIP contents info */}
      <div className="rounded-lg bg-surface/50 p-3 border border-surface">
        <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
          ZIP Package Contents
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            4 PNG images (1200×675)
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            captions.txt
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            README.txt
          </div>
        </div>
      </div>
    </div>
  );
}
