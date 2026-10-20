import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutStatus } from "@/lib/private-coaching/workout-status";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { WorkoutType } from "@/lib/coaching-engine";
import type { PaceReferenceKey, ResolvedPaceReference } from "@/lib/private-coaching/pace-reference";

// The explicit view-model boundary between the database and the calendar
// UI: Database -> page.tsx (shapes this) -> WeekCalendar (owns it as
// client state, for optimistic drag/drop) -> WorkoutCard (pure display of
// one of these). Phase 3 (actual-vs-planned) and Phase 4 (environmental)
// extend this same shape rather than inventing a new one.
export type CalendarWorkout = {
  id: string;
  scheduledDate: string; // YYYY-MM-DD
  // Legacy display-only field (nullable, no longer coach-editable) -- see
  // getWorkoutDisplayLabel. day_label is the real coach-facing vocabulary
  // now, never derived from or compared against workoutType.
  title: string | null;
  workoutType: WorkoutType | null;
  dayLabel: string | null;
  sessionSlot: string | null; // free text; "AM"/"PM" are suggested values, not an enum
  extras: WorkoutExtraInput[];
  notesFromCoach: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  // paceReference is the raw, round-tripping DB value (mutually exclusive
  // with plannedPaceSPerMi/MaxSPerMi -- one is always null when the other
  // is set). The three resolved* fields are ADDITIVE display-only data
  // computed live at fetch time (see calendar-data.ts's
  // resolvePaceReference call) -- NEVER written back into
  // plannedPaceSPerMi/MaxSPerMi, so the edit form (which reads the plain
  // planned* fields) always reopens showing "Reference: X," never a stale
  // literal number. null resolvedPace* with a non-null paceReference means
  // "unresolved -- no race on file yet," not "no pace set at all."
  paceReference: PaceReferenceKey | null;
  // pacePercentBasis/Min/Max is the OTHER raw, round-tripping DB value
  // mutually exclusive with plannedPaceSPerMi/MaxSPerMi AND paceReference
  // (see scheduled_workouts_pace_percent_exclusive) -- resolves into the
  // SAME resolvedPaceMinSPerMi/MaxSPerMi/paceReferenceSourceLabel trio
  // below as paceReference does (see calendar-data.ts's resolvedWorkoutPace,
  // which already branches on whichever of the two is set), but previously
  // had no raw field of its own here at all, so the edit form had no value
  // to read back and silently reopened a percent-of-pace workout showing a
  // blank pace field (coaching-platform-audit/01 §5.1's day-level gap).
  pacePercentBasis: PaceReferenceKey | null;
  pacePercentMin: number | null;
  pacePercentMax: number | null;
  resolvedPaceMinSPerMi: number | null;
  resolvedPaceMaxSPerMi: number | null;
  paceReferenceSourceLabel: string | null;
  // volumePercent is the raw, round-tripping DB value (mutually exclusive
  // with plannedDistanceM/MaxM and plannedDurationS/MaxS -- those stay
  // null whenever a percent is active). The four resolved* fields are
  // ADDITIVE display-only data computed live at fetch time from that
  // week's own training_week_plans target (see calendar-data.ts's
  // resolveVolumePercent call) -- NEVER written back into
  // plannedDistanceM/plannedDurationS, so the edit form always reopens
  // showing "% of week: X," never a stale literal number. Null resolved*
  // with a non-null volumePercent means "unresolved -- no target set for
  // that week yet," not "no volume set at all." Only one of
  // resolvedDistanceM/resolvedDurationS is ever populated -- which one
  // depends on that week's own target_volume_unit.
  volumePercent: number | null;
  resolvedDistanceM: number | null;
  resolvedDistanceMaxM: number | null;
  resolvedDurationS: number | null;
  resolvedDurationMaxS: number | null;
  volumeSourceLabel: string | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  steps: StepInput[];
  // Same length/order as `steps`, one resolved reference (or null, for a
  // step with no reference / an unresolved one) per step -- see
  // describeWorkoutDetail's own `resolved.stepPaces` contract in
  // workout-status.ts, which this feeds directly.
  stepPaceReferences: (ResolvedPaceReference | null)[];
  publishedAt: string | null;
  // Presence alone implies "completed" -- no field here or anywhere in
  // this type encodes Strava-pending-match state; the coach-facing
  // calendar never queries strava_pending_matches at all, so there's
  // nothing to leak even by mistake.
  completion: {
    actualDistanceM: number | null;
    actualDurationS: number | null;
    stravaActivityId: number | null;
    // Subjective feedback for the schedule tiles' RPE/notes indicators
    // (completion-comparison.ts) -- a Strava-matched completion never
    // populates any of these (Strava has no way to supply them), so they
    // stay null/false exactly like an unlogged workout would, never a
    // fabricated zero. hasNotes is a boolean, not the note text itself --
    // the raw text deliberately never reaches this view-model, so no
    // tile surface can accidentally render it; the full text is read
    // from completed_workouts directly on the workout detail page.
    rpe: number | null;
    hasNotes: boolean;
    // The athlete's self-described effort/feel category (e.g. "High-end
    // aerobic") when logged -- see effort-levels.ts. Self-serve
    // completions (workout_completions) have no equivalent field; this
    // stays null there, which is the honest answer, not a gap to fill.
    effortLevel: string | null;
  } | null;
  status: WorkoutStatus;
};
