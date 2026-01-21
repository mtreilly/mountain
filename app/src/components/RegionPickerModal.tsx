import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OECDRegion } from "../lib/oecdRegions";

export function RegionPickerModal({
  open,
  onClose,
  title,
  regions,
  selectedCode,
  excludeCode,
  countryCode,
  onSelect,
  color = "chaser",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  regions: OECDRegion[];
  selectedCode: string;
  excludeCode?: string;
  countryCode?: string;
  onSelect: (code: string) => void;
  color?: "chaser" | "target";
}) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regions
      .filter((r) => r.code !== excludeCode)
      .filter((r) => (countryCode ? r.countryCode === countryCode : true))
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.countryName.toLowerCase().includes(q) ||
          r.countryCode.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const byCountry = a.countryName.localeCompare(b.countryName);
        if (byCountry !== 0) return byCountry;
        const byName = a.name.localeCompare(b.name);
        if (byName !== 0) return byName;
        return a.code.localeCompare(b.code);
      });
  }, [countryCode, excludeCode, query, regions]);

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
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
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
          selected: "bg-target-light border-target text-target",
          check: "text-target",
          heading: "text-target",
        }
      : {
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
              <h2
                id={headingId}
                className={`text-lg sm:text-xl font-display font-semibold ${colorConfig.heading}`}
              >
                {title}
              </h2>
              <div className="mt-1 text-xs sm:text-sm text-ink-muted">
                Search or browse. {filtered.length} results
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface transition-default focus-ring"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-ink-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search regions…"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-surface bg-surface text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="max-h-[65vh] overflow-auto">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-ink-faint text-sm">
                No regions found
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filtered.map((r) => {
                  const selected = r.code === selectedCode;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => onSelect(r.code)}
                      className={[
                        "w-full text-left px-3 py-2 rounded-xl border transition-default",
                        "bg-surface hover:bg-surface-raised",
                        "flex items-center justify-between gap-2",
                        "focus-ring focus-visible:bg-surface-raised",
                        selected ? colorConfig.selected : "border-surface",
                      ].join(" ")}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink truncate">
                          {r.name}
                        </span>
                        <span className="block text-[11px] text-ink-faint truncate">
                          {r.countryName}
                        </span>
                        <span className="block text-[11px] text-ink-faint font-mono">
                          {r.code}
                        </span>
                      </span>
                      {selected && (
                        <svg
                          className={`w-4 h-4 shrink-0 ${colorConfig.check}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
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
    document.body,
  );
}

