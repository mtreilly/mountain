import { useMemo } from "react";
import type { Milestone } from "../lib/convergence";
import { calculateMilestones } from "../lib/convergence";
import { convergenceYearFrom, yearsToConverge } from "../lib/convergenceModel";

interface UseConvergenceParams {
  chaserValue: number;
  targetValue: number;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  unit?: string | null;
  baseYear?: number;
}

export function useConvergence({
  chaserValue,
  targetValue,
  chaserGrowthRate,
  targetGrowthRate,
  unit = null,
  baseYear = new Date().getFullYear(),
}: UseConvergenceParams) {
  const shouldRoundProjectionValues = useMemo(() => {
    const normalizedUnit = (unit || "").toLowerCase();
    return (
      normalizedUnit.includes("int$") ||
      normalizedUnit.includes("usd") ||
      normalizedUnit.includes("$") ||
      normalizedUnit.includes("persons") ||
      normalizedUnit.includes("people")
    );
  }, [unit]);

  // `baseYear` here is the resolved projection start (see convergenceModel.projectionStart).
  const yearsToConvergence = useMemo(
    () =>
      yearsToConverge(chaserValue, targetValue, {
        chaserRate: chaserGrowthRate,
        targetRate: targetGrowthRate,
      }),
    [chaserValue, targetValue, chaserGrowthRate, targetGrowthRate],
  );

  const convergenceYear = useMemo(
    () => convergenceYearFrom(baseYear, yearsToConvergence),
    [baseYear, yearsToConvergence],
  );

  const { projection, milestones } = useMemo(() => {
    const normalizeProjectionValue = (value: number) => {
      if (shouldRoundProjectionValues) return Math.round(value);
      return Number(value.toFixed(3));
    };

    const points: Array<{ year: number; chaser: number; target: number }> = [];
    const maxYears = Math.min(
      isFinite(yearsToConvergence) ? Math.ceil(yearsToConvergence) + 20 : 100,
      150,
    );

    for (let i = 0; i <= maxYears; i += 1) {
      const year = baseYear + i;
      const projectedChaser = chaserValue * Math.pow(1 + chaserGrowthRate, i);
      const projectedTarget = targetValue * Math.pow(1 + targetGrowthRate, i);

      points.push({
        year,
        chaser: normalizeProjectionValue(projectedChaser),
        target: normalizeProjectionValue(projectedTarget),
      });

      // Stop if converged
      if (i > 0 && projectedChaser >= projectedTarget) break;
    }

    const milestones: Milestone[] = calculateMilestones(points);

    // Thin out points if too many (keep every Nth point)
    if (points.length > 50) {
      const step = Math.ceil(points.length / 50);
      const keepYears = new Set(milestones.map((m) => m.year));
      return {
        projection: points.filter(
          (p, i) => i % step === 0 || i === points.length - 1 || keepYears.has(p.year),
        ),
        milestones,
      };
    }

    return { projection: points, milestones };
  }, [
    baseYear,
    chaserGrowthRate,
    chaserValue,
    shouldRoundProjectionValues,
    targetGrowthRate,
    targetValue,
    yearsToConvergence,
  ]);

  const gap = targetValue / chaserValue;

  // Net growth advantage
  const netGrowthAdvantage = chaserGrowthRate - targetGrowthRate;

  return {
    yearsToConvergence,
    convergenceYear,
    projection,
    milestones,
    gap,
    netGrowthAdvantage,
  };
}
