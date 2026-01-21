export function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-surface grain flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-12 h-12 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-surface-sunken" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[var(--color-accent)] animate-spin" />
        </div>
        <p className="mt-4 text-ink-muted text-sm">Loading...</p>
      </div>
    </div>
  );
}

