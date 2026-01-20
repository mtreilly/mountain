import type { SVGProps } from "react";
import { forwardRef, useMemo } from "react";
import { formatMetricValue } from "../lib/convergence";

export const CHART_GEOMETRY = {
  width: 600,
  height: 300,
  padding: { top: 24, right: 80, bottom: 44, left: 70 },
} as const;

interface ConvergenceChartProps {
  projection: Array<{ year: number; chaser: number; target: number }>;
  chaserName: string;
  targetName: string;
  convergenceYear: number | null;
  unit?: string | null;
  theme?: "light" | "dark";
  pixelWidth?: number;
  title?: string;
  description?: string;
  svgProps?: SVGProps<SVGSVGElement>;
  chaserHasNote?: boolean;
  targetHasNote?: boolean;
}

export const ConvergenceChart = forwardRef<SVGSVGElement | null, ConvergenceChartProps>(
  function ConvergenceChart(
    {
      projection,
      chaserName,
      targetName,
      convergenceYear,
      unit,
      theme = "light",
      pixelWidth,
      title,
      description,
      svgProps,
      chaserHasNote,
      targetHasNote,
    }: ConvergenceChartProps,
    ref
  ) {
  const palette =
    theme === "dark"
      ? {
          surfaceSunken: "#0a0908",
          surfaceRaised: "#1a1918",
          ink: "#f5f3ef",
          inkMuted: "#a8a49c",
          inkFaint: "#6b675f",
          grid: "#2a2826",
          chaser: "#ea580c",
          target: "#059669",
          convergence: "#8b5cf6",
        }
      : {
          surfaceSunken: "#f3f0eb",
          surfaceRaised: "#fffffe",
          ink: "#1a1815",
          inkMuted: "#5c574f",
          inkFaint: "#8a847a",
          grid: "#e5e0d8",
          chaser: "#ea580c",
          target: "#059669",
          convergence: "#8b5cf6",
        };

  const fontFamily =
    "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const { width, height, padding } = CHART_GEOMETRY;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const scales = useMemo(() => {
    const years = projection.map((d) => d.year);
    const values = projection.flatMap((d) => [d.chaser, d.target]);

    const xMin = Math.min(...years);
    const xMax = Math.max(...years);
    const xRange = Math.max(1, xMax - xMin);
    const yMax = Math.max(...values) * 1.1;

    return {
      x: (year: number) =>
        padding.left + ((year - xMin) / xRange) * chartWidth,
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

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const segments = (pixelWidth ?? width) < 420 ? 4 : 5;
    const step = scales.yMax / segments;
    for (let i = 0; i <= segments; i++) {
      ticks.push(Math.round(step * i));
    }
    return ticks;
  }, [pixelWidth, scales.yMax, width]);

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = scales.xMax - scales.xMin;
    const targetTicks = (pixelWidth ?? width) < 420 ? 4 : 6;
    const rough = range / Math.max(1, targetTicks);
    const step = Math.max(1, Math.ceil(rough / 5) * 5);
    for (let year = scales.xMin; year <= scales.xMax; year += step) {
      ticks.push(year);
    }
    return ticks;
  }, [pixelWidth, scales, width]);

  const mergedClassName = ["w-full", svgProps?.className].filter(Boolean).join(" ");
  const mergedStyle = { ...(svgProps?.style || {}) };
  const ariaLabel =
    svgProps?.["aria-label"] ??
    `${chaserName} vs ${targetName} projection${unit ? ` (${unit})` : ""}`;

  return (
    <svg
      {...svgProps}
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      className={mergedClassName}
      style={mergedStyle}
      role={svgProps?.role ?? "img"}
      aria-label={ariaLabel}
    >
      {title && <title>{title}</title>}
      {description && <desc>{description}</desc>}

      {/* Subtle gradient background */}
      <defs>
        <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.surfaceSunken} stopOpacity="0.55" />
          <stop offset="100%" stopColor={palette.surfaceSunken} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x={padding.left}
        y={padding.top}
        width={chartWidth}
        height={chartHeight}
        fill="url(#chartBg)"
        rx="4"
      />

      {/* Grid lines */}
      <g>
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={padding.left}
            y1={scales.y(tick)}
            x2={width - padding.right}
            y2={scales.y(tick)}
            stroke={palette.grid}
            strokeDasharray="3,3"
            strokeOpacity="0.7"
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
            stroke={palette.convergence}
            strokeDasharray="6,4"
            strokeWidth={2}
            opacity="0.8"
          />
          <rect
            x={scales.x(convergenceYear) - 24}
            y={padding.top - 20}
            width={48}
            height={18}
            fill={palette.convergence}
            rx="4"
          />
          <text
            x={scales.x(convergenceYear)}
            y={padding.top - 8}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={11}
            fontWeight={600}
            fontFamily={fontFamily}
          >
            {convergenceYear}
          </text>
        </g>
      )}

      {/* Target line */}
      <path
        d={targetPath}
        fill="none"
        stroke={palette.target}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="7,5"
      />

      {/* Chaser line */}
      <path
        d={chaserPath}
        fill="none"
        stroke={palette.chaser}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End point dots */}
      {projection.length > 0 && (
        <>
          <circle
            cx={scales.x(projection[projection.length - 1].year)}
            cy={scales.y(projection[projection.length - 1].chaser)}
            r={5}
            fill={palette.chaser}
          />
          <circle
            cx={scales.x(projection[projection.length - 1].year)}
            cy={scales.y(projection[projection.length - 1].target)}
            r={5}
            fill={palette.target}
          />
        </>
      )}

      {/* Y-axis labels */}
      <g fontSize={11} fontFamily={fontFamily}>
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={padding.left - 12}
            y={scales.y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fill={palette.inkFaint}
          >
            {formatMetricValue(tick, unit)}
          </text>
        ))}
      </g>

      {/* X-axis labels */}
      <g fontSize={11} fontFamily={fontFamily}>
        {xTicks.map((year) => (
          <text
            key={year}
            x={scales.x(year)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fill={palette.inkFaint}
          >
            {year}
          </text>
        ))}
      </g>

      {/* Legend */}
      <g transform={`translate(${width - padding.right + 14}, ${padding.top + 10})`}>
        <g>
          <rect
            x={-4}
            y={-8}
            width={70}
            height={52}
            rx={6}
            fill={palette.surfaceRaised}
            fillOpacity="0.92"
          />
          <circle cx={6} cy={6} r={5} fill={palette.chaser} />
          <text
            x={18}
            y={10}
            fontSize={11}
            fontWeight={500}
            fill={palette.inkMuted}
            fontFamily={fontFamily}
          >
            {chaserName.length > 7 ? chaserName.slice(0, 7) + "…" : chaserName}
            {chaserHasNote && (
              <tspan fill={palette.inkFaint} fontSize={9}>†</tspan>
            )}
          </text>
          <circle cx={6} cy={30} r={5} fill={palette.target} />
          <text
            x={18}
            y={34}
            fontSize={11}
            fontWeight={500}
            fill={palette.inkMuted}
            fontFamily={fontFamily}
          >
            {targetName.length > 7 ? targetName.slice(0, 7) + "…" : targetName}
            {targetHasNote && (
              <tspan fill={palette.inkFaint} fontSize={9}>†</tspan>
            )}
          </text>
        </g>
      </g>
    </svg>
  );
  }
);
