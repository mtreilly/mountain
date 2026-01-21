export function DataStates({
  loading,
  error,
  metricName,
  showMissingData,
}: {
  loading: boolean;
  error: string | null;
  metricName: string;
  showMissingData: boolean;
}) {
  return (
    <>
      {loading && (
        <div className="text-center py-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised border border-surface text-sm">
            <div className="w-3 h-3 rounded-full border-2 border-t-[var(--color-accent)] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <span className="text-ink-muted">Loading...</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="card p-3 animate-fade-in-up">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-ink-muted">Could not load {metricName}</span>
          </div>
        </div>
      )}

      {showMissingData && !loading && !error && (
        <div className="card p-3 animate-fade-in-up">
          <p className="text-ink-muted text-sm">
            No data for <span className="font-medium text-ink">{metricName}</span>.
          </p>
        </div>
      )}
    </>
  );
}

