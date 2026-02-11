import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConvergence } from "./useConvergence";

describe("useConvergence", () => {
  it("computes finite convergence for valid growth differential", () => {
    const { result } = renderHook(() =>
      useConvergence({
        chaserValue: 100,
        targetValue: 200,
        chaserGrowthRate: 0.1,
        targetGrowthRate: 0,
        baseYear: 2023,
        unit: "usd",
      }),
    );

    expect(result.current.yearsToConvergence).toBeCloseTo(7.2725, 3);
    expect(result.current.convergenceYear).toBe(2030);
    expect(result.current.netGrowthAdvantage).toBeCloseTo(0.1, 6);
    expect(result.current.projection.length).toBeGreaterThan(1);
    expect(result.current.projection[0]).toEqual({ year: 2023, chaser: 100, target: 200 });

    const last = result.current.projection[result.current.projection.length - 1];
    expect(last.chaser).toBeGreaterThanOrEqual(last.target);
  });

  it("returns immediate convergence when chaser is already ahead", () => {
    const { result } = renderHook(() =>
      useConvergence({
        chaserValue: 220,
        targetValue: 200,
        chaserGrowthRate: 0.03,
        targetGrowthRate: 0.01,
        baseYear: 2023,
      }),
    );

    expect(result.current.yearsToConvergence).toBe(0);
    expect(result.current.convergenceYear).toBe(2023);
    expect(result.current.projection[0].year).toBe(2023);
  });

  it("returns never-converges when chaser growth is not higher", () => {
    const { result } = renderHook(() =>
      useConvergence({
        chaserValue: 100,
        targetValue: 200,
        chaserGrowthRate: 0.02,
        targetGrowthRate: 0.03,
        baseYear: 2023,
      }),
    );

    expect(result.current.yearsToConvergence).toBe(Infinity);
    expect(result.current.convergenceYear).toBeNull();
    expect(result.current.projection.length).toBeGreaterThan(10);
  });
});
