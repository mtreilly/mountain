import type { ReactNode } from "react";
import { GrowthCalculator } from "./GrowthCalculator";
import { GrowthSpeedCard } from "./GrowthSpeedCard";

export function GrowthSidebarContent({
  chaserName,
  targetName,
  chaserValue,
  targetValue,
  chaserGrowthRate,
  targetGrowthRate,
  onChaserGrowthRateChange,
  onTargetGrowthRateChange,
  catchUpYears,
  onCatchUpYearsChange,
  contextCards,
  footer,
}: {
  chaserName: string;
  targetName: string;
  chaserValue: number;
  targetValue: number;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  onChaserGrowthRateChange: (rate: number) => void;
  onTargetGrowthRateChange: (rate: number) => void;
  catchUpYears: number;
  onCatchUpYearsChange: (years: number) => void;
  contextCards?: ReactNode;
  footer?: ReactNode;
}) {
  // Each child is its own step so the stagger reads top to bottom: speed → deadline → more.
  const steps = [
    <GrowthSpeedCard
      key="speed"
      chaserName={chaserName}
      targetName={targetName}
      chaserRate={chaserGrowthRate}
      targetRate={targetGrowthRate}
      chaserAhead={chaserValue >= targetValue}
      onChaserRateChange={onChaserGrowthRateChange}
      onTargetRateChange={onTargetGrowthRateChange}
    />,
    <GrowthCalculator
      key="deadline"
      chaserName={chaserName}
      chaserValue={chaserValue}
      targetValue={targetValue}
      chaserGrowthRate={chaserGrowthRate}
      targetGrowthRate={targetGrowthRate}
      years={catchUpYears}
      onYearsChange={onCatchUpYearsChange}
    />,
    footer ? <div key="footer">{footer}</div> : null,
    contextCards ? <div key="context">{contextCards}</div> : null,
  ].filter(Boolean);

  return <div className="stagger-children space-y-3">{steps}</div>;
}
