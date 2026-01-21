export function AppFooter({ countriesCount }: { countriesCount: number }) {
  return (
    <footer className="mt-10 lg:mt-12 pt-6 border-t border-surface text-center">
      <p className="text-xs text-ink-faint">
        Data:{" "}
        <a
          href="https://data.worldbank.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          World Bank
        </a>
        {" · "}
        Inspired by{" "}
        <a
          href="https://oliverwkim.com/The-Mountain-To-Climb/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          Oliver Kim
        </a>
        {" · "}
        {countriesCount} countries
      </p>
    </footer>
  );
}

