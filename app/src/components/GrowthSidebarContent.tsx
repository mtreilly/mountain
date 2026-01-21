import type { ReactNode } from "react";
import { GrowthRateControls } from "./GrowthRateControls";
import { GrowthCalculator } from "./GrowthCalculator";

export function GrowthSidebarContent({
  compact,
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
}: {
  compact?: boolean;
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
}) {
  return (
    <>
      <GrowthRateControls
        chaserRate={chaserGrowthRate}
        targetRate={targetGrowthRate}
        onChaserRateChange={onChaserGrowthRateChange}
        onTargetRateChange={onTargetGrowthRateChange}
        chaserName={chaserName}
        targetName={targetName}
        compact={compact}
      />
      <GrowthCalculator
        chaserName={chaserName}
        targetName={targetName}
        chaserValue={chaserValue}
        targetValue={targetValue}
        chaserGrowthRate={chaserGrowthRate}
        targetGrowthRate={targetGrowthRate}
        years={catchUpYears}
        onYearsChange={onCatchUpYearsChange}
      />
      {contextCards}
    </>
  );
}

