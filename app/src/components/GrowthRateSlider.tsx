import { formatPercent } from "../lib/convergence";

interface GrowthRateSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  presets?: Array<{ label: string; value: number }>;
}

const DEFAULT_PRESETS = [
  { label: "Pessimistic", value: 0.01 },
  { label: "Historical avg", value: 0.025 },
  { label: "Moderate", value: 0.04 },
  { label: "China-like", value: 0.07 },
  { label: "Optimistic", value: 0.1 },
];

export function GrowthRateSlider({
  value,
  onChange,
  min = 0.001,
  max = 0.15,
  presets = DEFAULT_PRESETS,
}: GrowthRateSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Annual growth rate
        </label>
        <span className="text-lg font-bold text-primary">
          {formatPercent(value)}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={0.001}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
      />

      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatPercent(min)}</span>
        <span>{formatPercent(max)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.value)}
            className={`
              px-3 py-1 text-xs rounded-full transition-colors
              ${
                Math.abs(value - preset.value) < 0.001
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            `}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
