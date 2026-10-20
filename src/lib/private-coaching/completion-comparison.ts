import { formatMiles } from "@/lib/format";
import { formatClock } from "@/lib/running-format";
import { formatCompactMiles } from "./workout-distance";

// Planned-vs-completed: the shared math and presentation behind every
// workout tile's distinction between "completed as planned" and
// "completed off-plan," and the one thing every tile surface (WorkoutCard,
// Month View, Timeline, the workout detail page, the self-serve /plan
// card) funnels through so none of them can quietly disagree about where
// the line is. Deliberately neutral: a delta is information, not a grade
// -- there is no pass/fail threshold here, only "close enough to read as
// one clean number" vs "worth showing both."

/** ~10%, inclusive at the boundary -- exactly ±10% reads as on-plan, not off. */
export const COMPLETION_TOLERANCE = 0.1;

export type WorkoutDelta = {
  /** A range's own midpoint when a max is set, otherwise the single planned value -- the one number "planned" means for comparison purposes. */
  plannedValue: number;
  actualValue: number;
  /** actualValue - plannedValue, signed: positive means more than planned, negative means less. Never clamped to 0 -- going long is information, not an error. */
  deltaValue: number;
  withinTolerance: boolean;
};

function computeDelta(plannedMin: number | null, plannedMax: number | null, actualValue: number | null): WorkoutDelta | null {
  if (plannedMin == null || actualValue == null || plannedMin <= 0) return null;
  const plannedValue = plannedMax != null && plannedMax !== plannedMin ? (plannedMin + plannedMax) / 2 : plannedMin;
  const deltaValue = actualValue - plannedValue;
  const withinTolerance = Math.abs(deltaValue) / plannedValue <= COMPLETION_TOLERANCE;
  return { plannedValue, actualValue, deltaValue, withinTolerance };
}

export type CompletionComparison = {
  distanceDelta: WorkoutDelta | null;
  durationDelta: WorkoutDelta | null;
  /**
   * True when the primary metric (distance when a planned distance
   * exists, duration otherwise) stayed within COMPLETION_TOLERANCE of
   * plan, OR when there was nothing to compare at all (no planned target
   * was ever logged for this workout) -- no evidence of drift reads as
   * on-plan, never as a manufactured off-plan flag for a workout that
   * never had a target to miss.
   */
  onPlan: boolean;
};

export function compareCompletionToPlan(input: {
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  actualDistanceM: number | null;
  actualDurationS: number | null;
}): CompletionComparison {
  const distanceDelta = computeDelta(input.plannedDistanceM, input.plannedDistanceMaxM, input.actualDistanceM);
  const durationDelta = computeDelta(input.plannedDurationS, input.plannedDurationMaxS, input.actualDurationS);
  const primary = input.plannedDistanceM != null ? distanceDelta : durationDelta;
  const onPlan = primary == null ? true : primary.withinTolerance;
  return { distanceDelta, durationDelta, onPlan };
}

/** "8.0mi" (compact, dense tiles) or "8.0 mi" (full, cards/detail). */
export function formatActualDistance(actualDistanceM: number, style: "compact" | "full"): string {
  return style === "compact" ? `${formatCompactMiles(actualDistanceM)}mi` : formatMiles(actualDistanceM);
}

/** "8.0mi → 6.2mi" or "8.0 mi planned → 6.2 mi" -- planned always first, actual always second, direction never hidden. */
export function formatDistanceDelta(delta: WorkoutDelta, style: "compact" | "full"): string {
  if (style === "compact") return `${formatCompactMiles(delta.plannedValue)}mi → ${formatCompactMiles(delta.actualValue)}mi`;
  return `${formatMiles(delta.plannedValue)} planned → ${formatMiles(delta.actualValue)}`;
}

/** "45:00 → 38:12" -- precise clock time, same formatter actual durations already use everywhere else in this codebase. */
export function formatDurationDelta(delta: WorkoutDelta): string {
  return `${formatClock(delta.plannedValue)} → ${formatClock(delta.actualValue)}`;
}

export type CompletionFigures = {
  distanceText: string | null;
  durationText: string | null;
};

/**
 * The single rule every tile/card/detail-page completion display follows:
 * on-plan shows one clean actual-only line (planned is never fabricated
 * into view here -- it's available elsewhere, e.g. a hover title, see
 * each call site); off-plan shows the delta for whichever metric has
 * both a planned and an actual value, falling back to actual-alone for a
 * metric missing one side (e.g. distance logged, duration never was) --
 * never a fabricated delta for half-known data.
 */
export function describeCompletionFigures(
  comparison: CompletionComparison,
  actuals: { actualDistanceM: number | null; actualDurationS: number | null },
  style: "compact" | "full",
): CompletionFigures {
  if (comparison.onPlan) {
    return {
      distanceText: actuals.actualDistanceM != null ? formatActualDistance(actuals.actualDistanceM, style) : null,
      durationText: actuals.actualDurationS != null ? formatClock(actuals.actualDurationS) : null,
    };
  }
  return {
    distanceText: comparison.distanceDelta
      ? formatDistanceDelta(comparison.distanceDelta, style)
      : actuals.actualDistanceM != null
        ? formatActualDistance(actuals.actualDistanceM, style)
        : null,
    durationText: comparison.durationDelta
      ? formatDurationDelta(comparison.durationDelta)
      : actuals.actualDurationS != null
        ? formatClock(actuals.actualDurationS)
        : null,
  };
}
