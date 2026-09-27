import type { CSSProperties } from "react";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  size?: "sm" | "md";
  className?: string;
}

// Equal-width segments let one indicator slide between them with a single transform.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className = "",
}: SegmentedControlProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      className={`segmented ${className}`}
      style={{ "--segments": options.length, "--index": index } as CSSProperties}
    >
      <span className="segmented-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={[
            "segmented-item focus-ring",
            size === "md" ? "px-3 py-1.5" : "px-2.5 py-1",
            option.value === value ? "text-ink" : "text-ink-muted hover:text-ink",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
