export const GROWTH_BENCHMARKS = {
  unprecedented: 0.1, // >10% - very rare (e.g., peaks)
  exceptional: 0.07, // 7–10% - historically exceptional
  strong: 0.05, // 5–7% - strong
  moderate: 0.03, // 3–5% - typical
} as const;

export type GrowthBenchmarkTone = "good" | "ambitious" | "unprecedented";

export function benchmarkGrowthRate(rate: number): {
  label: string;
  tone: GrowthBenchmarkTone;
} {
  if (!Number.isFinite(rate)) return { label: "—", tone: "good" };
  if (rate <= 0) return { label: "No growth required", tone: "good" };
  if (rate > GROWTH_BENCHMARKS.unprecedented) return { label: "Unprecedented", tone: "unprecedented" };
  if (rate >= GROWTH_BENCHMARKS.exceptional) return { label: "Ambitious", tone: "ambitious" };
  if (rate >= GROWTH_BENCHMARKS.strong) return { label: "Strong", tone: "good" };
  if (rate >= GROWTH_BENCHMARKS.moderate) return { label: "Moderate", tone: "good" };
  return { label: "Slow", tone: "good" };
}

