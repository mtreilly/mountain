import type { ImplicationCardType } from "../../lib/shareState";

interface ImplicationsTabsProps {
  activeCard: ImplicationCardType;
  onCardChange: (card: ImplicationCardType) => void;
}

const TABS: Array<{ id: ImplicationCardType; label: string }> = [
  { id: "gdp", label: "GDP Totals" },
  { id: "elec-demand", label: "Electricity Demand" },
  { id: "elec-mix", label: "Electricity Mix" },
  { id: "elec-assumptions", label: "Electricity Assumptions" },
  { id: "urban", label: "Urbanization" },
  { id: "co2", label: "CO₂ Emissions" },
];

export function ImplicationsTabs({ activeCard, onCardChange }: ImplicationsTabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = currentIndex > 0 ? currentIndex - 1 : TABS.length - 1;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = currentIndex < TABS.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      onCardChange(TABS[nextIndex].id);
    }
  };

  return (
    <div className="border-b border-surface">
      <nav
        className="flex overflow-x-auto scrollbar-thin"
        role="tablist"
        aria-label="Implications cards"
      >
        {TABS.map((tab, index) => {
          const isActive = activeCard === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onCardChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-default focus-ring",
                "border-b-2 -mb-px",
                isActive
                  ? "border-[var(--color-accent)] text-ink"
                  : "border-transparent text-ink-muted hover:text-ink hover:border-surface-raised",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
