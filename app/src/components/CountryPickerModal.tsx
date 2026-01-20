import type { Country } from "../types";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";

const EU_ISO3 = new Set([
  "AUT",
  "BEL",
  "BGR",
  "HRV",
  "CYP",
  "CZE",
  "DNK",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "HUN",
  "IRL",
  "ITA",
  "LVA",
  "LTU",
  "LUX",
  "MLT",
  "NLD",
  "POL",
  "PRT",
  "ROU",
  "SVK",
  "SVN",
  "ESP",
  "SWE",
]);

const G7_ISO3 = new Set(["CAN", "FRA", "DEU", "ITA", "JPN", "GBR", "USA"]);

const G20_ISO3 = new Set([
  "ARG",
  "AUS",
  "BRA",
  "CAN",
  "CHN",
  "FRA",
  "DEU",
  "IND",
  "IDN",
  "ITA",
  "JPN",
  "MEX",
  "RUS",
  "SAU",
  "ZAF",
  "KOR",
  "TUR",
  "GBR",
  "USA",
]);

const BRICS_ISO3 = new Set(["BRA", "RUS", "IND", "CHN", "ZAF"]);

const OECD_ISO3 = new Set([
  "AUS",
  "AUT",
  "BEL",
  "CAN",
  "CHL",
  "COL",
  "CRI",
  "CZE",
  "DNK",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "HUN",
  "ISL",
  "IRL",
  "ISR",
  "ITA",
  "JPN",
  "KOR",
  "LVA",
  "LTU",
  "LUX",
  "MEX",
  "NLD",
  "NZL",
  "NOR",
  "POL",
  "PRT",
  "SVK",
  "SVN",
  "ESP",
  "SWE",
  "CHE",
  "TUR",
  "GBR",
  "USA",
]);

const ASEAN_ISO3 = new Set(["BRN", "KHM", "IDN", "LAO", "MYS", "MMR", "PHL", "SGP", "THA", "VNM"]);

// African Union (AU)
const AU_ISO3 = new Set([
  "DZA",
  "AGO",
  "BEN",
  "BWA",
  "BFA",
  "BDI",
  "CPV",
  "CMR",
  "CAF",
  "TCD",
  "COM",
  "COG",
  "COD",
  "CIV",
  "DJI",
  "EGY",
  "GNQ",
  "ERI",
  "SWZ",
  "ETH",
  "GAB",
  "GMB",
  "GHA",
  "GIN",
  "GNB",
  "KEN",
  "LSO",
  "LBR",
  "LBY",
  "MDG",
  "MWI",
  "MLI",
  "MRT",
  "MUS",
  "MAR",
  "MOZ",
  "NAM",
  "NER",
  "NGA",
  "RWA",
  "STP",
  "SEN",
  "SYC",
  "SLE",
  "SOM",
  "ZAF",
  "SSD",
  "SDN",
  "TZA",
  "TGO",
  "TUN",
  "UGA",
  "ZMB",
  "ZWE",
]);

const NATO_ISO3 = new Set([
  "ALB",
  "BEL",
  "BGR",
  "CAN",
  "HRV",
  "CZE",
  "DNK",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "HUN",
  "ISL",
  "ITA",
  "LVA",
  "LTU",
  "LUX",
  "MNE",
  "NLD",
  "MKD",
  "NOR",
  "POL",
  "PRT",
  "ROU",
  "SVK",
  "SVN",
  "ESP",
  "SWE",
  "TUR",
  "GBR",
  "USA",
]);

type GroupKey = "all" | "eu" | "g7" | "g20" | "brics" | "oecd" | "asean" | "au" | "nato";

const GROUPS: Array<{ key: GroupKey; label: string; matches: (iso3: string) => boolean }> = [
  { key: "all", label: "All", matches: () => true },
  { key: "eu", label: "EU", matches: (iso3) => EU_ISO3.has(iso3) },
  { key: "g7", label: "G7", matches: (iso3) => G7_ISO3.has(iso3) },
  { key: "g20", label: "G20", matches: (iso3) => G20_ISO3.has(iso3) },
  { key: "brics", label: "BRICS", matches: (iso3) => BRICS_ISO3.has(iso3) },
  { key: "oecd", label: "OECD", matches: (iso3) => OECD_ISO3.has(iso3) },
  { key: "asean", label: "ASEAN", matches: (iso3) => ASEAN_ISO3.has(iso3) },
  { key: "au", label: "AU", matches: (iso3) => AU_ISO3.has(iso3) },
  { key: "nato", label: "NATO", matches: (iso3) => NATO_ISO3.has(iso3) },
];

export function CountryPickerModal({
  open,
  onClose,
  title,
  countries,
  selectedIso,
  excludeIso,
  onSelect,
  color = "chaser",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  countries: Country[];
  selectedIso: string;
  excludeIso?: string;
  onSelect: (iso: string) => void;
  color?: "chaser" | "target";
}) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [groupKey, setGroupKey] = useState<GroupKey>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [incomeFilter, setIncomeFilter] = useState<string>("all");

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const c of countries) {
      if (c.region?.trim()) set.add(c.region.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countries]);

  const incomes = useMemo(() => {
    const set = new Set<string>();
    for (const c of countries) {
      if (c.income_group?.trim()) set.add(c.income_group.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const group = GROUPS.find((g) => g.key === groupKey) ?? GROUPS[0];

    return countries
      .filter((c) => c.iso_alpha3 !== excludeIso)
      .filter((c) => group.matches(c.iso_alpha3))
      .filter((c) => (regionFilter === "all" ? true : (c.region?.trim() || "Other") === regionFilter))
      .filter((c) =>
        incomeFilter === "all" ? true : (c.income_group?.trim() || "Other") === incomeFilter
      )
      .filter((c) => {
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || c.iso_alpha3.toLowerCase().includes(q);
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, excludeIso, groupKey, incomeFilter, query, regionFilter]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => searchRef.current?.focus());
    return () => {
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const colorConfig =
    color === "target"
      ? {
          chip: "border-target text-target hover:bg-target-light",
          chipActive: "bg-target text-white border-target",
          selected: "bg-target-light border-target text-target",
          check: "text-target",
          heading: "text-target",
        }
      : {
          chip: "border-chaser text-chaser hover:bg-chaser-light",
          chipActive: "bg-chaser text-white border-chaser",
          selected: "bg-chaser-light border-chaser text-chaser",
          check: "text-chaser",
          heading: "text-chaser",
        };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 sheet-backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative mx-auto my-6 w-[min(980px,calc(100%-1.5rem))] rounded-2xl border border-surface bg-surface-raised shadow-2xl overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-surface-subtle">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={headingId} className={`text-lg sm:text-xl font-display font-semibold ${colorConfig.heading}`}>
                {title}
              </h2>
              <div className="mt-1 text-xs sm:text-sm text-ink-muted">
                Search or browse. {filtered.length} results
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface transition-default"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries…"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-surface bg-surface text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroupKey(g.key)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs border transition-default",
                  groupKey === g.key ? colorConfig.chipActive : `bg-surface ${colorConfig.chip}`,
                ].join(" ")}
              >
                {g.label}
              </button>
            ))}

            <div className="flex-1" />

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-1.5 rounded-full text-xs border border-surface bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              aria-label="Filter by region"
            >
              <option value="all">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>

            <select
              value={incomeFilter}
              onChange={(e) => setIncomeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-full text-xs border border-surface bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              aria-label="Filter by income group"
            >
              <option value="all">All incomes</option>
              {incomes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="max-h-[65vh] overflow-auto">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-ink-faint text-sm">No countries found</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filtered.map((c) => {
                  const selected = c.iso_alpha3 === selectedIso;
                  return (
                    <button
                      key={c.iso_alpha3}
                      type="button"
                      onClick={() => onSelect(c.iso_alpha3)}
                      className={[
                        "w-full text-left px-3 py-2 rounded-xl border transition-default",
                        "bg-surface hover:bg-surface-raised",
                        "flex items-center justify-between gap-2",
                        selected ? colorConfig.selected : "border-surface",
                      ].join(" ")}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink truncate">{c.name}</span>
                        <span className="block text-[11px] text-ink-faint font-mono">{c.iso_alpha3}</span>
                      </span>
                      {selected && (
                        <svg
                          className={`w-4 h-4 shrink-0 ${colorConfig.check}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
