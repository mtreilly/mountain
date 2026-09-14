/**
 * Thread Generator - Creates Twitter thread packages with multiple cards.
 */
import JSZip from "jszip";
import { svgStringToPngBlob } from "./chartExport";
import { formatNumber, formatPercent, formatYears } from "./convergence";
import { downloadBlob } from "./download";
import type { ImplicationsSnapshot } from "./implicationsSnapshot";

type ThreadCardType = "main" | "sensitivity" | "historical" | "implications";

export interface ThreadCard {
  type: ThreadCardType;
  svgString: string;
  caption: string;
  index: number;
}

export interface ThreadPackage {
  cards: ThreadCard[];
  theme: "light" | "dark";
  chaserCode: string;
  targetCode: string;
  implicationsSnapshot?: ImplicationsSnapshot | null;
}

export interface HistoricalData {
  chaserStart: { year: number; value: number } | null;
  chaserCurrent: { year: number; value: number } | null;
  targetStart: { year: number; value: number } | null;
  targetCurrent: { year: number; value: number } | null;
}

interface CaptionContext {
  chaserName: string;
  targetName: string;
  yearsToConvergence: number | null;
  convergenceYear: number | null;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  optimisticYears: number | null;
  pessimisticYears: number | null;
  historicalData: HistoricalData | null;
  implicationsData: ImplicationsSnapshot | null;
  appUrl: string;
}

const CARD_DIMENSIONS = { width: 1200, height: 675 };

/**
 * Generate caption for the main convergence chart (Card 1).
 */
function generateMainCaption(ctx: CaptionContext): string {
  const { chaserName, targetName, yearsToConvergence, chaserGrowthRate, targetGrowthRate } = ctx;

  if (yearsToConvergence === 0) {
    return `1/4 ${chaserName} is already ahead of ${targetName}.\n\nAt ${formatPercent(chaserGrowthRate)}/yr vs ${formatPercent(targetGrowthRate)}/yr, the lead compounds over time.\n\n#economics #convergence`;
  }

  if (
    yearsToConvergence == null ||
    !Number.isFinite(yearsToConvergence) ||
    yearsToConvergence < 0
  ) {
    return `1/4 ${chaserName} won't catch ${targetName} at current rates.\n\nAt ${formatPercent(chaserGrowthRate)}/yr vs ${formatPercent(targetGrowthRate)}/yr, the gap keeps growing.\n\n#economics #convergence`;
  }

  return `1/4 ${chaserName} catches ${targetName} in ${formatYears(yearsToConvergence)}\n\nAt ${formatPercent(chaserGrowthRate)}/yr vs ${formatPercent(targetGrowthRate)}/yr, the math adds up.\n\n#economics #convergence`;
}

/**
 * Generate caption for the sensitivity analysis card (Card 2).
 */
function generateSensitivityCaption(ctx: CaptionContext): string {
  const { optimisticYears, yearsToConvergence, pessimisticYears } = ctx;

  const formatScenario = (years: number | null) => {
    if (years === 0) return "Already ahead";
    if (years == null || !Number.isFinite(years) || years < 0) return "Never";
    return `${Math.round(years)} years`;
  };

  return `2/4 What if growth changes by ±1%?\n\n• Optimistic: ${formatScenario(optimisticYears)}\n• Baseline: ${formatScenario(yearsToConvergence)}\n• Pessimistic: ${formatScenario(pessimisticYears)}\n\nSmall differences compound dramatically.`;
}

/**
 * Generate caption for the historical context card (Card 3).
 */
function generateHistoricalCaption(ctx: CaptionContext): string {
  const { chaserName, targetName, historicalData } = ctx;

  if (!historicalData) {
    return `3/4 Where they started:\n\n${chaserName} and ${targetName} have had very different growth trajectories.`;
  }

  const { chaserStart, chaserCurrent, targetStart, targetCurrent } = historicalData;

  const chaserMult =
    chaserStart && chaserCurrent && chaserStart.value > 0
      ? (chaserCurrent.value / chaserStart.value).toFixed(1)
      : "—";
  const targetMult =
    targetStart && targetCurrent && targetStart.value > 0
      ? (targetCurrent.value / targetStart.value).toFixed(1)
      : "—";

  const chaserLine =
    chaserStart && chaserCurrent
      ? `${chaserName}: $${formatNumber(chaserStart.value)} → $${formatNumber(chaserCurrent.value)} (${chaserMult}×)`
      : `${chaserName}: data unavailable`;

  const targetLine =
    targetStart && targetCurrent
      ? `${targetName}: $${formatNumber(targetStart.value)} → $${formatNumber(targetCurrent.value)} (${targetMult}×)`
      : `${targetName}: data unavailable`;

  return `3/4 Where they started:\n\n${chaserLine}\n${targetLine}`;
}

/**
 * Generate caption for the implications summary card (Card 4).
 */
function generateImplicationsCaption(ctx: CaptionContext): string {
  const { chaserName, implicationsData, appUrl } = ctx;

  if (!implicationsData) {
    return `4/4 Electricity implications are unavailable for ${chaserName}.\n\nExplore the scenario yourself:\n${appUrl}`;
  }

  const electricity = implicationsData.electricity;
  const currentDemand = electricity.endUseDemandCurrentTWh;
  const futureDemand = electricity.endUseDemandFutureTWh;
  const buildout = electricity.newDomesticGenerationTWh;
  const nuclear = electricity.annualEnergyEquivalents?.nuclear;
  const generationYear = electricity.domesticGenerationObservedCurrentTWh?.year;
  const controls = implicationsData.assumptions;
  const scenarioLines = [
    currentDemand && futureDemand
      ? `⚡ End-use demand: ${Math.round(currentDemand.value)} → ${Math.round(futureDemand.value)} TWh/year`
      : null,
    buildout
      ? `🏗 New domestic generation: ${Math.round(buildout.value)} TWh/year${generationYear ? ` above ${generationYear} output` : ""}`
      : null,
    nuclear
      ? `≈ Annual output of ${nuclear.referenceUnits.toFixed(1)} ${nuclear.referenceUnitLabel}s at ${(nuclear.capacityFactor * 100).toFixed(0)}% capacity factor`
      : null,
  ].filter((line): line is string => line != null);

  const assumptions = `Assumptions: UN ${controls.populationVariant} population, ${controls.assumptions.gridLossPct}% grid losses, ${controls.assumptions.netImportsPct}% net imports, ${controls.template}-like development path.`;
  return `4/4 An illustrative ${implicationsData.horizon.years}-year electricity scenario for ${chaserName}:\n\n${scenarioLines.join("\n")}\n\n${assumptions} Scenario, not forecast.\n\n${appUrl}`;
}

/**
 * Generate all captions for a thread.
 */
export function generateCaptions(ctx: CaptionContext): string[] {
  return [
    generateMainCaption(ctx),
    generateSensitivityCaption(ctx),
    generateHistoricalCaption(ctx),
    generateImplicationsCaption(ctx),
  ];
}

/**
 * Generate formatted captions.txt content.
 */
function generateCaptionsFile(cards: ThreadCard[]): string {
  const lines = ["=== TWITTER THREAD ===", ""];

  for (const card of cards) {
    lines.push(`--- CARD ${card.index}/4 ---`);
    lines.push(`[Paste with 0${card.index}-${getCardFilename(card.type)}.png]`);
    lines.push("");
    lines.push(card.caption);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate README.txt content.
 */
function generateReadmeFile(
  chaserCode: string,
  targetCode: string,
  snapshot?: ImplicationsSnapshot | null,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const implicationsNote = snapshot
    ? `
IMPLICATIONS SCENARIO:
- Horizon: ${snapshot.horizon.years} years (${snapshot.horizon.baseYear}-${snapshot.horizon.targetYear})
- Population: UN ${snapshot.assumptions.populationVariant} scenario
- Template: ${snapshot.assumptions.template}-like development path
- Grid losses: ${snapshot.assumptions.assumptions.gridLossPct}%
- Net imports: ${snapshot.assumptions.assumptions.netImportsPct}% of gross supply

SOURCES:
${snapshot.provenance
  .map(
    (source) =>
      `- ${source.indicator}: ${source.source}${source.observedYear ? ` (${source.observedYear})` : ""}${source.sourceVintage ? ` [${source.sourceVintage}]` : ""}${source.sourceCode ? ` — ${source.sourceCode}` : ""}`,
  )
  .join("\n")}

The implications are an illustrative annual-energy scenario, not a forecast or a complete power-system plan.
`
    : "";
  return `Convergence Thread Package
Generated: ${date}
Comparison: ${chaserCode} → ${targetCode}

FILES:
- 01-main-chart.png: Main convergence projection
- 02-sensitivity.png: Sensitivity analysis (±1% scenarios)
- 03-historical.png: Historical context comparison
- 04-implications.png: Macro implications summary
- captions.txt: Copy-paste captions for each card
${implicationsNote}

HOW TO USE:
1. Open Twitter/X and start a new post
2. Paste caption for Card 1 and attach 01-main-chart.png
3. Reply to your post with Card 2 content
4. Continue replying for Cards 3 and 4

Generated by mountaintoclimb.com
`;
}

function getCardFilename(type: ThreadCardType): string {
  switch (type) {
    case "main":
      return "main-chart";
    case "sensitivity":
      return "sensitivity";
    case "historical":
      return "historical";
    case "implications":
      return "implications";
    default:
      return "card";
  }
}

/**
 * Generate and download a ZIP file containing the thread package.
 */
export async function downloadThreadZip(pkg: ThreadPackage): Promise<void> {
  const zip = new JSZip();

  const pngFiles = await Promise.all(
    pkg.cards.map(async (card) => ({
      card,
      pngBlob: await svgStringToPngBlob(card.svgString, CARD_DIMENSIONS, 2),
    })),
  );

  // Add PNG images
  for (const { card, pngBlob } of pngFiles) {
    const filename = `0${card.index}-${getCardFilename(card.type)}.png`;
    zip.file(filename, pngBlob);
  }

  // Add captions.txt
  zip.file("captions.txt", generateCaptionsFile(pkg.cards));

  // Add README.txt
  zip.file(
    "README.txt",
    generateReadmeFile(pkg.chaserCode, pkg.targetCode, pkg.implicationsSnapshot),
  );

  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `convergence-thread-${pkg.chaserCode}-${pkg.targetCode}-${date}.zip`;
  downloadBlob(filename, zipBlob);
}

/**
 * Copy all captions to clipboard.
 */
export async function copyAllCaptions(cards: ThreadCard[]): Promise<void> {
  const text = cards.map((c) => `--- ${c.index}/4 ---\n\n${c.caption}`).join("\n\n");
  await navigator.clipboard.writeText(text);
}
