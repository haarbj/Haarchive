// The small template mechanism the source plan data uses for mileage-based
// days: `[[ 6 * multiplier|number:0 ]] [[ units ]] easy`. There's no app
// code anywhere in the source repo (github.com/johnjdavisiv/mee-expl) to
// port this from -- it's data only -- so this module, and the "target peak
// weekly mileage" design behind it, is new, not ported. Quality/interval
// sessions (already written in %5K or %marathon-pace terms) never contain
// these placeholders at all and pass through untouched -- they don't scale
// with volume or depend on a display unit.

export type DistanceUnit = "mi" | "km";

const MULTIPLIER_PATTERN = /\[\[\s*(\d+)\s*\*\s*multiplier\s*\|\s*number:0\s*\]\]/g;
const UNITS_PATTERN = /\[\[\s*units\s*\]\]/g;

// The scale factor mapping a plan's own reference (as-authored) numbers
// onto a target peak weekly volume. This is deliberately NOT a mile<->km
// conversion: it holds every day at the same proportion of peak week it
// always was, and re-anchors peak week to the target number -- a
// proportion is unit-agnostic by construction, which is exactly why `unit`
// isn't a parameter here. It only matters for how the result gets
// labeled (see renderDescription), not for this arithmetic.
export function scaleForTargetPeak(referencePeakWeekly: number, targetPeakWeekly: number): number {
  if (referencePeakWeekly <= 0) return 1;
  return targetPeakWeekly / referencePeakWeekly;
}

export function scaleDistance(referenceValue: number, scale: number): number {
  return referenceValue * scale;
}

// Renders a workout description's placeholders for a given scale and
// display unit. A description with no placeholders (every quality/interval
// session) is returned completely unchanged.
export function renderDescription(description: string, scale: number, unit: DistanceUnit): string {
  return description
    .replace(MULTIPLIER_PATTERN, (_match, n: string) => String(Math.round(Number(n) * scale)))
    .replace(UNITS_PATTERN, unit);
}

export function hasDistancePlaceholder(description: string): boolean {
  return /\[\[\s*\d+\s*\*\s*multiplier/.test(description);
}
