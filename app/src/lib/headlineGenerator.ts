import { formatPercent, formatYears } from "./convergence";

export interface HeadlineData {
  chaserName: string;
  chaserIso: string;
  targetName: string;
  targetIso: string;
  metricName: string;
  chaserGrowthRate: number;
  targetGrowthRate: number;
  yearsToConvergence: number;
  convergenceYear: number | null;
  gap: number;
  appUrl?: string;
}

export type HeadlineScenario = "converging" | "not_converging" | "already_ahead";

export interface GeneratedHeadline {
  short: string; // Twitter-friendly (≤280 chars)
  long: string; // LinkedIn/longer form
  scenario: HeadlineScenario;
}

function getScenario(data: HeadlineData): HeadlineScenario {
  if (data.gap <= 1) {
    return "already_ahead";
  }
  if (!Number.isFinite(data.yearsToConvergence) || data.yearsToConvergence <= 0) {
    return "not_converging";
  }
  return "converging";
}

const SHORT_TEMPLATES = {
  converging: [
    "{chaser} catches {target} in {years} ({year})",
    "{chaser} → {target}: {years} at {chaserGrowth}/yr",
    "{gap}x gap: {chaser} matches {target} in {years}",
  ],
  not_converging: [
    "At {chaserGrowth} vs {targetGrowth}, {chaser} won't catch {target}",
    "{chaser} falls further behind {target} at current rates",
    "The gap widens: {chaser} can't catch {target}",
  ],
  already_ahead: [
    "{chaser} is already ahead of {target}!",
    "{chaser} leads {target} in {metric}",
  ],
} as const;

const LONG_TEMPLATES = {
  converging: [
    "At {chaserGrowth}/yr growth, {chaser} could match {target}'s {metric} in {years} (by {year}). Current gap: {gap}x",
    "{chaser}'s mountain to climb: {gap}x gap with {target}, closing in {years} at {chaserGrowth}/yr vs {targetGrowth}/yr",
    "Economic convergence: {chaser} reaches {target} in {years}. Growth differential: {chaserGrowth} vs {targetGrowth}",
  ],
  not_converging: [
    "At {chaserGrowth}/yr vs {targetGrowth}/yr, {chaser} won't catch {target} in {metric}. The gap continues to widen.",
    "No convergence in sight: {chaser} trails {target} by {gap}x and needs faster growth to close the gap.",
    "{chaser} vs {target}: At current growth rates ({chaserGrowth} vs {targetGrowth}), the economic gap persists.",
  ],
  already_ahead: [
    "{chaser} already leads {target} in {metric}! The convergence question is reversed.",
    "Plot twist: {chaser} is ahead of {target} in {metric}. No catching up needed!",
  ],
} as const;

function fillTemplate(template: string, data: HeadlineData): string {
  const replacements: Record<string, string> = {
    "{chaser}": data.chaserName,
    "{target}": data.targetName,
    "{metric}": data.metricName,
    "{years}": formatYears(data.yearsToConvergence),
    "{year}": data.convergenceYear?.toString() ?? "N/A",
    "{gap}": data.gap.toFixed(1),
    "{chaserGrowth}": formatPercent(data.chaserGrowthRate),
    "{targetGrowth}": formatPercent(data.targetGrowthRate),
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function selectTemplate<T extends readonly string[]>(
  templates: T,
  data: HeadlineData
): string {
  // Use a deterministic selection based on country codes for consistency
  const hash = (data.chaserIso + data.targetIso)
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return templates[hash % templates.length];
}

export function generateHeadline(data: HeadlineData): GeneratedHeadline {
  const scenario = getScenario(data);

  const shortTemplate = selectTemplate(SHORT_TEMPLATES[scenario], data);
  const longTemplate = selectTemplate(LONG_TEMPLATES[scenario], data);

  let short = fillTemplate(shortTemplate, data);
  let long = fillTemplate(longTemplate, data);

  // Add URL if provided and fits
  if (data.appUrl) {
    const urlSuffix = `\n\n${data.appUrl}`;
    // Twitter limit is 280 chars
    if (short.length + urlSuffix.length <= 280) {
      short += urlSuffix;
    }
    long += urlSuffix;
  }

  return { short, long, scenario };
}

export function generateAllHeadlines(data: HeadlineData): {
  scenario: HeadlineScenario;
  headlines: { short: string[]; long: string[] };
} {
  const scenario = getScenario(data);

  const shortHeadlines = SHORT_TEMPLATES[scenario].map((template) =>
    fillTemplate(template, data)
  );
  const longHeadlines = LONG_TEMPLATES[scenario].map((template) =>
    fillTemplate(template, data)
  );

  return {
    scenario,
    headlines: {
      short: shortHeadlines,
      long: longHeadlines,
    },
  };
}

export function getShareUrl(
  platform: "twitter" | "linkedin" | "facebook",
  text: string,
  url?: string
): string {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = url ? encodeURIComponent(url) : "";

  switch (platform) {
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${encodedText}`;
    case "linkedin":
      return url
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        : `https://www.linkedin.com/feed/?shareActive=true&text=${encodedText}`;
    case "facebook":
      return url
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`
        : `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`;
  }
}
