import { useTranslation } from "react-i18next";

export function ImplicationsTrigger({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full card interactive-card focus-ring p-4 text-left"
    >
      <span className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-accent)]/10">
          <svg
            className="size-5 text-[var(--color-accent)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-ink">
            {t("sidebar.implicationsTitle")}
          </span>
          <span className="block text-xs text-ink-muted mt-0.5 text-pretty">
            {t("sidebar.implicationsDesc")}
          </span>
        </span>
        <svg
          className="nudge-right size-4 shrink-0 text-ink-faint"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}
