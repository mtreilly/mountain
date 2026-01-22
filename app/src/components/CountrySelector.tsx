import { useMemo, useState } from "react";
import type { Country } from "../types";
import { CountryPickerModal } from "./CountryPickerModal";

interface CountrySelectorProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  countries: Country[];
  excludeIso?: string;
  color?: "chaser" | "target";
  dense?: boolean;
}

export function CountrySelector({
  label,
  value,
  onChange,
  countries,
  excludeIso,
  color = "chaser",
  dense = false,
}: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedCountry = useMemo(
    () => countries.find((c) => c.iso_alpha3 === value) || null,
    [countries, value]
  );

  const colorConfig = {
    chaser: {
      border: "border-chaser hover:border-[var(--color-chaser)] focus-visible:ring-[var(--color-chaser-muted)]",
      badge: "bg-chaser-light text-chaser",
    },
    target: {
      border: "border-target hover:border-[var(--color-target)] focus-visible:ring-[var(--color-target-muted)]",
      badge: "bg-target-light text-target",
    },
  };

  const colors = colorConfig[color];
  const labelPill =
    color === "chaser"
      ? "bg-chaser-light text-chaser"
      : "bg-target-light text-target";

  return (
    <div className={dense ? "" : "space-y-1"}>
      {!dense && (
        <label className="block text-xs font-medium text-ink-muted uppercase tracking-wider">
          {label}
        </label>
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
        aria-label={`${label}: ${selectedCountry?.name ?? "Select a country"}`}
        className={[
          "w-full text-left rounded border transition-default",
          "bg-surface-raised flex items-center justify-between gap-1.5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "shadow-sm hover:shadow",
          colors.border,
          dense ? "px-2 py-1" : "px-3 py-2",
        ].join(" ")}
      >
        {selectedCountry ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {dense && (
              <span
                className={`shrink-0 text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider ${labelPill}`}
              >
                {label}
              </span>
            )}
            <span className={`font-semibold text-ink truncate ${dense ? "text-xs" : "text-sm"}`}>
              {selectedCountry.name}
            </span>
            <span
              className={`shrink-0 text-[9px] px-1 py-0.5 rounded font-mono font-medium ${colors.badge}`}
            >
              {selectedCountry.iso_alpha3}
            </span>
          </div>
        ) : (
          <span className={`text-ink-faint ${dense ? "text-xs" : "text-sm"}`}>Select...</span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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

      <CountryPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        countries={countries}
        selectedIso={value}
        excludeIso={excludeIso}
        color={color}
        onSelect={(iso) => {
          onChange(iso);
          setOpen(false);
        }}
      />
    </div>
  );
}
