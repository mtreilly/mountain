import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Country } from "../types";

interface CountrySelectorProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  countries: Country[];
  excludeIso?: string;
  color?: "chaser" | "target";
}

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

export function CountrySelector({
  label,
  value,
  onChange,
  countries,
  excludeIso,
  color = "chaser",
}: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
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

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return countries
      .filter((c) => c.iso_alpha3 !== excludeIso)
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) || c.iso_alpha3.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const ra = a.region?.trim() || "Other";
        const rb = b.region?.trim() || "Other";
        const regionCmp = ra.localeCompare(rb);
        if (regionCmp !== 0) return regionCmp;
        return a.name.localeCompare(b.name);
      });
  }, [countries, excludeIso, search]);

  const selectedCountry = countries.find((c) => c.iso_alpha3 === value);

  const calculatePopover = useMemo(() => {
    return () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return null;

      const margin = 8;
      const availableBelow = window.innerHeight - rect.bottom - margin;
      const availableAbove = rect.top - margin;
      const openDown = availableBelow >= 280 || availableBelow >= availableAbove;
      const maxHeight = Math.max(
        260,
        Math.min(400, openDown ? availableBelow : availableAbove)
      );

      const left = Math.max(
        margin,
        Math.min(rect.left, window.innerWidth - margin - rect.width)
      );
      const top = openDown
        ? rect.bottom + margin
        : Math.max(margin, rect.top - margin - maxHeight);

      return {
        top,
        left,
        width: rect.width,
        maxHeight,
      };
    };
  }, []);

  const close = useMemo(() => {
    return () => {
      setIsOpen(false);
      setSearch("");
      setActiveIndex(-1);
      setPopover(null);
    };
  }, []);

  const open = useMemo(() => {
    return () => {
      if (!isMobile) {
        const nextPopover = calculatePopover();
        if (nextPopover) setPopover(nextPopover);
      }
      const selectedIndex = filteredCountries.findIndex((c) => c.iso_alpha3 === value);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : filteredCountries.length ? 0 : -1);
      setIsOpen(true);
      queueMicrotask(() => inputRef.current?.focus());
    };
  }, [calculatePopover, filteredCountries, value, isMobile]);

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
  }, [close, isOpen]);

  // Lock body scroll on mobile when sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isMobile]);

  const colorConfig = {
    chaser: {
      border: "border-chaser hover:border-[var(--color-chaser)] focus-visible:ring-[var(--color-chaser-muted)]",
      badge: "bg-chaser-light text-chaser",
      highlight: "bg-chaser-light",
      accentText: "text-chaser",
      headerBg: "bg-chaser-light",
    },
    target: {
      border: "border-target hover:border-[var(--color-target)] focus-visible:ring-[var(--color-target-muted)]",
      badge: "bg-target-light text-target",
      highlight: "bg-target-light",
      accentText: "text-target",
      headerBg: "bg-target-light",
    },
  };

  const colors = colorConfig[color];

  const handleSelect = (iso: string) => {
    onChange(iso);
    close();
  };

  const ListContent = (
    <>
      {filteredCountries.length === 0 ? (
        <div className="px-4 py-12 text-center text-ink-faint text-sm">
          No countries found
        </div>
      ) : (
        (() => {
          let lastRegion: string | null = null;
          return filteredCountries.map((country, idx) => {
            const region = country.region?.trim() || "Other";
            const showRegion = region !== lastRegion;
            lastRegion = region;
            const active = idx === activeIndex;
            const selected = country.iso_alpha3 === value;

            return (
              <div key={country.iso_alpha3}>
                {showRegion && (
                  <div className="px-4 py-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider bg-surface-sunken sticky top-0">
                    {region}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(country.iso_alpha3)}
                  className={[
                    "w-full px-4 py-3 text-left flex items-center justify-between gap-3",
                    "transition-default",
                    active ? "bg-surface-sunken" : "",
                    selected ? colors.highlight : "",
                  ].join(" ")}
                >
                  <span className={`font-medium text-ink ${selected ? colors.accentText : ""}`}>
                    {country.name}
                  </span>
                  <span className="text-xs text-ink-faint font-mono">{country.iso_alpha3}</span>
                </button>
              </div>
            );
          });
        })()
      )}
    </>
  );

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink-muted">{label}</label>

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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={[
          "w-full px-4 py-3 text-left rounded-xl border transition-default",
          "bg-surface-raised flex items-center justify-between gap-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "shadow-sm hover:shadow",
          colors.border,
        ].join(" ")}
      >
        {selectedCountry ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-base font-semibold text-ink truncate">
              {selectedCountry.name}
            </span>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-mono font-medium ${colors.badge}`}>
              {selectedCountry.iso_alpha3}
            </span>
          </div>
        ) : (
          <span className="text-ink-faint">Select a country...</span>
        )}
        <svg
          className={`w-5 h-5 text-ink-faint transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
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
                      setActiveIndex((i) =>
                        filteredCountries.length ? Math.min(i + 1, filteredCountries.length - 1) : -1
                      );
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveIndex((i) => Math.max(i - 1, 0));
                    }
                    if (e.key === "Enter") {
                      const country = filteredCountries[activeIndex];
                      if (country) {
                        e.preventDefault();
                        handleSelect(country.iso_alpha3);
                      }
                    }
                    if (e.key === "Escape") close();
                  }}
                  placeholder="Search countries..."
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
            {/* Backdrop */}
            <div
              className="absolute inset-0 sheet-backdrop animate-fade-in"
              onClick={close}
            />

            {/* Sheet */}
            <div
              ref={popoverRef}
              className="absolute bottom-0 left-0 right-0 bg-surface-raised rounded-t-2xl shadow-2xl animate-slide-up flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-surface-sunken" />
              </div>

              {/* Header */}
              <div className={`px-4 py-3 border-b border-surface-subtle ${colors.headerBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-lg font-display font-semibold ${colors.accentText}`}>
                    {label}
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

                {/* Search */}
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
                    placeholder="Search countries..."
                    className="w-full pl-11 pr-4 py-3 text-base border border-surface bg-surface-raised rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-ink placeholder:text-ink-faint"
                  />
                </div>
              </div>

              {/* List */}
              <div
                id={listboxId}
                role="listbox"
                className="flex-1 overflow-y-auto overscroll-contain"
              >
                {ListContent}
              </div>

              {/* Safe area padding for iOS */}
              <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
          </div>,
          document.body
        )}

      {/* Income group badge */}
      {selectedCountry && (
        <div className="text-xs text-ink-faint">{selectedCountry.income_group}</div>
      )}
    </div>
  );
}
