import { useMemo } from "react";
import { formatMetricValue } from "../lib/convergence";

const CHART = {
  width: 600,
  height: 300,
  padding: { top: 20, right: 60, bottom: 40, left: 70 },
} as const;

interface ConvergenceChartProps {
  projection: Array<{ year: number; chaser: number; target: number }>;
  chaserName: string;
  targetName: string;
  convergenceYear: number | null;
  unit?: string | null;
}

export function ConvergenceChart({
  projection,
  chaserName,
  targetName,
  convergenceYear,
  unit,
}: ConvergenceChartProps) {
  const { width, height, padding } = CHART;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const scales = useMemo(() => {
    const years = projection.map((d) => d.year);
    const values = projection.flatMap((d) => [d.chaser, d.target]);

    const xMin = Math.min(...years);
    const xMax = Math.max(...years);
    const yMax = Math.max(...values) * 1.1;

    return {
      x: (year: number) =>
        padding.left + ((year - xMin) / (xMax - xMin)) * chartWidth,
      y: (value: number) =>
        padding.top + chartHeight - (value / yMax) * chartHeight,
      xMin,
      xMax,
      yMax,
    };
  }, [chartHeight, chartWidth, padding.left, padding.top, projection]);

  const chaserPath = useMemo(() => {
    return projection
      .map((d, i) => `${i === 0 ? "M" : "L"} ${scales.x(d.year)} ${scales.y(d.chaser)}`)
      .join(" ");
  }, [projection, scales]);

  const targetPath = useMemo(() => {
    return projection
      .map((d, i) => `${i === 0 ? "M" : "L"} ${scales.x(d.year)} ${scales.y(d.target)}`)
      .join(" ");
  }, [projection, scales]);

  // Generate y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = scales.yMax / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(Math.round(step * i));
    }
    return ticks;
  }, [scales.yMax]);

  // Generate x-axis ticks
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = scales.xMax - scales.xMin;
    const step = Math.ceil(range / 6 / 10) * 10; // Round to nearest 10
    for (let year = scales.xMin; year <= scales.xMax; year += step) {
      ticks.push(year);
    }
    return ticks;
  }, [scales]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl">
      {/* Grid lines */}
      <g className="text-gray-200 dark:text-zinc-800">
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={padding.left}
            y1={scales.y(tick)}
            x2={width - padding.right}
            y2={scales.y(tick)}
            stroke="currentColor"
            strokeDasharray="4,4"
          />
        ))}
      </g>

      {/* Convergence year marker */}
      {convergenceYear && convergenceYear <= scales.xMax && (
        <g>
          <line
            x1={scales.x(convergenceYear)}
            y1={padding.top}
            x2={scales.x(convergenceYear)}
            y2={height - padding.bottom}
            stroke="#a855f7"
            strokeDasharray="6,3"
            strokeWidth={2}
          />
          <text
            x={scales.x(convergenceYear)}
            y={padding.top - 5}
            textAnchor="middle"
            className="fill-purple-600 dark:fill-purple-400 text-xs font-medium"
          >
            {convergenceYear}
          </text>
        </g>
      )}

      {/* Target line */}
      <path
        d={targetPath}
        fill="none"
        stroke="#22c55e"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Chaser line */}
      <path
        d={chaserPath}
        fill="none"
        stroke="#ef4444"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Y-axis labels */}
      <g className="text-gray-600 dark:text-zinc-400 text-xs">
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={padding.left - 10}
            y={scales.y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fill="currentColor"
          >
            {formatMetricValue(tick, unit)}
          </text>
        ))}
      </g>

      {/* X-axis labels */}
      <g className="text-gray-600 dark:text-zinc-400 text-xs">
        {xTicks.map((year) => (
          <text
            key={year}
            x={scales.x(year)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fill="currentColor"
          >
            {year}
          </text>
        ))}
      </g>

      {/* Legend */}
      <g transform={`translate(${width - padding.right + 10}, ${padding.top + 20})`}>
        <circle cx={0} cy={0} r={5} fill="#ef4444" />
        <text x={10} y={4} className="text-xs fill-gray-700 dark:fill-zinc-200">
          {chaserName}
        </text>
        <circle cx={0} cy={20} r={5} fill="#22c55e" />
        <text x={10} y={24} className="text-xs fill-gray-700 dark:fill-zinc-200">
          {targetName}
        </text>
      </g>
    </svg>
  );
}
