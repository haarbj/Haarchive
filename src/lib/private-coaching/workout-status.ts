import { getWorkoutPlannedDistanceM, formatDistanceRange, formatDurationRange, formatPaceRange } from "./workout-distance";
import { summarizeStep, type StepInput } from "./steps";
import { formatResolvedPaceText, PACE_REFERENCE_LABELS, type PaceReferenceKey, type ResolvedPaceReference } from "./pace-reference";
import { formatResolvedVolumeText } from "./volume-reference";

// The DB's scheduled_workout_status enum defines 'missed'/'skipped' values
// that no application code actually writes -- status is always derived at
// read time (coach-home-data.ts's own missed-workout query is the existing
// precedent this generalizes). Single source of truth for that derivation
// so the calendar and the attention/notification queries never drift.
export type WorkoutStatus = "draft" | "scheduled" | "completed" | "missed";

// Coach-facing label is "Scheduled," not "Pending" -- "Pending" reads as
// "something is awaiting my approval," which is specifically wrong here:
// an athlete's Strava match review/approval is invisible to the coach
// either way, so nothing is ever pending on the coach's side. hasCompletion
// is the only signal this function accepts for "did it happen" -- there is
// no parameter through which Strava-pending state could leak in.
export function computeWorkoutStatus(args: {
  publishedAt: string | null;
  scheduledDate: string; // YYYY-MM-DD
  hasCompletion: boolean;
  today: string; // YYYY-MM-DD
}): WorkoutStatus {
  if (!args.publishedAt) return "draft";
  if (args.hasCompletion) return "completed";
  return args.scheduledDate < args.today ? "missed" : "scheduled";
}

// day_label is the coach-facing vocabulary going forward; title is a
// legacy field (nullable, no longer coach-editable) kept only for a
// graceful display fallback on rows created before day_label existed. One
// place for this fallback chain instead of it being copy-pasted (and
// risking slightly different wording) across every card/notification/list
// that shows a workout's name.
export function getWorkoutDisplayLabel(dayLabel: string | null, title: string | null): string {
  return dayLabel ?? title ?? "Workout";
}

export type WorkoutDetailSummary = {
  heading: string;
  /** Distance/duration/pace, joined -- null if none of the three is set. */
  rangeText: string | null;
  /** Per-step breakdown, only meaningful when rangeText is absent (see WorkoutCard's own precedent: a structured workout with no top-level range shows its steps instead of a number). */
  stepsSummary: string | null;
  /** Extras, with their count when set, e.g. "4x Strides · Mobility." */
  extrasText: string | null;
};

// A workout whose distance/duration may be expressed as a volumePercent
// (see volume-reference.ts) instead of a literal figure. Mirrors
// pace-reference.ts's own additive-fields contract exactly: the literal
// planned* fields stay whatever the DB actually has (null whenever a
// percent is active), and resolved* is the live, read-time-only resolution
// -- NEVER written back into planned*, so the edit form (which reads the
// plain planned* fields) always reopens showing "% of week: X," never a
// stale literal number.
export type VolumeResolvableWorkout = {
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  volumePercent: number | null;
  resolvedDistanceM: number | null;
  resolvedDistanceMaxM: number | null;
  resolvedDurationS: number | null;
  resolvedDurationMaxS: number | null;
};

// The one place "which figure actually applies" is decided -- shared by
// describeWorkoutDetail below, Month View's own compact chip rendering, and
// the Weekly Load footer's per-entry input, so a volume-percent workout
// can't render differently across those three surfaces.
export function effectiveWorkoutVolume(workout: VolumeResolvableWorkout): {
  distanceM: number | null;
  distanceMaxM: number | null;
  durationS: number | null;
  durationMaxS: number | null;
} {
  if (workout.volumePercent == null) {
    return {
      distanceM: workout.plannedDistanceM,
      distanceMaxM: workout.plannedDistanceMaxM,
      durationS: workout.plannedDurationS,
      durationMaxS: workout.plannedDurationMaxS,
    };
  }
  return {
    distanceM: workout.resolvedDistanceM,
    distanceMaxM: workout.resolvedDistanceMaxM,
    durationS: workout.resolvedDurationS,
    durationMaxS: workout.resolvedDurationMaxS,
  };
}

// The exact "what does this workout actually say" derivation, shared by
// WorkoutCard (Week/Day View's own card) and MonthView's condensed
// per-day entries -- one place this composition lives, so Month View's
// "same data as the weekly view, just smaller" requirement can't quietly
// drift from what the weekly card itself shows.
//
// `resolved` is the caller's already-resolved pace-reference data (see
// pace-reference.ts) -- this function stays pure and never resolves
// anything itself. `stepPaceReferences` must be the same length/order as
// `workout.steps` (null entries for a step with no reference); omit
// `resolved` entirely for a workout that uses no reference anywhere.
export function describeWorkoutDetail(
  workout: {
    dayLabel: string | null;
    title: string | null;
    sessionSlot: string | null;
    plannedDistanceM: number | null;
    plannedDistanceMaxM: number | null;
    plannedDurationS: number | null;
    plannedDurationMaxS: number | null;
    plannedPaceSPerMi: number | null;
    plannedPaceMaxSPerMi: number | null;
    paceReference: PaceReferenceKey | null;
    volumePercent: number | null;
    resolvedDistanceM: number | null;
    resolvedDistanceMaxM: number | null;
    resolvedDurationS: number | null;
    resolvedDurationMaxS: number | null;
    steps: StepInput[];
    extras: { kind: string; count: number | null }[];
  },
  resolved?: {
    workoutPace: ResolvedPaceReference | null;
    stepPaces: (ResolvedPaceReference | null)[];
  },
): WorkoutDetailSummary {
  const displayLabel = getWorkoutDisplayLabel(workout.dayLabel, workout.title);
  const heading = workout.sessionSlot ? `${displayLabel} · ${workout.sessionSlot}` : displayLabel;

  const effectiveVolume = effectiveWorkoutVolume(workout);
  const plannedDistanceM = getWorkoutPlannedDistanceM(effectiveVolume.distanceM);
  const distanceText = formatDistanceRange(plannedDistanceM, effectiveVolume.distanceMaxM);
  const durationText = formatDurationRange(effectiveVolume.durationS, effectiveVolume.durationMaxS);
  const paceText = workout.paceReference
    ? formatResolvedPaceText(resolved?.workoutPace ?? null, PACE_REFERENCE_LABELS[workout.paceReference])
    : formatPaceRange(workout.plannedPaceSPerMi, workout.plannedPaceMaxSPerMi);
  // A volume-percent workout that hasn't resolved to anything yet (no
  // target set for that week) still needs an honest fallback -- mirrors
  // pace's own "no race on file yet" state rather than silently showing
  // nothing.
  const volumeUnresolvedText =
    workout.volumePercent != null && distanceText == null && durationText == null
      ? formatResolvedVolumeText(null, workout.volumePercent)
      : null;
  const rangeText = [distanceText, durationText, paceText].filter(Boolean).join(" · ") || volumeUnresolvedText;

  const stepsSummary =
    workout.steps.length > 0
      ? workout.steps.map((step, i) => summarizeStep(step, resolved?.stepPaces[i])).join(" · ")
      : null;
  const extrasText =
    workout.extras.length > 0 ? workout.extras.map((e) => (e.count != null ? `${e.count}x ${e.kind}` : e.kind)).join(" · ") : null;

  return { heading, rangeText, stepsSummary, extrasText };
}
