import { useState, useMemo } from "react";

interface UseConvergenceParams {
  chaserValue: number;
  targetValue: number;
  initialChaserGrowthRate?: number;
  initialTargetGrowthRate?: number;
  baseYear?: number;
}

export function useConvergence({
  chaserValue,
  targetValue,
  initialChaserGrowthRate = 0.03,
  initialTargetGrowthRate = 0.01,
  baseYear = new Date().getFullYear(),
}: UseConvergenceParams) {
  const [chaserGrowthRate, setChaserGrowthRate] = useState(initialChaserGrowthRate);
  const [targetGrowthRate, setTargetGrowthRate] = useState(initialTargetGrowthRate);

  // Calculate years to convergence with both growth rates
  // Formula: chaserValue * (1 + chaserRate)^n = targetValue * (1 + targetRate)^n
  // Solving: n = ln(targetValue/chaserValue) / ln((1+chaserRate)/(1+targetRate))
  const yearsToConvergence = useMemo(() => {
    if (chaserGrowthRate <= targetGrowthRate) return Infinity; // Will never catch up
    if (chaserValue >= targetValue) return 0;

    const ratio = targetValue / chaserValue;
    const growthRatio = (1 + chaserGrowthRate) / (1 + targetGrowthRate);

    if (growthRatio <= 1) return Infinity;

    return Math.log(ratio) / Math.log(growthRatio);
  }, [chaserValue, targetValue, chaserGrowthRate, targetGrowthRate]);

  const convergenceYear = useMemo(() => {
    if (!isFinite(yearsToConvergence)) return null;
    return Math.round(baseYear + yearsToConvergence);
  }, [baseYear, yearsToConvergence]);

  const projection = useMemo(() => {
    const points: Array<{ year: number; chaser: number; target: number }> = [];
    const maxYears = Math.min(
      isFinite(yearsToConvergence) ? Math.ceil(yearsToConvergence) + 20 : 100,
      150
    );

    for (let i = 0; i <= maxYears; i += 1) {
      const year = baseYear + i;
      const projectedChaser = chaserValue * Math.pow(1 + chaserGrowthRate, i);
      const projectedTarget = targetValue * Math.pow(1 + targetGrowthRate, i);

      points.push({
        year,
        chaser: Math.round(projectedChaser),
        target: Math.round(projectedTarget),
      });

      // Stop if converged
      if (projectedChaser >= projectedTarget) break;
    }

    // Thin out points if too many (keep every Nth point)
    if (points.length > 50) {
      const step = Math.ceil(points.length / 50);
      return points.filter((_, i) => i % step === 0 || i === points.length - 1);
    }

    return points;
  }, [chaserValue, targetValue, chaserGrowthRate, targetGrowthRate, baseYear, yearsToConvergence]);

  const gap = useMemo(() => {
    return targetValue / chaserValue;
  }, [chaserValue, targetValue]);

  // Net growth advantage
  const netGrowthAdvantage = chaserGrowthRate - targetGrowthRate;

  return {
    chaserGrowthRate,
    setChaserGrowthRate,
    targetGrowthRate,
    setTargetGrowthRate,
    yearsToConvergence,
    convergenceYear,
    projection,
    gap,
    netGrowthAdvantage,
  };
}
