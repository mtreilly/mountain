import { useRef, useCallback, useState, useEffect } from "react";

interface ScrubberProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  className?: string;
}

/**
 * Brett Victor-style draggable number scrubber.
 * Click and drag left/right to adjust value.
 */
export function Scrubber({
  value,
  onChange,
  min,
  max,
  step = 0.001,
  format = (v) => v.toString(),
  className = "",
}: ScrubberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startValue = useRef(value);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startX.current = e.clientX;
      startValue.current = value;
    },
    [value]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = e.clientX - startX.current;
      const range = max - min;
      const sensitivity = e.shiftKey ? 0.1 : 1; // Fine adjustment with Shift

      // Map pixels to value change (200px = full range)
      const valueChange = (delta / 200) * range * sensitivity;
      let newValue = startValue.current + valueChange;

      // Clamp and round to step
      newValue = Math.max(min, Math.min(max, newValue));
      newValue = Math.round(newValue / step) * step;

      onChange(newValue);
    },
    [isDragging, min, max, step, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <span
      ref={ref}
      onMouseDown={handleMouseDown}
      className={`
        cursor-ew-resize select-none
        px-1 py-0.5 rounded
        bg-primary/10 text-primary font-semibold
        hover:bg-primary/20
        ${isDragging ? "bg-primary/30" : ""}
        ${className}
      `}
      title="Drag to adjust • Hold Shift for fine control"
    >
      {format(value)}
    </span>
  );
}
