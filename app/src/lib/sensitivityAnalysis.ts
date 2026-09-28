/**
 * Sensitivity analysis for convergence scenarios.
 * Calculates how ±1% changes in growth rates affect convergence timelines.
 * `baseYear` must be the resolved projection start (convergenceModel.projectionStart).
 */

import { convergenceYearFrom, yearsToConverge } from "./convergenceModel";

interface SensitivityScenario {
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

/** Years to converge for one scenario, or null when it never converges. */
function scenarioYears(
  chaserValue: number,
  targetValue: number,
  chaserRate: number,
  targetRate: number,
): number | null {
  const years = yearsToConverge(chaserValue, targetValue, { chaserRate, targetRate });
  return Number.isFinite(years) ? years : null;
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

  const baselineYears = scenarioYears(chaserValue, targetValue, chaserGrowthRate, targetGrowthRate);

  const optimisticGrowth = chaserGrowthRate + delta;
  const optimisticYears = scenarioYears(
    chaserValue,
    targetValue,
    optimisticGrowth,
    targetGrowthRate,
  );

  const pessimisticGrowth = Math.max(0, chaserGrowthRate - delta);
  const pessimisticYears = scenarioYears(
    chaserValue,
    targetValue,
    pessimisticGrowth,
    targetGrowthRate,
  );

  return {
    baseline: {
      label: "Baseline",
      chaserGrowth: chaserGrowthRate,
      targetGrowth: targetGrowthRate,
      yearsToConvergence: baselineYears,
      convergenceYear: convergenceYearFrom(baseYear, baselineYears ?? Number.NaN),
    },
    optimistic: {
      label: `+${(delta * 100).toFixed(0)}% growth`,
      chaserGrowth: optimisticGrowth,
      targetGrowth: targetGrowthRate,
      yearsToConvergence: optimisticYears,
      convergenceYear: convergenceYearFrom(baseYear, optimisticYears ?? Number.NaN),
    },
    pessimistic: {
      label: `-${(delta * 100).toFixed(0)}% growth`,
      chaserGrowth: pessimisticGrowth,
      targetGrowth: targetGrowthRate,
      yearsToConvergence: pessimisticYears,
      convergenceYear: convergenceYearFrom(baseYear, pessimisticYears ?? Number.NaN),
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
  maxYears: number = 150,
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
