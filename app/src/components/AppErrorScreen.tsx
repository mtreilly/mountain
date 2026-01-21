export function AppErrorScreen({
  title = "Connection Error",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface grain flex items-center justify-center p-4">
      <div className="text-center max-w-sm p-6 card animate-fade-in-up">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-display font-semibold text-ink mb-1">{title}</h2>
        <p className="text-ink-muted text-sm mb-4">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm rounded-lg font-medium hover:bg-[var(--color-accent-light)] transition-default focus-ring"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

