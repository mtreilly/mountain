import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getDataSourceBaseUrl, getDataSourceLicense } from "../lib/dataSourceUrls";

const SOURCE_ATTRIBUTIONS: Record<string, { text: string; url: string | null }> = {
  "Penn World Table": {
    text: "Feenstra RC, Inklaar R, Timmer MP (2015), The Next Generation of the Penn World Table.",
    url: "https://www.aeaweb.org/articles?id=10.1257/aer.20130954",
  },
};
const EMPTY_DATA_SOURCE_NAMES: string[] = [];

export function AppFooter({
  comparisonMode = "countries",
  countriesCount,
  regionsCount,
  dataSourceName,
  dataSourceNames = EMPTY_DATA_SOURCE_NAMES,
}: {
  comparisonMode?: "countries" | "regions";
  countriesCount: number;
  regionsCount?: number;
  dataSourceName?: string | null;
  dataSourceNames?: string[];
}) {
  const { t } = useTranslation();
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isRegions = comparisonMode === "regions";
  const resolvedSourceName = isRegions
    ? "OECD"
    : dataSourceName?.trim()
      ? dataSourceName.trim()
      : "Penn World Table";
  const sourceRows = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{
      name: string;
      url: string | null;
      license: string | null;
      attribution: { text: string; url: string | null } | null;
    }> = [];

    const addSource = (source: string) => {
      const trimmed = source.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      rows.push({
        name: trimmed,
        url: trimmed === "OECD" ? "https://www.oecd.org/" : (getDataSourceBaseUrl(trimmed) ?? null),
        license: getDataSourceLicense(trimmed)?.name ?? null,
        attribution: SOURCE_ATTRIBUTIONS[trimmed] ?? null,
      });
    };

    for (const source of dataSourceNames) addSource(source);
    addSource("Penn World Table");
    addSource("OECD");
    addSource(resolvedSourceName);

    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [dataSourceNames, resolvedSourceName]);

  const handleClose = useCallback(() => {
    setIsDataSourcesOpen(false);
  }, []);
  const closeFromEffect = useEffectEvent(() => {
    handleClose();
  });

  useEffect(() => {
    if (!isDataSourcesOpen) return;

    const prev = document.activeElement as HTMLElement | null;
    queueMicrotask(() => closeButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromEffect();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (modalRef.current?.contains(target)) return;
      closeFromEffect();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.body.style.overflow = "";
      if (prev && prev.isConnected && prev.tagName !== "BODY" && prev.tagName !== "HTML") {
        prev.focus();
      }
    };
  }, [isDataSourcesOpen]);

  return (
    <footer className="mt-10 lg:mt-12 pt-6 border-t border-surface">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-ink-faint">
        <p>
          {t("footer.data")}{" "}
          <button
            type="button"
            onClick={() => setIsDataSourcesOpen(true)}
            className="text-[var(--color-accent)] hover:underline focus-ring rounded-sm"
            aria-label={t("footer.openDataSources")}
          >
            {t("footer.dataSources")}
          </button>
          {" · "}
          {t("footer.inspiredBy")}{" "}
          <a
            href="https://oliverwkim.com/The-Mountain-To-Climb/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Oliver Kim
          </a>
          {" · "}
          <a
            href="https://www.global-developments.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Global Developments
          </a>
          {" · "}
          {isRegions
            ? t("footer.regionsCount", { count: regionsCount ?? 0 })
            : t("footer.countriesCount", { count: countriesCount })}
        </p>
        <p className="flex items-center gap-1.5">
          <span>{t("footer.builtBy")}</span>
          <a
            href="https://actuallymaybe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Micheál
          </a>
          <span className="text-ink-faint/50">·</span>
          <a
            href="https://x.com/MichealReilly"
            target="_blank"
            rel="noopener noreferrer me"
            className="text-ink-faint hover:text-[var(--color-accent)] transition-colors"
            aria-label="Twitter"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://bsky.app/profile/michealrs.bsky.social"
            target="_blank"
            rel="noopener noreferrer me"
            className="text-ink-faint hover:text-[var(--color-accent)] transition-colors"
            aria-label="Bluesky"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
            </svg>
          </a>
        </p>
      </div>
      {isDataSourcesOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label={t("footer.dataSourcesTitle")}
              className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface bg-surface-raised shadow-2xl animate-fade-in-up"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-4 border-b border-surface bg-surface-raised/95 backdrop-blur-sm">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{t("footer.dataSourcesTitle")}</h2>
                  <p className="text-sm text-ink-muted">{t("footer.dataSourcesSubtitle")}</p>
                </div>
                <button
                  type="button"
                  ref={closeButtonRef}
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-surface transition-default"
                  aria-label={t("footer.closeDataSources")}
                >
                  <svg
                    className="size-5 text-ink-muted"
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
              <div className="p-4 space-y-2">
                {sourceRows.map((source) => (
                  <div
                    key={source.name}
                    className="rounded-lg border border-surface bg-surface p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink flex items-center gap-2 flex-wrap">
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            {source.name}
                          </a>
                        ) : (
                          <span>{source.name}</span>
                        )}
                        {source.name === resolvedSourceName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-sunken text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                            {t("footer.current")}
                          </span>
                        )}
                      </div>
                      {source.license && (
                        <p className="text-xs text-ink-faint mt-1">
                          {t("footer.license")}: {source.license}
                        </p>
                      )}
                      {source.attribution && (
                        <p className="text-xs text-ink-faint mt-1">
                          {t("footer.attribution")}:{" "}
                          {source.attribution.url ? (
                            <a
                              href={source.attribution.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-accent)] hover:underline"
                            >
                              {source.attribution.text}
                            </a>
                          ) : (
                            source.attribution.text
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </footer>
  );
}
