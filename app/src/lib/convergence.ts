/**
 * Calculate years needed for chaser to reach target value at given growth rate.
 * Formula: years = ln(target/chaser) / ln(1 + growth_rate)
 */
export function calculateYearsToConvergence(
  chaserValue: number,
  targetValue: number,
  growthRate: number
): number {
  if (growthRate <= 0) return Infinity;
  if (chaserValue >= targetValue) return 0;

  const ratio = targetValue / chaserValue;
  return Math.log(ratio) / Math.log(1 + growthRate);
}

export function calculateRequiredChaserGrowthRate(params: {
  chaserValue: number;
  targetValue: number;
  targetGrowthRate: number;
  years: number;
}): number | null {
  const { chaserValue, targetValue, targetGrowthRate, years } = params;
  if (!Number.isFinite(chaserValue) || !Number.isFinite(targetValue)) return null;
  if (chaserValue <= 0 || targetValue <= 0) return null;
  if (!Number.isFinite(targetGrowthRate)) return null;
  if (!Number.isFinite(years) || years <= 0) return null;

  const ratio = targetValue / chaserValue;
  const required = Math.pow(ratio, 1 / years) * (1 + targetGrowthRate) - 1;
  return Number.isFinite(required) ? required : null;
}

export type ProjectionPoint = { year: number; chaser: number; target: number };

export interface Milestone {
  percentage: number;
  year: number;
  chaserValue: number;
  targetValue: number;
}

export function calculateMilestones(
  projection: ProjectionPoint[],
  milestonePercentages: number[] = [0.25, 0.5, 0.75]
): Milestone[] {
  if (!projection.length) return [];

  const sorted = [...projection].sort((a, b) => a.year - b.year);
  const remaining = new Set(milestonePercentages);
  const milestones: Milestone[] = [];

  for (const point of sorted) {
    if (remaining.size === 0) break;
    if (!Number.isFinite(point.target) || point.target <= 0) continue;
    if (!Number.isFinite(point.chaser) || point.chaser < 0) continue;
    const ratio = point.chaser / point.target;
    for (const p of [...remaining]) {
      if (ratio >= p) {
        milestones.push({
          percentage: p,
          year: point.year,
          chaserValue: point.chaser,
          targetValue: point.target,
        });
        remaining.delete(p);
      }
    }
  }

  return milestones.sort((a, b) => a.percentage - b.percentage);
}

/**
 * Generate projection data points
 */
export function generateProjection(
  chaserValue: number,
  targetValue: number,
  growthRate: number,
  startYear: number,
  maxYears: number = 150
): Array<{ year: number; chaser: number; target: number }> {
  const projection: Array<{ year: number; chaser: number; target: number }> = [];

  for (let i = 0; i <= maxYears; i++) {
    const year = startYear + i;
    const projectedChaser = chaserValue * Math.pow(1 + growthRate, i);

    projection.push({
      year,
      chaser: Math.round(projectedChaser),
      target: Math.round(targetValue),
    });

    if (projectedChaser >= targetValue) break;
  }

  return projection;
}

/**
 * Format large numbers with appropriate suffix (K, M, B)
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format percentage for display
 */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format years for display
 */
export function formatYears(years: number): string {
  if (!isFinite(years)) return "Never";
  if (years < 1) return "< 1 year";
  if (years === 1) return "1 year";
  return `${Math.round(years)} years`;
}

export function formatMetricValue(
  value: number,
  unit?: string | null,
  options?: { includeUnit?: boolean }
): string {
  if (!isFinite(value)) return "—";

  const includeUnit = options?.includeUnit ?? false;
  const normalizedUnit = (unit || "").toLowerCase();

  if (normalizedUnit.includes("percent")) return `${value.toFixed(1)}%`;
  if (normalizedUnit.includes("index")) return value.toFixed(3).replace(/\.?0+$/, "");
  if (normalizedUnit.includes("int$") || normalizedUnit.includes("usd") || normalizedUnit.includes("$")) {
    return `$${formatNumber(value)}`;
  }
  if (normalizedUnit.includes("persons") || normalizedUnit.includes("people")) return formatNumber(value);
  if (normalizedUnit.includes("years")) return value.toFixed(1).replace(/\.0$/, "");

  const base = formatNumber(value);
  if (includeUnit && unit) return `${base} ${unit}`;
  return base;
}
