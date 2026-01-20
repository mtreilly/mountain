import { useState } from "react";
import { toast } from "sonner";
import { copyTextToClipboard } from "../lib/clipboard";
import {
  generateHeadline,
  getShareUrl,
  type HeadlineData,
} from "../lib/headlineGenerator";

interface ShareHeadlineProps {
  data: HeadlineData;
}

export function ShareHeadline({ data }: ShareHeadlineProps) {
  const [mode, setMode] = useState<"short" | "long">("short");
  const headline = generateHeadline(data);
  const text = mode === "short" ? headline.short : headline.long;

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(text);
      toast.success("Copied headline");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleShare = (platform: "twitter" | "linkedin") => {
    const shareText = mode === "short" ? headline.short : headline.long;
    // Remove URL from text since we'll pass it separately for LinkedIn
    const textWithoutUrl = shareText.replace(/\n\n.+$/, "");
    const url = getShareUrl(
      platform,
      platform === "linkedin" ? textWithoutUrl : shareText,
      platform === "linkedin" ? data.appUrl : undefined
    );
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-muted">Share text</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("short")}
            className={`px-2 py-0.5 text-[10px] rounded transition-default ${
              mode === "short"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-surface text-ink-muted hover:bg-surface-raised"
            }`}
          >
            Short
          </button>
          <button
            type="button"
            onClick={() => setMode("long")}
            className={`px-2 py-0.5 text-[10px] rounded transition-default ${
              mode === "long"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-surface text-ink-muted hover:bg-surface-raised"
            }`}
          >
            Long
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="p-2.5 rounded-lg border border-surface bg-surface text-xs text-ink leading-relaxed min-h-[60px] max-h-[100px] overflow-y-auto">
          {text}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default inline-flex items-center justify-center gap-1.5"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy
        </button>
        <button
          type="button"
          onClick={() => handleShare("twitter")}
          className="px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default inline-flex items-center justify-center gap-1.5"
          title="Share on X (Twitter)"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleShare("linkedin")}
          className="px-3 py-1.5 rounded-lg border border-surface bg-surface text-ink text-xs font-medium hover:bg-surface-raised transition-default inline-flex items-center justify-center gap-1.5"
          title="Share on LinkedIn"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
