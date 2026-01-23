import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import type { EmbedParams, EmbedTheme, ShareState } from "../lib/shareState";
import { toEmbedSearchString, toSearchString } from "../lib/shareState";

interface EmbedCodeGeneratorProps {
  shareState: ShareState;
}

export function EmbedCodeGenerator({ shareState }: EmbedCodeGeneratorProps) {
  const [interactive, setInteractive] = useState(true);
  const [embedTheme, setEmbedTheme] = useState<EmbedTheme>("auto");
  const [height, setHeight] = useState(400);
  const heightInputId = useId();
  const interactivityButtonRefs = useRef<{
    interactive: HTMLButtonElement | null;
    static: HTMLButtonElement | null;
  }>({ interactive: null, static: null });
  const themeButtonRefs = useRef<Record<EmbedTheme, HTMLButtonElement | null>>({
    auto: null,
    light: null,
    dark: null,
  });

  const embedParams: Partial<EmbedParams> = useMemo(
    () => ({
      interactive,
      embedTheme,
      height,
    }),
    [interactive, embedTheme, height],
  );

  const embedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const search = toEmbedSearchString(shareState, embedParams);
    return `${window.location.origin}${window.location.pathname}${search}`;
  }, [shareState, embedParams]);

  const iframeCode = useMemo(() => {
    return `<iframe
  src="${embedUrl}"
  width="100%"
  height="${height}"
  frameborder="0"
  loading="lazy"
  style="border: 1px solid #e5e5e5; border-radius: 8px;"
></iframe>`;
  }, [embedUrl, height]);

  const imageUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(toSearchString(shareState).slice(1));

    const resolvedTheme =
      embedTheme === "dark"
        ? "dark"
        : embedTheme === "light"
          ? "light"
          : typeof document === "undefined"
            ? "light"
            : document.documentElement.classList.contains("dark")
              ? "dark"
              : "light";

    if (resolvedTheme === "dark") params.set("theme", "dark");
    else params.delete("theme");

    return `${window.location.origin}/api/og.png?${params.toString()}`;
  }, [embedTheme, shareState]);

  const copyEmbedCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      toast.success("Embed code copied to clipboard");
    } catch {
      toast.error("Failed to copy embed code");
    }
  }, [iframeCode]);

  const copyImageUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success("Image URL copied to clipboard");
    } catch {
      toast.error("Failed to copy image URL");
    }
  }, [imageUrl]);

  const handleInteractivityKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const order: Array<"interactive" | "static"> = ["interactive", "static"];
    const current = interactive ? 0 : 1;
    const next =
      e.key === "Home"
        ? order[0]
        : e.key === "End"
          ? order[order.length - 1]
          : order[(current + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length];
    setInteractive(next === "interactive");
    queueMicrotask(() => interactivityButtonRefs.current[next]?.focus());
  };

  const handleThemeKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const order: EmbedTheme[] = ["auto", "light", "dark"];
    const current = order.indexOf(embedTheme);
    const next =
      e.key === "Home"
        ? order[0]
        : e.key === "End"
          ? order[order.length - 1]
          : order[(current + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length];
    setEmbedTheme(next);
    queueMicrotask(() => themeButtonRefs.current[next]?.focus());
  };

  return (
    <div className="space-y-4">
      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        {/* Interactivity */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-2">Interactivity</label>
          <div
            role="radiogroup"
            aria-label="Interactivity"
            className="flex gap-2"
            onKeyDown={handleInteractivityKeyDown}
          >
            <button
              type="button"
              onClick={() => setInteractive(true)}
              ref={(el) => {
                interactivityButtonRefs.current.interactive = el;
              }}
              role="radio"
              aria-checked={interactive}
              tabIndex={interactive ? 0 : -1}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-default ${
                interactive
                  ? "bg-chaser text-white border-chaser"
                  : "bg-surface border-surface text-ink hover:bg-surface-sunken"
              }`}
            >
              Interactive
            </button>
            <button
              type="button"
              onClick={() => setInteractive(false)}
              ref={(el) => {
                interactivityButtonRefs.current.static = el;
              }}
              role="radio"
              aria-checked={!interactive}
              tabIndex={!interactive ? 0 : -1}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-default ${
                !interactive
                  ? "bg-chaser text-white border-chaser"
                  : "bg-surface border-surface text-ink hover:bg-surface-sunken"
              }`}
            >
              Static
            </button>
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-2">Theme</label>
          <div role="radiogroup" aria-label="Theme" className="flex gap-1" onKeyDown={handleThemeKeyDown}>
            {(["auto", "light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEmbedTheme(t)}
                ref={(el) => {
                  themeButtonRefs.current[t] = el;
                }}
                role="radio"
                aria-checked={embedTheme === t}
                tabIndex={embedTheme === t ? 0 : -1}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-default capitalize ${
                  embedTheme === t
                    ? "bg-chaser text-white border-chaser"
                    : "bg-surface border-surface text-ink hover:bg-surface-sunken"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Height input */}
      <div>
        <label htmlFor={heightInputId} className="block text-xs font-medium text-ink-muted mb-2">
          Height (px)
        </label>
        <input
          id={heightInputId}
          type="number"
          min={320}
          max={800}
          step={20}
          value={height}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(v)) {
              setHeight(Math.max(320, Math.min(800, v)));
            }
          }}
          className="w-full max-w-[100px] px-3 py-1.5 rounded-lg border border-surface bg-surface-raised text-ink text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Embed code */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2">Embed Code</label>
        <div className="relative">
          <pre className="p-3 rounded-lg bg-surface-sunken border border-surface text-xs text-ink-muted overflow-x-auto whitespace-pre-wrap break-all font-mono">
            {iframeCode}
          </pre>
          <button
            type="button"
            onClick={copyEmbedCode}
            className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded bg-surface-raised border border-surface text-ink hover:bg-surface transition-default"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Platform compatibility note */}
      <div className="p-3 rounded-lg bg-surface-sunken border border-surface">
        <p className="text-xs text-ink-muted">
          <strong className="text-ink">Works on:</strong> Substack, WordPress, Ghost, Notion
        </p>
        <p className="text-xs text-ink-muted mt-1">
          <strong className="text-ink">For Medium:</strong> Use the static image below instead (iframes not supported)
        </p>
      </div>

      {/* Image fallback */}
      {imageUrl && (
        <div className="pt-3 border-t border-surface">
          <label className="block text-xs font-medium text-ink-muted mb-2">
            Static Image (for Medium, LinkedIn, etc.)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyImageUrl}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-surface bg-surface-raised text-ink hover:bg-surface transition-default inline-flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              Copy Image URL
            </button>
            <a
              href={imageUrl}
              download="convergence-chart.png"
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-surface bg-surface-raised text-ink hover:bg-surface transition-default inline-flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Image
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
