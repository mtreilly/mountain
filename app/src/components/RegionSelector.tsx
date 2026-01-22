import { useMemo, useState } from "react";
import { useOECDRegions } from "../hooks/useOECDRegions";
import { RegionPickerModal } from "./RegionPickerModal";

interface RegionSelectorProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  countryCode?: string;
  excludeCode?: string;
  color?: "chaser" | "target";
  dense?: boolean;
}

export function RegionSelector({
  label,
  value,
  onChange,
  countryCode,
  excludeCode,
  color = "chaser",
  dense = false,
}: RegionSelectorProps) {
  const { regions, getRegionsByCountry, getRegionByCode } = useOECDRegions();
  const [open, setOpen] = useState(false);

  const selectedRegion = getRegionByCode(value);

  const regionList = useMemo(() => {
    const base = countryCode ? getRegionsByCountry(countryCode) : regions;
    return excludeCode ? base.filter((r) => r.code !== excludeCode) : base;
  }, [countryCode, excludeCode, getRegionsByCountry, regions]);

  const colorClasses =
    color === "chaser"
      ? "border-l-[var(--color-chaser)]"
      : "border-l-[var(--color-target)]";
  const labelPill =
    color === "chaser"
      ? "bg-chaser-light text-chaser"
      : "bg-target-light text-target";

  return (
    <div className={dense ? "" : "space-y-1"}>
      {!dense && (
        <label className="block text-xs font-medium text-ink-muted">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${selectedRegion?.name ?? "Select a region"}`}
        className={[
          `w-full rounded border-l-4 ${colorClasses} border border-surface bg-surface text-left text-ink hover:bg-surface-raised transition-default flex items-center justify-between gap-1.5`,
          dense ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
          {dense && (
            <span
              className={`shrink-0 text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider ${labelPill}`}
            >
              {label}
            </span>
          )}
          {selectedRegion ? (
            <>
              <span className="truncate">{selectedRegion.name}</span>
              <span className="text-ink-muted text-[10px] shrink-0">
                ({selectedRegion.countryName})
              </span>
            </>
          ) : (
            <span className="text-ink-muted">Select region...</span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-ink-muted shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <RegionPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        regions={regionList}
        selectedCode={value}
        excludeCode={excludeCode}
        countryCode={countryCode}
        color={color}
        onSelect={(code) => {
          onChange(code);
          setOpen(false);
        }}
      />
    </div>
  );
}

