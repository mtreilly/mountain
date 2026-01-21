/**
 * Sensitivity analysis for convergence scenarios.
 * Calculates how ±1% changes in growth rates affect convergence timelines.
 */

export interface SensitivityScenario {
  label: string;
  chaserGrowth: number;
  targetGrowth: number;
  yearsToConvergence: number | null;
  convergenceYear: number | null;
}

export interface SensitivityResult {
  baseline: SensitivityScenario;
  optimistic: SensitivityScenario;
  pessimistic: SensitivityScenario;
}

/**
 * Calculate years needed for chaser to reach target value.
 * Formula: years = ln(targetValue/chaserValue) / ln((1 + chaserGrowth) / (1 + targetGrowth))
 */
function calculateYearsToConverge(
  chaserValue: number,
  targetValue: number,
  chaserGrowthRate: number,
  targetGrowthRate: number
): number | null {
  if (chaserValue >= targetValue) return 0;
  if (chaserGrowthRate <= targetGrowthRate) return null; // Never converges

  const ratio = targetValue / chaserValue;
  const growthRatio = (1 + chaserGrowthRate) / (1 + targetGrowthRate);

  if (growthRatio <= 1) return null;

  const years = Math.log(ratio) / Math.log(growthRatio);
  return Number.isFinite(years) && years > 0 ? years : null;
}

/**
 * Calculate sensitivity scenarios for ±delta changes in chaser growth rate.
 */
export function calculateSensitivityScenarios(params: {
  chaserValue: number;
  targetValue: number;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  baseYear: number;
  delta?: number;
}): SensitivityResult {
  const {
    chaserValue,
    targetValue,
    chaserGrowthRate,
    targetGrowthRate,
    baseYear,
    delta = 0.01,
  } = params;

  const baselineYears = calculateYearsToConverge(
    chaserValue,
    targetValue,
    chaserGrowthRate,
    targetGrowthRate
  );

  const optimisticGrowth = chaserGrowthRate + delta;
  const optimisticYears = calculateYearsToConverge(
    chaserValue,
    targetValue,
    optimisticGrowth,
    targetGrowthRate
  );

  const pessimisticGrowth = Math.max(0, chaserGrowthRate - delta);
  const pessimisticYears = calculateYearsToConverge(
    chaserValue,
    targetValue,
    pessimisticGrowth,
    targetGrowthRate
  );

  return {
    baseline: {
      label: "Baseline",
      chaserGrowth: chaserGrowthRate,
      targetGrowth: targetGrowthRate,
      yearsToConvergence: baselineYears,
      convergenceYear: baselineYears != null ? Math.round(baseYear + baselineYears) : null,
    },
    optimistic: {
      label: `+${(delta * 100).toFixed(0)}% growth`,
      chaserGrowth: optimisticGrowth,
      targetGrowth: targetGrowthRate,
      yearsToConvergence: optimisticYears,
      convergenceYear: optimisticYears != null ? Math.round(baseYear + optimisticYears) : null,
    },
    pessimistic: {
      label: `-${(delta * 100).toFixed(0)}% growth`,
      chaserGrowth: pessimisticGrowth,
      targetGrowth: targetGrowthRate,
      yearsToConvergence: pessimisticYears,
      convergenceYear: pessimisticYears != null ? Math.round(baseYear + pessimisticYears) : null,
    },
  };
}

/**
 * Generate projection data points for a sensitivity scenario.
 */
export function generateSensitivityProjection(
  chaserValue: number,
  targetValue: number,
  chaserGrowthRate: number,
  targetGrowthRate: number,
  startYear: number,
  maxYears: number = 150
): Array<{ year: number; chaser: number; target: number }> {
  const projection: Array<{ year: number; chaser: number; target: number }> = [];

  for (let i = 0; i <= maxYears; i++) {
    const year = startYear + i;
    const projectedChaser = chaserValue * Math.pow(1 + chaserGrowthRate, i);
    const projectedTarget = targetValue * Math.pow(1 + targetGrowthRate, i);

    projection.push({
      year,
      chaser: Math.round(projectedChaser),
      target: Math.round(projectedTarget),
    });

    if (projectedChaser >= projectedTarget) break;
  }

  return projection;
}
