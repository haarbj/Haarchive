import { workoutTypeLabel, type WorkoutType } from "@/lib/coaching-engine";
import { compareCompletionToPlan } from "./completion-comparison";
import { computeWeeklyLoad, type WeeklyLoadEntry } from "./weekly-load";
import { formatCompactMiles } from "./workout-distance";

// Wooden's principle, made mechanical: praise teaches only when it's
// specific and earned. This module only ever finds and words a fact that
// already exists in the athlete's own data over the check-in's own
// period -- it never writes a compliment, grades a workout, or invents a
// number. If nothing clears a defined bar, it returns an empty array, and
// the composer renders nothing. No AI call, no randomness, no clock
// read -- same inputs always produce the same candidates in the same
// order.
//
// Candidate ids are derived from the source workout id and fact kind
// (never a random uuid or array index) so the same underlying fact
// produces the same id across renders -- the composer doesn't rely on
// this today, but a stable id is the correct default for anything a
// future caller might key a React list or a "dismissed" set on.

export type CheckinPraiseWorkout = {
  id: string;
  /** YYYY-MM-DD. */
  scheduledDate: string;
  dayLabel: string | null;
  title: string | null;
  workoutType: WorkoutType | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  /** The single prescribed RPE a coach set for this session, if any -- a range's own minimum, matching "at or below prescribed" being judged against the easier end a coach would still call controlled. */
  plannedRpe: number | null;
  actualDistanceM: number | null;
  actualDurationS: number | null;
  actualRpe: number | null;
};

export type CheckinPraiseCandidateCategory = "consistency" | "execution" | "milestone";

export type CheckinPraiseCandidate = {
  id: string;
  category: CheckinPraiseCandidateCategory;
  text: string;
};

// A completion streak worth naming on its own, short of a perfect week --
// chosen, not derived from any formula: four real completions in a single
// week is a genuine pattern a coach would naturally remark on, while two
// or three reads as "a normal week," not a fact worth surfacing. "All
// scheduled" (below) is always preferred over this when a week clears
// both bars, since it's the stronger, more specific claim.
export const CONSISTENCY_STREAK_THRESHOLD = 4;

// Even a perfect completion rate isn't worth naming if the week barely
// had anything scheduled -- "completed your 1 workout this week" is
// hollow, not earned. Three real (non-Off) scheduled workouts is the
// floor for "all completed" to fire at all; the streak threshold above
// already implies a floor of its own (you can't have 4 completions out
// of fewer than 4 scheduled).
const MIN_SCHEDULED_FOR_CONSISTENCY = 3;

// "Key" sessions -- the ones a coach would call out by name, where
// completing as planned or controlling effort is actually earned. Easy
// runs, recovery days, and strength work are the expected baseline, not
// an achievement; crediting them here is exactly the "forced praise"
// this feature exists to avoid. Race day is excluded too -- a race result
// has its own, much bigger conversation, not a check-in praise chip.
const KEY_WORKOUT_TYPES = new Set<WorkoutType>(["tempo", "vo2", "long"]);

function isKeyWorkout(workoutType: WorkoutType | null): workoutType is WorkoutType {
  return workoutType != null && KEY_WORKOUT_TYPES.has(workoutType);
}

function hasCompletion(workout: CheckinPraiseWorkout): boolean {
  return workout.actualDistanceM != null || workout.actualDurationS != null;
}

function displayLabel(workout: CheckinPraiseWorkout): string {
  return workout.dayLabel ?? workout.title ?? (workout.workoutType ? workoutTypeLabel(workout.workoutType) : "workout");
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Deliberately not Date#toLocaleDateString (used elsewhere on this site
// for display): this module is pure and deterministic by design, and a
// locale-dependent formatter is one more thing that could vary between
// where candidates are computed and where a test asserts on them. Parses
// the date as UTC so a "YYYY-MM-DD" string's weekday never shifts with
// the server's local timezone.
function weekdayName(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function compactMiles(m: number): string {
  return `${formatCompactMiles(m)} mi`;
}

function consistencyCandidate(periodWorkouts: CheckinPraiseWorkout[], periodEnd: string): CheckinPraiseCandidate | null {
  const entries: WeeklyLoadEntry[] = periodWorkouts.map((w) => ({
    dayLabel: w.dayLabel,
    distanceM: w.plannedDistanceM,
    durationS: w.plannedDurationS,
    actualDistanceM: w.actualDistanceM,
    actualDurationS: w.actualDurationS,
    scheduledDate: w.scheduledDate,
  }));
  // today = periodEnd: the check-in's own week is always already over by
  // the time a coach is reviewing it, so nothing in it is "still ahead" --
  // the only two counts this fact needs (scheduledWorkoutCount,
  // completedWorkoutCount) don't depend on the missed/remaining split
  // anyway, this just satisfies the function's required parameter.
  const result = computeWeeklyLoad(entries, null, periodEnd);
  if (result.scheduledWorkoutCount === 0) return null;

  if (result.completedWorkoutCount === result.scheduledWorkoutCount && result.scheduledWorkoutCount >= MIN_SCHEDULED_FOR_CONSISTENCY) {
    return {
      id: "consistency-all",
      category: "consistency",
      text: `Completed all ${result.scheduledWorkoutCount} scheduled workouts this week.`,
    };
  }
  if (result.completedWorkoutCount >= CONSISTENCY_STREAK_THRESHOLD) {
    return {
      id: "consistency-streak",
      category: "consistency",
      text: `Completed ${result.completedWorkoutCount} of ${result.scheduledWorkoutCount} scheduled workouts this week.`,
    };
  }
  return null;
}

// One candidate per qualifying key-session completion, never two for the
// same workout: an RPE-at-or-below-prescribed reading is the more
// specific, more interesting fact when both qualify (it says something
// about effort, not just distance), so it wins the slot for that workout.
function executionCandidates(periodWorkouts: CheckinPraiseWorkout[]): CheckinPraiseCandidate[] {
  const candidates: CheckinPraiseCandidate[] = [];
  const sorted = [...periodWorkouts].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  for (const workout of sorted) {
    if (!isKeyWorkout(workout.workoutType) || !hasCompletion(workout)) continue;
    const day = weekdayName(workout.scheduledDate);
    const label = displayLabel(workout);

    if (workout.plannedRpe != null && workout.actualRpe != null && workout.actualRpe <= workout.plannedRpe) {
      candidates.push({
        id: `execution-rpe-${workout.id}`,
        category: "execution",
        text: `${day}'s ${label} at RPE ${workout.actualRpe} against a prescribed ${workout.plannedRpe}: controlled execution.`,
      });
      continue;
    }

    const hasPlannedTarget = workout.plannedDistanceM != null || workout.plannedDurationS != null;
    if (!hasPlannedTarget) continue;
    const comparison = compareCompletionToPlan({
      plannedDistanceM: workout.plannedDistanceM,
      plannedDistanceMaxM: workout.plannedDistanceMaxM,
      plannedDurationS: workout.plannedDurationS,
      plannedDurationMaxS: workout.plannedDurationMaxS,
      actualDistanceM: workout.actualDistanceM,
      actualDurationS: workout.actualDurationS,
    });
    if (comparison.onPlan && workout.actualDistanceM != null) {
      candidates.push({
        id: `execution-onplan-${workout.id}`,
        category: "execution",
        text: `${day}'s ${label} completed on plan: ${compactMiles(workout.actualDistanceM)}.`,
      });
    }
  }
  return candidates;
}

function longestRunCandidate(periodWorkouts: CheckinPraiseWorkout[], cycleWorkouts: CheckinPraiseWorkout[]): CheckinPraiseCandidate | null {
  const cycleLongRuns = cycleWorkouts.filter((w) => w.workoutType === "long" && w.actualDistanceM != null);
  if (cycleLongRuns.length === 0) return null;
  const cycleMaxM = Math.max(...cycleLongRuns.map((w) => w.actualDistanceM!));

  const periodLongRuns = periodWorkouts
    .filter((w) => w.workoutType === "long" && w.actualDistanceM != null)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const longest = periodLongRuns.find((w) => w.actualDistanceM! >= cycleMaxM);
  if (!longest) return null;

  return {
    id: `milestone-longest-${longest.id}`,
    category: "milestone",
    text: `Long run up to ${compactMiles(longest.actualDistanceM!)}, longest this cycle.`,
  };
}

// Restricted to KEY_WORKOUT_TYPES for the same reason execution is: a
// first-ever easy run or recovery jog isn't a milestone, it's the
// baseline. A first tempo, first VO2 session, or first long run of a
// program is genuinely new ground.
function firstOfTypeCandidates(periodWorkouts: CheckinPraiseWorkout[], cycleWorkouts: CheckinPraiseWorkout[]): CheckinPraiseCandidate[] {
  const candidates: CheckinPraiseCandidate[] = [];
  const periodCompletions = periodWorkouts
    .filter((w) => isKeyWorkout(w.workoutType) && hasCompletion(w))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  for (const workout of periodCompletions) {
    const earlierOfSameType = cycleWorkouts.some(
      (other) => other.id !== workout.id && other.workoutType === workout.workoutType && hasCompletion(other) && other.scheduledDate < workout.scheduledDate,
    );
    if (earlierOfSameType) continue;
    const day = weekdayName(workout.scheduledDate);
    candidates.push({
      id: `milestone-first-${workout.id}`,
      category: "milestone",
      text: `${day}'s ${displayLabel(workout)} was the first ${workoutTypeLabel(workout.workoutType!)} session completed this program.`,
    });
  }
  return candidates;
}

export const MAX_CHECKIN_PRAISE_CANDIDATES = 3;

/**
 * The one entry point. `periodWorkouts` is every scheduled workout whose
 * scheduledDate falls inside the check-in's own window (the week it
 * covers, start through end inclusive); `cycleWorkouts` is every
 * scheduled workout in the athlete's current program up to and including
 * that same window's end, used only as a comparison baseline for the
 * milestone facts (it must already include periodWorkouts, not sit
 * alongside them). Ordered consistency, then execution, then milestone,
 * each tier itself ordered earliest-date-first; capped at
 * MAX_CHECKIN_PRAISE_CANDIDATES total, dropping from the end (weakest,
 * least specific tier first) rather than truncating within a tier
 * unevenly.
 */
export function computeCheckinPraiseCandidates(input: {
  periodStart: string;
  periodEnd: string;
  periodWorkouts: CheckinPraiseWorkout[];
  cycleWorkouts: CheckinPraiseWorkout[];
}): CheckinPraiseCandidate[] {
  const periodWorkouts = input.periodWorkouts.filter(
    (w) => w.scheduledDate >= input.periodStart && w.scheduledDate <= input.periodEnd,
  );

  const consistency = consistencyCandidate(periodWorkouts, input.periodEnd);
  const execution = executionCandidates(periodWorkouts);
  const milestone = [longestRunCandidate(periodWorkouts, input.cycleWorkouts), ...firstOfTypeCandidates(periodWorkouts, input.cycleWorkouts)].filter(
    (c): c is CheckinPraiseCandidate => c != null,
  );

  const ordered = [...(consistency ? [consistency] : []), ...execution, ...milestone];
  return ordered.slice(0, MAX_CHECKIN_PRAISE_CANDIDATES);
}
