import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Indicator } from "../types";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export function MetricSelector({
  value,
  onChange,
  indicators,
  disabled,
  dense = false,
}: {
  value: string;
  onChange: (code: string) => void;
  indicators: Indicator[];
  disabled?: boolean;
  dense?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [popover, setPopover] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const isMobile = useIsMobile();

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = indicators.filter((ind) => {
      if (!q) return true;
      return ind.name.toLowerCase().includes(q) || ind.code.toLowerCase().includes(q);
    });

    return filtered.reduce(
      (acc, indicator) => {
        const category = indicator.category?.trim() || "Other";
        if (!acc[category]) acc[category] = [];
        acc[category].push(indicator);
        return acc;
      },
      {} as Record<string, Indicator[]>
    );
  }, [indicators, search]);

  const flatList = useMemo(() => {
    const result: Indicator[] = [];
    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([, items]) => {
        items.sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => result.push(item));
      });
    return result;
  }, [grouped]);

  const selectedIndicator = indicators.find((i) => i.code === value);

  const calculatePopover = useMemo(() => {
    return () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return null;

      const margin = 8;
      const availableBelow = window.innerHeight - rect.bottom - margin;
      const availableAbove = rect.top - margin;
      const openDown = availableBelow >= 280 || availableBelow >= availableAbove;
      const maxHeight = Math.max(260, Math.min(400, openDown ? availableBelow : availableAbove));

      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - margin - rect.width));
      const top = openDown ? rect.bottom + margin : Math.max(margin, rect.top - margin - maxHeight);

      return { top, left, width: rect.width, maxHeight };
    };
  }, []);

  const close = () => {
    setIsOpen(false);
    setSearch("");
    setActiveIndex(-1);
    setPopover(null);
  };

  const open = () => {
    if (disabled) return;
    if (!isMobile) {
      const nextPopover = calculatePopover();
      if (nextPopover) setPopover(nextPopover);
    }
    const selectedIndex = flatList.findIndex((i) => i.code === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : flatList.length ? 0 : -1);
    setIsOpen(true);
    queueMicrotask(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (!isOpen || isMobile) return;

    const onResize = () => setPopover(calculatePopover());
    const onScroll = () => setPopover(calculatePopover());
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [calculatePopover, isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isMobile]);

  const handleSelect = (code: string) => {
    onChange(code);
    close();
  };

  const ListContent = (
    <>
      {flatList.length === 0 ? (
        <div className="px-4 py-12 text-center text-ink-faint text-sm">No metrics found</div>
      ) : (
        (() => {
          let lastCategory: string | null = null;
          return flatList.map((indicator, idx) => {
            const category = indicator.category?.trim() || "Other";
            const showCategory = category !== lastCategory;
            lastCategory = category;
            const active = idx === activeIndex;
            const selected = indicator.code === value;

            return (
              <div key={indicator.code}>
                {showCategory && (
                  <div className="px-4 py-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider bg-surface-sunken sticky top-0">
                    {category}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(indicator.code)}
                  className={[
                    "w-full px-4 py-3 text-left transition-default focus-ring",
                    "focus-visible:bg-surface-sunken",
                    active ? "bg-surface-sunken" : "",
                    selected ? "bg-amber-50 dark:bg-amber-950/30" : "",
                  ].join(" ")}
                >
                  <span className={`font-medium text-ink ${selected ? "text-amber-700 dark:text-amber-400" : ""}`}>
                    {indicator.name}
                  </span>
                  {indicator.unit && (
                    <span className="ml-2 text-xs text-ink-faint">({indicator.unit})</span>
                  )}
                </button>
              </div>
            );
          });
        })()
      )}
    </>
  );

  return (
    <div className={dense ? "" : "space-y-1"}>
      {!dense && (
        <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
          Metric
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
          if (e.key === "Escape") close();
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={[
          "w-full text-left rounded border transition-default",
          "bg-surface-raised flex items-center justify-between gap-1.5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-accent)]",
          "shadow-sm hover:shadow",
          "border-surface hover:border-[var(--color-ink-faint)]",
          disabled ? "opacity-60 cursor-not-allowed" : "",
          dense ? "px-2 py-1" : "px-3 py-2",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 flex items-center gap-1.5">
          {dense && (
            <span className="shrink-0 text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider bg-surface-sunken border border-surface text-ink-muted">
              Metric
            </span>
          )}
          <span className={`truncate ${dense ? "text-xs" : "text-sm"} ${selectedIndicator ? "font-semibold text-ink" : "text-ink-faint"}`}>
            {selectedIndicator?.name || "Select..."}
          </span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-ink-faint shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Desktop popover */}
      {isOpen && !isMobile && popover &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 overflow-hidden rounded-xl border border-surface bg-surface-raised shadow-xl animate-scale-in"
            style={{ top: popover.top, left: popover.left, width: popover.width }}
          >
            <div className="p-3 border-b border-surface-subtle">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveIndex((i) => (flatList.length ? Math.min(i + 1, flatList.length - 1) : -1));
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveIndex((i) => Math.max(i - 1, 0));
                    }
                    if (e.key === "Enter") {
                      const indicator = flatList[activeIndex];
                      if (indicator) {
                        e.preventDefault();
                        handleSelect(indicator.code);
                      }
                    }
                    if (e.key === "Escape") close();
                  }}
                  placeholder="Search metrics..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-surface bg-surface rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-ink placeholder:text-ink-faint"
                />
              </div>
            </div>

            <div
              id={listboxId}
              role="listbox"
              className="overflow-y-auto"
              style={{ maxHeight: popover.maxHeight - 70 }}
            >
              {ListContent}
            </div>
          </div>,
          document.body
        )}

      {/* Mobile full-screen sheet */}
      {isOpen && isMobile &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 sheet-backdrop animate-fade-in" onClick={close} />

            <div
              ref={popoverRef}
              className="absolute bottom-0 left-0 right-0 bg-surface-raised rounded-t-2xl shadow-2xl animate-slide-up flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-surface-sunken" />
              </div>

              <div className="px-4 py-3 border-b border-surface-subtle bg-amber-50 dark:bg-amber-950/30">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-display font-semibold text-amber-700 dark:text-amber-400">
                    Select Metric
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    className="p-2 -mr-2 rounded-lg hover:bg-surface-sunken transition-default"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-faint"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Search metrics..."
                    className="w-full pl-11 pr-4 py-3 text-base border border-surface bg-surface-raised rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-ink placeholder:text-ink-faint"
                  />
                </div>
              </div>

              <div id={listboxId} role="listbox" className="flex-1 overflow-y-auto overscroll-contain">
                {ListContent}
              </div>

              <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
