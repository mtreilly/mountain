import type { RefObject } from "react";
import { useCallback, useMemo, useState } from "react";
import { formatMetricValue, type Milestone } from "../lib/convergence";
import { CHART_GEOMETRY, ConvergenceChart } from "./ConvergenceChart";
import { useResizeObserver } from "../hooks/useResizeObserver";

const GEOMETRY = CHART_GEOMETRY;

export function ConvergenceChartInteractive({
  svgRef,
  projection,
  chaserName,
  targetName,
  convergenceYear,
  milestones,
  unit,
  theme,
  chaserHasNote,
  targetHasNote,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  projection: Array<{ year: number; chaser: number; target: number }>;
  chaserName: string;
  targetName: string;
  convergenceYear: number | null;
  milestones?: Milestone[];
  unit?: string | null;
  theme?: "light" | "dark";
  chaserHasNote?: boolean;
  targetHasNote?: boolean;
}) {
  const { ref: containerRef, width: containerWidth } = useResizeObserver<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { xMin, xMax, yMax } = useMemo(() => {
    const years = projection.map((d) => d.year);
    const values = projection.flatMap((d) => [d.chaser, d.target]);
    return {
      xMin: Math.min(...years),
      xMax: Math.max(...years),
      yMax: Math.max(...values) * 1.1,
    };
  }, [projection]);

  const chartWidth = GEOMETRY.width - GEOMETRY.padding.left - GEOMETRY.padding.right;
  const chartHeight = GEOMETRY.height - GEOMETRY.padding.top - GEOMETRY.padding.bottom;
  const xRange = Math.max(1, xMax - xMin);

  const getNearestIndexFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const x = local.x;
      const y = local.y;

      if (
        x < GEOMETRY.padding.left ||
        x > GEOMETRY.width - GEOMETRY.padding.right ||
        y < GEOMETRY.padding.top ||
        y > GEOMETRY.height - GEOMETRY.padding.bottom
      ) {
        return null;
      }

      const t = (x - GEOMETRY.padding.left) / chartWidth;
      const approxYear = xMin + clamp01(t) * xRange;

      let bestIndex = 0;
      let bestDist = Infinity;
      for (let i = 0; i < projection.length; i++) {
        const d = Math.abs(projection[i].year - approxYear);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      return bestIndex;
    },
    [chartWidth, projection, svgRef, xMin, xRange]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const next = getNearestIndexFromClientPoint(e.clientX, e.clientY);
      if (next == null) {
        setActiveIndex((current) => (current == null ? current : null));
        return;
      }
      setActiveIndex(next);
    },
    [getNearestIndexFromClientPoint]
  );

  const onPointerLeave = useCallback(() => setActiveIndex(null), []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (projection.length === 0) return;
      if (e.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();

      setActiveIndex((idx) => {
        const current = idx ?? 0;
        const next =
          e.key === "ArrowRight"
            ? Math.min(current + 1, projection.length - 1)
            : Math.max(current - 1, 0);
        return next;
      });
    },
    [projection.length]
  );

  const active = activeIndex == null ? null : projection[activeIndex];
  const activeX =
    active == null
      ? null
      : GEOMETRY.padding.left + ((active.year - xMin) / xRange) * chartWidth;
  const activeYChaser =
    active == null
      ? null
      : GEOMETRY.padding.top + chartHeight - (active.chaser / yMax) * chartHeight;
  const activeYTarget =
    active == null
      ? null
      : GEOMETRY.padding.top + chartHeight - (active.target / yMax) * chartHeight;

  const tooltip = useMemo(() => {
    if (!active || activeX == null || activeYChaser == null || activeYTarget == null) return null;

    const leftPct = clampPct((activeX / GEOMETRY.width) * 100, 6, 94);
    const topPct = clampPct((Math.min(activeYChaser, activeYTarget) / GEOMETRY.height) * 100, 10, 92);

    return {
      leftPct,
      topPct,
      year: active.year,
      chaser: active.chaser,
      target: active.target,
    };
  }, [active, activeX, activeYChaser, activeYTarget]);

  const markerPalette =
    theme === "dark"
      ? { ink: "#f5f3ef", surface: "#1a1918", border: "#2a2826", faint: "#a8a49c" }
      : { ink: "#1a1815", surface: "#fffffe", border: "#e5e0d8", faint: "#5c574f" };

  return (
    <div ref={containerRef} className="relative w-full">
      <ConvergenceChart
        ref={svgRef}
        projection={projection}
        chaserName={chaserName}
        targetName={targetName}
        convergenceYear={convergenceYear}
        milestones={milestones}
        unit={unit}
        theme={theme}
        pixelWidth={containerWidth}
        title={`${chaserName} vs ${targetName}`}
        description={`Projected values from ${xMin} onward. Use arrow keys to inspect values by year.`}
        chaserHasNote={chaserHasNote}
        targetHasNote={targetHasNote}
        svgProps={{
          tabIndex: 0,
          onPointerMove,
          onPointerLeave,
          onKeyDown,
          className:
            "w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-md",
        }}
      />

      {active && activeX != null && activeYChaser != null && activeYTarget != null && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${GEOMETRY.width} ${GEOMETRY.height}`}
        >
          <line
            x1={activeX}
            x2={activeX}
            y1={GEOMETRY.padding.top}
            y2={GEOMETRY.height - GEOMETRY.padding.bottom}
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="5,4"
            opacity={0.85}
          />
          <circle cx={activeX} cy={activeYChaser} r={4.5} fill="#ea580c" />
          <circle cx={activeX} cy={activeYTarget} r={4.5} fill="#059669" />
        </svg>
      )}

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${tooltip.leftPct}%`,
            top: `${tooltip.topPct}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div
            className="rounded-lg shadow-xl border px-3 py-2"
            style={{ background: markerPalette.surface, borderColor: markerPalette.border }}
          >
            <div className="text-xs font-semibold" style={{ color: markerPalette.ink }}>
              {tooltip.year}
            </div>
            <div className="mt-1 space-y-0.5 text-[11px]" style={{ color: markerPalette.faint }}>
              <div>
                <span className="font-medium" style={{ color: "#ea580c" }}>
                  {chaserName}{chaserHasNote && <span style={{ fontSize: 9 }}>†</span>}:
                </span>{" "}
                {formatMetricValue(tooltip.chaser, unit)}
              </div>
              <div>
                <span className="font-medium" style={{ color: "#059669" }}>
                  {targetName}{targetHasNote && <span style={{ fontSize: 9 }}>†</span>}:
                </span>{" "}
                {formatMetricValue(tooltip.target, unit)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function clampPct(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
