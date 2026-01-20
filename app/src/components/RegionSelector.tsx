import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { OECDRegion } from "../lib/oecdRegions";
import { useOECDRegions } from "../hooks/useOECDRegions";

interface RegionSelectorProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  countryCode?: string; // If provided, only show regions for this country
  excludeCode?: string; // Region to exclude (e.g., already selected as other)
  color?: "chaser" | "target";
}

export function RegionSelector({
  label,
  value,
  onChange,
  countryCode,
  excludeCode,
  color = "chaser",
}: RegionSelectorProps) {
  const { regions, countriesWithRegions, getRegionsByCountry, getRegionByCode } =
    useOECDRegions();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [popover, setPopover] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedRegion = getRegionByCode(value);

  // Group regions by country
  const groupedRegions = useMemo(() => {
    let regionList = countryCode
      ? getRegionsByCountry(countryCode)
      : regions;

    if (excludeCode) {
      regionList = regionList.filter((r) => r.code !== excludeCode);
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      regionList = regionList.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          r.code.toLowerCase().includes(searchLower) ||
          r.countryName.toLowerCase().includes(searchLower)
      );
    }

    // Group by country
    const grouped: Record<string, OECDRegion[]> = {};
    for (const region of regionList) {
      if (!grouped[region.countryCode]) {
        grouped[region.countryCode] = [];
      }
      grouped[region.countryCode].push(region);
    }

    return grouped;
  }, [regions, countryCode, excludeCode, search, getRegionsByCountry]);

  const updatePopover = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const margin = 8;
    const width = Math.max(300, rect.width);
    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - margin - width)
    );
    const top = rect.bottom + margin;

    setPopover({ top, left, width });
  }, []);

  const open = useCallback(() => {
    updatePopover();
    setIsOpen(true);
    setSearch("");
    // Focus input after opening
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [updatePopover]);

  const close = useCallback(() => {
    setIsOpen(false);
    setPopover(null);
    setSearch("");
  }, []);

  // Handle click outside
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

  // Update popover position on resize/scroll
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => updatePopover();
    const onScroll = () => updatePopover();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, updatePopover]);

  const colorClasses =
    color === "chaser"
      ? "border-l-[var(--color-chaser)]"
      : "border-l-[var(--color-target)]";

  const countryNames: Record<string, string> = {
    GBR: "United Kingdom",
    USA: "United States",
    DEU: "Germany",
    FRA: "France",
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-ink-muted">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close() : open())}
        className={`w-full px-3 py-2 rounded-lg border-l-4 ${colorClasses} border border-surface bg-surface text-left text-sm text-ink hover:bg-surface-raised transition-default flex items-center justify-between gap-2`}
      >
        <span className="truncate">
          {selectedRegion ? (
            <>
              {selectedRegion.name}
              <span className="text-ink-muted ml-1">
                ({selectedRegion.countryName})
              </span>
            </>
          ) : (
            <span className="text-ink-muted">Select region...</span>
          )}
        </span>
        <svg
          className="w-4 h-4 text-ink-muted shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen &&
        popover &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            aria-label={`Select ${label}`}
            className="fixed z-50 rounded-xl border border-surface bg-surface-raised shadow-xl overflow-hidden"
            style={{ top: popover.top, left: popover.left, width: popover.width }}
          >
            {/* Search input */}
            <div className="p-2 border-b border-surface">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search regions..."
                className="w-full px-3 py-2 rounded-lg border border-surface bg-surface text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            {/* Region list */}
            <div className="max-h-64 overflow-y-auto">
              {Object.entries(groupedRegions).length === 0 ? (
                <div className="p-4 text-center text-sm text-ink-muted">
                  No regions found
                </div>
              ) : (
                Object.entries(groupedRegions).map(([countryCode, countryRegions]) => (
                  <div key={countryCode}>
                    {/* Country header */}
                    <div className="px-3 py-1.5 bg-surface text-xs font-semibold text-ink-muted sticky top-0">
                      {countryNames[countryCode] || countryCode}
                    </div>
                    {/* Regions */}
                    {countryRegions.map((region) => (
                      <button
                        key={region.code}
                        type="button"
                        onClick={() => {
                          onChange(region.code);
                          close();
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-surface transition-default flex items-center justify-between gap-2 ${
                          region.code === value
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                            : "text-ink"
                        }`}
                      >
                        <span className="truncate">{region.name}</span>
                        <span className="text-xs text-ink-faint shrink-0">
                          {region.code}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Info footer */}
            <div className="p-2 border-t border-surface bg-surface">
              <p className="text-[10px] text-ink-faint text-center">
                {regions.length} regions from {countriesWithRegions.length} countries
                {" · "}
                <a
                  href="https://data-explorer.oecd.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  OECD Data
                </a>
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
