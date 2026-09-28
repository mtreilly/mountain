// Italic sans glyphs average roughly half an em wide; close enough to decide fit.
const AVG_CHAR_EM = 0.52;
const SIDE_GAP = 8;

/**
 * Pick the projection-region label that fits its width: the full label, a short
 * one, or nothing when the region is too narrow for either.
 */
export function fitProjectionLabel(
  regionWidth: number,
  fontSize: number,
  labels: { full: string; short: string },
): string | null {
  const fits = (text: string) => text.length * fontSize * AVG_CHAR_EM + SIDE_GAP * 2 <= regionWidth;
  if (fits(labels.full)) return labels.full;
  if (fits(labels.short)) return labels.short;
  return null;
}
