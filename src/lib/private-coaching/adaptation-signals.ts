import { addDays } from "@/lib/week";
import { compareCompletionToPlan, isRpeNoteworthy } from "./completion-comparison";
import { isBigSession, type PlanHealthWorkout } from "./plan-health";
import type { WorkoutType } from "@/lib/coaching-engine";

// Consent-based adaptation cards: a deterministic signal engine watching
// each athlete's recent training for four stated patterns. Pure --
// same training data in, same card set out -- and advisory only: nothing
// here writes anything. A coach reviews each card and decides (see
// adaptation-service.ts for the create/accept/dismiss lifecycle, which
// mirrors realignment-service.ts's own shape).
//
// Key session vs filler reuses the exact same taxonomy plan-realignment.ts
// already established for this codebase: long run is workout_type ===
// "long" (the real Postgres enum value); key session is isBigSession
// (plan-health.ts, reused verbatim). Not reinvented here.

export type AdaptationWorkoutRecord = {
  id: string;
  scheduledDate: string; // YYYY-MM-DD
  workoutType: WorkoutType | null;
  dayLabel: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  isOptional: boolean;
  /** Null when this workout has never been completed (missed, or still upcoming). */
  completedAt: string | null; // ISO timestamp
  actualDistanceM: number | null;
  loggedRpe: number | null;
};

export type DisruptionWindow = { startDate: string; endDate: string };

function toPlanHealthWorkout(w: AdaptationWorkoutRecord): PlanHealthWorkout {
  return {
    id: w.id,
    scheduledDate: w.scheduledDate,
    dayLabel: w.dayLabel,
    prescription: null,
    plannedRpe: w.plannedRpe,
    plannedRpeMax: w.plannedRpeMax,
    pacePercentBasis: null,
    pacePercentMin: null,
    pacePercentMax: null,
    isOptional: w.isOptional,
    phaseKey: null,
  };
}

function isLongRun(w: AdaptationWorkoutRecord): boolean {
  return w.workoutType === "long";
}

function isKeySession(w: AdaptationWorkoutRecord): boolean {
  return !isLongRun(w) && isBigSession(toPlanHealthWorkout(w));
}

function isCompleted(w: AdaptationWorkoutRecord): boolean {
  return w.completedAt != null;
}

function isUpcoming(w: AdaptationWorkoutRecord, today: string): boolean {
  return !isCompleted(w) && w.scheduledDate >= today;
}

/** plannedRpeMax ?? plannedRpe -- the same single-reference convention isBigSession itself uses. */
function prescribedRpeOf(w: AdaptationWorkoutRecord): number | null {
  return w.plannedRpeMax ?? w.plannedRpe;
}

// ---------------------------------------------------------------------------
// Signal 1: fitness moved up
// ---------------------------------------------------------------------------

export const FITNESS_UP_SAMPLE_SIZE = 4;
export const FITNESS_UP_MIN_HITS = 3;
export const FITNESS_UP_RPE_UNDER_THRESHOLD = 2;

export type FitnessUpEvidenceEntry = { workoutId: string; scheduledDate: string; dayLabel: string | null; prescribedRpe: number; loggedRpe: number };

export type FitnessUpSignal = {
  signal: "fitness_up";
  evidence: FitnessUpEvidenceEntry[];
  /**
   * Insert a retest/threshold-check workout -- chosen over raising
   * upcoming easy-pace targets because this codebase has no athlete-level
   * "current easy pace" to bump: pace on scheduled_workouts is always
   * either a literal figure, a named race-pace reference resolved live
   * from the athlete's most recent race result, or a percent-of-estimate
   * -- raising "easy pace" would mean either a real per-row rewrite of
   * every upcoming literal-paced workout, or fabricating a faster race
   * result to shift what the reference resolves to. Inserting one new
   * workout is a single, clean, auditable row -- no existing data
   * touched at all until the coach accepts and picks the day.
   */
  action: { kind: "insert_retest_workout" };
};

/**
 * >= FITNESS_UP_MIN_HITS of the last FITNESS_UP_SAMPLE_SIZE completed
 * non-key (filler) workouts logged RPE at least
 * FITNESS_UP_RPE_UNDER_THRESHOLD points under what was prescribed --
 * easy days consistently feeling too easy, the signal a plan built for
 * yesterday's fitness is behind today's.
 */
export function evaluateFitnessUp(workouts: AdaptationWorkoutRecord[]): FitnessUpSignal | null {
  const recentFiller = [...workouts]
    .filter((w) => isCompleted(w) && !isKeySession(w) && !isLongRun(w) && prescribedRpeOf(w) != null && w.loggedRpe != null)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
    .slice(0, FITNESS_UP_SAMPLE_SIZE);

  const hits = recentFiller.filter((w) => prescribedRpeOf(w)! - w.loggedRpe! >= FITNESS_UP_RPE_UNDER_THRESHOLD);
  if (hits.length < FITNESS_UP_MIN_HITS) return null;

  return {
    signal: "fitness_up",
    evidence: hits.map((w) => ({
      workoutId: w.id,
      scheduledDate: w.scheduledDate,
      dayLabel: w.dayLabel,
      prescribedRpe: prescribedRpeOf(w)!,
      loggedRpe: w.loggedRpe!,
    })),
    action: { kind: "insert_retest_workout" },
  };
}

// ---------------------------------------------------------------------------
// Signal 2: fatigue accumulating
// ---------------------------------------------------------------------------

export const FATIGUE_WINDOW_SHORT_DAYS = 7;
export const FATIGUE_WINDOW_SHORT_MIN = 2;
export const FATIGUE_WINDOW_LONG_DAYS = 14;
export const FATIGUE_WINDOW_LONG_MIN = 3;

export type FatigueEvidenceEntry = { workoutId: string; scheduledDate: string; dayLabel: string | null; prescribedRpe: number | null; loggedRpe: number };

export type FatigueSignal = {
  signal: "fatigue_accumulating";
  evidence: FatigueEvidenceEntry[];
  action: { kind: "convert_to_easy"; workoutId: string; scheduledDate: string };
};

/**
 * >= FATIGUE_WINDOW_SHORT_MIN noteworthy-RPE completions (isRpeNoteworthy,
 * reused exactly) in the last 7 days, or >= FATIGUE_WINDOW_LONG_MIN in 14
 * -- either threshold alone fires it. Proposes converting the athlete's
 * next upcoming key session to easy, a draft change applied through the
 * same scheduled_workouts update path every other draft edit uses.
 */
export function evaluateFatigueAccumulating(workouts: AdaptationWorkoutRecord[], today: string): FatigueSignal | null {
  const completed = workouts.filter((w) => isCompleted(w) && w.loggedRpe != null);
  const noteworthy = completed.filter((w) => isRpeNoteworthy(w.plannedRpe, w.plannedRpeMax, w.loggedRpe));

  const shortWindowStart = addDays(today, -FATIGUE_WINDOW_SHORT_DAYS);
  const inShortWindow = noteworthy.filter((w) => w.completedAt!.slice(0, 10) >= shortWindowStart && w.completedAt!.slice(0, 10) <= today);

  const longWindowStart = addDays(today, -FATIGUE_WINDOW_LONG_DAYS);
  const inLongWindow = noteworthy.filter((w) => w.completedAt!.slice(0, 10) >= longWindowStart && w.completedAt!.slice(0, 10) <= today);

  const fires = inShortWindow.length >= FATIGUE_WINDOW_SHORT_MIN || inLongWindow.length >= FATIGUE_WINDOW_LONG_MIN;
  if (!fires) return null;

  const evidenceSet = inLongWindow.length >= inShortWindow.length ? inLongWindow : inShortWindow;

  const nextKeySession = [...workouts]
    .filter((w) => isUpcoming(w, today) && isKeySession(w))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  if (!nextKeySession) return null; // Nothing upcoming to protect -- no action to propose, so no card.

  return {
    signal: "fatigue_accumulating",
    evidence: evidenceSet.map((w) => ({
      workoutId: w.id,
      scheduledDate: w.scheduledDate,
      dayLabel: w.dayLabel,
      prescribedRpe: prescribedRpeOf(w),
      loggedRpe: w.loggedRpe!,
    })),
    action: { kind: "convert_to_easy", workoutId: nextKeySession.id, scheduledDate: nextKeySession.scheduledDate },
  };
}

// ---------------------------------------------------------------------------
// Signal 3: plan set too low
// ---------------------------------------------------------------------------

export const PLAN_TOO_LOW_SAMPLE_SIZE = 3;
export const PLAN_TOO_LOW_OVER_THRESHOLD = 0.1; // 10%

export type PlanTooLowEvidenceEntry = {
  workoutId: string;
  scheduledDate: string;
  dayLabel: string | null;
  plannedDistanceM: number;
  actualDistanceM: number;
  overPercent: number;
};

export type PlanTooLowSignal = {
  signal: "plan_too_low";
  evidence: PlanTooLowEvidenceEntry[];
  action: { kind: "raise_distance"; workoutId: string; scheduledDate: string; currentDistanceM: number; newDistanceM: number };
};

/**
 * The last PLAN_TOO_LOW_SAMPLE_SIZE distance workouts (completed, with a
 * planned distance) EACH came in >= 10% over planned -- reuses
 * compareCompletionToPlan's own distance-delta math (completion-
 * comparison.ts) rather than re-deriving "percent over" separately, so
 * this signal can never disagree with what a tile already shows for the
 * same workout.
 */
export function evaluatePlanTooLow(workouts: AdaptationWorkoutRecord[]): PlanTooLowSignal | null {
  const recentDistance = [...workouts]
    .filter((w) => isCompleted(w) && w.plannedDistanceM != null && w.actualDistanceM != null)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
    .slice(0, PLAN_TOO_LOW_SAMPLE_SIZE);

  if (recentDistance.length < PLAN_TOO_LOW_SAMPLE_SIZE) return null;

  const evidence: PlanTooLowEvidenceEntry[] = [];
  for (const w of recentDistance) {
    const comparison = compareCompletionToPlan({
      plannedDistanceM: w.plannedDistanceM,
      plannedDistanceMaxM: w.plannedDistanceMaxM,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      actualDistanceM: w.actualDistanceM,
      actualDurationS: null,
    });
    const delta = comparison.distanceDelta;
    if (!delta || delta.deltaValue / delta.plannedValue < PLAN_TOO_LOW_OVER_THRESHOLD) return null; // every one of the 3 must qualify
    evidence.push({
      workoutId: w.id,
      scheduledDate: w.scheduledDate,
      dayLabel: w.dayLabel,
      plannedDistanceM: delta.plannedValue,
      actualDistanceM: delta.actualValue,
      overPercent: Math.round((delta.deltaValue / delta.plannedValue) * 100),
    });
  }

  const mostRecent = recentDistance[0];
  const nextComparable =
    [...workouts]
      .filter((w) => isUpcoming(w, mostRecent.scheduledDate) && w.plannedDistanceM != null && w.workoutType === mostRecent.workoutType)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ??
    [...workouts]
      .filter((w) => isUpcoming(w, mostRecent.scheduledDate) && w.plannedDistanceM != null)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  if (!nextComparable || nextComparable.plannedDistanceM == null) return null; // Nothing upcoming to adjust -- no action to propose.

  const newDistanceM = Math.round(nextComparable.plannedDistanceM * (1 + PLAN_TOO_LOW_OVER_THRESHOLD));

  return {
    signal: "plan_too_low",
    evidence,
    action: {
      kind: "raise_distance",
      workoutId: nextComparable.id,
      scheduledDate: nextComparable.scheduledDate,
      currentDistanceM: nextComparable.plannedDistanceM,
      newDistanceM,
    },
  };
}

// ---------------------------------------------------------------------------
// Signal 4: going quiet
// ---------------------------------------------------------------------------

export const GOING_QUIET_WINDOW_DAYS = 14;
export const GOING_QUIET_MIN_SCHEDULED = 5;
export const GOING_QUIET_MAX_COMPLETION_RATE = 0.6;

export type GoingQuietSignal = {
  signal: "going_quiet";
  evidence: { windowStart: string; windowEnd: string; scheduledCount: number; completedCount: number; completionRate: number };
  /** No plan change -- the existing check-in system's other direction (checkin_requested), see notification-href.ts. */
  action: { kind: "request_checkin" };
};

/**
 * Completion rate <= 60% across >= 5 scheduled (published, already-due)
 * workouts in the last 14 days -- unless that whole window is already
 * covered by a disruption a realignment proposal already flagged, in
 * which case the low completion rate already has a known, acknowledged
 * cause and doesn't need a second nudge.
 */
export function evaluateGoingQuiet(
  workouts: AdaptationWorkoutRecord[],
  today: string,
  realignmentWindows: DisruptionWindow[],
): GoingQuietSignal | null {
  const windowStart = addDays(today, -GOING_QUIET_WINDOW_DAYS);
  const windowEnd = addDays(today, -1); // "already due" -- today itself isn't over yet

  const coveredByRealignment = realignmentWindows.some((w) => w.startDate <= windowEnd && w.endDate >= windowStart);
  if (coveredByRealignment) return null;

  const dueInWindow = workouts.filter((w) => w.scheduledDate >= windowStart && w.scheduledDate <= windowEnd);
  if (dueInWindow.length < GOING_QUIET_MIN_SCHEDULED) return null;

  const completedCount = dueInWindow.filter(isCompleted).length;
  const completionRate = completedCount / dueInWindow.length;
  if (completionRate > GOING_QUIET_MAX_COMPLETION_RATE) return null;

  return {
    signal: "going_quiet",
    evidence: { windowStart, windowEnd, scheduledCount: dueInWindow.length, completedCount, completionRate },
    action: { kind: "request_checkin" },
  };
}

// ---------------------------------------------------------------------------
// Combinator
// ---------------------------------------------------------------------------

export type AdaptationSignalResult = FitnessUpSignal | FatigueSignal | PlanTooLowSignal | GoingQuietSignal;

/**
 * Every signal that fires right now, in a fixed, deterministic order
 * (fitness up, fatigue, plan too low, going quiet) -- the same training
 * data always produces the same set, in the same order. More than one
 * can fire at once for the same athlete (one card each); none of them
 * suppress each other.
 */
export function evaluateAdaptationSignals(
  workouts: AdaptationWorkoutRecord[],
  today: string,
  realignmentWindows: DisruptionWindow[],
): AdaptationSignalResult[] {
  const results: AdaptationSignalResult[] = [];
  const fitnessUp = evaluateFitnessUp(workouts);
  if (fitnessUp) results.push(fitnessUp);
  const fatigue = evaluateFatigueAccumulating(workouts, today);
  if (fatigue) results.push(fatigue);
  const planTooLow = evaluatePlanTooLow(workouts);
  if (planTooLow) results.push(planTooLow);
  const goingQuiet = evaluateGoingQuiet(workouts, today, realignmentWindows);
  if (goingQuiet) results.push(goingQuiet);
  return results;
}

/**
 * A short, stable digest of exactly the evidence that fired a signal --
 * two calls with the same athlete, signal, and evidence always produce
 * the same fingerprint, which is what lets a dismissed card's own 14-day
 * suppression window (see adaptation-service.ts) recognize identical
 * evidence rather than silently regenerating the same card.
 */
export function fingerprintAdaptationCard(athleteId: string, result: AdaptationSignalResult): string {
  const parts: string[] = [athleteId, result.signal];
  if (result.signal === "fitness_up") {
    parts.push(...result.evidence.map((e) => `${e.workoutId}:${e.prescribedRpe}:${e.loggedRpe}`).sort());
  } else if (result.signal === "fatigue_accumulating") {
    parts.push(...result.evidence.map((e) => `${e.workoutId}:${e.loggedRpe}`).sort());
    parts.push(result.action.workoutId);
  } else if (result.signal === "plan_too_low") {
    parts.push(...result.evidence.map((e) => `${e.workoutId}:${e.actualDistanceM}`).sort());
    parts.push(result.action.workoutId);
  } else {
    parts.push(result.evidence.windowStart, result.evidence.windowEnd, String(result.evidence.scheduledCount), String(result.evidence.completedCount));
  }
  return parts.join("|");
}
