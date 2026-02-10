import type { ReactNode } from "react";
import { GrowthCalculator } from "./GrowthCalculator";
import { GrowthRateControls } from "./GrowthRateControls";

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
  showControls = true,
  showCalculator = true,
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
  showControls?: boolean;
  showCalculator?: boolean;
}) {
  return (
    <>
      {showControls && (
        <GrowthRateControls
          chaserRate={chaserGrowthRate}
          targetRate={targetGrowthRate}
          onChaserRateChange={onChaserGrowthRateChange}
          onTargetRateChange={onTargetGrowthRateChange}
          chaserName={chaserName}
          targetName={targetName}
          compact={compact}
        />
      )}
      {showCalculator && (
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
      )}
      {contextCards}
    </>
  );
}
