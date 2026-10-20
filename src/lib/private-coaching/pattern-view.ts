import type { WorkoutType } from "@/lib/coaching-engine";
import { addDays, mostRecentMonday } from "@/lib/week";
import { computeWeeklyLoad, type WeeklyLoadEntry } from "./weekly-load";
import { isBigSession, type PlanHealthWorkout } from "./plan-health";

// Wetmore's principle, made mechanical: never judge training by a single
// workout, judge the trend. This module only ever aggregates and
// compares -- it never grades, scores, or recommends (adaptation cards
// own that). Weekly figures are produced by computeWeeklyLoad, the exact
// same per-workout-reconciled function the coach's week-calendar footer
// and the roster dashboard already use -- there is no second weekly-
// aggregation path here, only a loop that calls it once per week.
//
// Pure and DB-free: same input always produces the same six weeks and
// the same trend descriptors in the same order.

export const PATTERN_VIEW_WEEK_COUNT = 6;

export type PatternViewWorkout = {
  id: string;
  /** YYYY-MM-DD. */
  scheduledDate: string;
  dayLabel: string | null;
  workoutType: WorkoutType | null;
  plannedDistanceM: number | null;
  plannedDurationS: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  isOptional: boolean;
  actualDistanceM: number | null;
  actualDurationS: number | null;
  actualRpe: number | null;
};

export type PatternViewCheckin = {
  /** YYYY-MM-DD, the Monday the check-in reports on. */
  weekStart: string;
  overallFeel: number | null;
  fatigue: number;
  soreness: number;
  sleepQuality: number;
  stress: number;
};

export type TrendDirection = "rising" | "falling" | "steady" | "insufficient-data";

export type PatternWeek = {
  weekStart: string;
  weekEnd: string;
  /** The week still in progress as of `today` -- its numbers are real, never hidden, but excluded from every trend descriptor below (see computePatternView's own header). */
  isCurrent: boolean;
  /** Entirely before the athlete's program started -- a gap, visually distinct from a programmed week that simply had nothing scheduled. */
  isGap: boolean;
  scheduledMileageM: number | null;
  /** Scheduled (non-Off) completions only -- an Off-day completion never inflates this, same reconciliation computeWeeklyLoad already applies. */
  completedMileageM: number | null;
  scheduledWorkoutCount: number | null;
  completedWorkoutCount: number | null;
  /** completedWorkoutCount / scheduledWorkoutCount, or null when there was nothing scheduled to complete. */
  completionRate: number | null;
  /** The week's longest completed long run (workout_type "long"). Null when none was completed, never zero. */
  longRunDistanceM: number | null;
  /** Average logged RPE across completed key sessions (isBigSession, excluding long runs) this week. Null when none. */
  keySessionAvgRpe: number | null;
  /** Average prescribed RPE across the SAME key sessions, only where one was actually set. Null when none had a prescribed value. */
  keySessionAvgPrescribedRpe: number | null;
  checkin: PatternViewCheckin | null;
};

export type PatternSeries = {
  weeks: PatternWeek[];
  /** Trend of completed (scheduled-only) weekly mileage -- the actual training load, not the coach's planned volume. */
  completedMileageTrend: TrendDirection;
  completionRateTrend: TrendDirection;
  longRunTrend: TrendDirection;
  keySessionRpeTrend: TrendDirection;
  checkinTrend: TrendDirection;
};

export type PatternViewInput = {
  /** Viewer's own "today" (todayForViewer()), YYYY-MM-DD -- whoever is looking at the page, coach or athlete, not a stored athlete timezone. */
  today: string;
  /** The earliest date this athlete has ever had a published workout, or null if they never have. Everything before it is a gap. */
  programStartDate: string | null;
  /** Every scheduled workout (any status) whose date could fall in the 6-week window -- callers may over-fetch, this function only reads what lands inside a given week. */
  workouts: PatternViewWorkout[];
  checkins: PatternViewCheckin[];
};

function toPlanHealthWorkout(w: PatternViewWorkout): PlanHealthWorkout {
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

function isLongRun(w: PatternViewWorkout): boolean {
  return w.workoutType === "long";
}

// The exact same taxonomy plan-realignment.ts and adaptation-signals.ts
// already established: long run is its own thing, "key session" is
// isBigSession (plan-health.ts) minus long runs. Not reinvented here.
function isKeySession(w: PatternViewWorkout): boolean {
  return !isLongRun(w) && isBigSession(toPlanHealthWorkout(w));
}

function hasCompletion(w: PatternViewWorkout): boolean {
  return w.actualDistanceM != null || w.actualDurationS != null;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const MIN_QUALIFYING_WEEKS_FOR_TREND = 4;

/**
 * Splits chronologically-ordered values into "prior" and "recent" halves
 * (recent gets the extra week on an odd count) and compares their means
 * against `threshold` (an absolute difference for a bounded scale like a
 * rate or an RPE, or treated as a fraction of the prior mean for an
 * unbounded one like mileage -- see each call site). Fewer than
 * MIN_QUALIFYING_WEEKS_FOR_TREND values is "insufficient-data": a 1-vs-1
 * or 2-vs-1 comparison is exactly the single-data-point judgment this
 * whole view exists to avoid.
 */
function trendDirection(values: number[], threshold: number, relative: boolean): TrendDirection {
  if (values.length < MIN_QUALIFYING_WEEKS_FOR_TREND) return "insufficient-data";
  const recentCount = Math.ceil(values.length / 2);
  const recent = values.slice(values.length - recentCount);
  const prior = values.slice(0, values.length - recentCount);
  const recentMean = mean(recent);
  const priorMean = mean(prior);
  const diff = recentMean - priorMean;
  const effectiveThreshold = relative ? Math.abs(priorMean) * threshold : threshold;
  if (diff > effectiveThreshold) return "rising";
  if (diff < -effectiveThreshold) return "falling";
  return "steady";
}

function qualifyingValues(weeks: PatternWeek[], select: (week: PatternWeek) => number | null): number[] {
  const out: number[] = [];
  for (const week of weeks) {
    if (week.isGap || week.isCurrent) continue;
    const value = select(week);
    if (value != null) out.push(value);
  }
  return out;
}

/**
 * The window's own 6 Monday dates, oldest first, ending on the week
 * containing `today` -- exported so a data loader can scope its queries
 * (which dates to fetch workouts/check-ins for) without re-deriving this
 * logic a second time, the same window computePatternView itself uses.
 */
export function patternViewWeekStarts(today: string): string[] {
  const currentWeekStart = mostRecentMonday(new Date(`${today}T00:00:00Z`));
  const weekStarts: string[] = [];
  for (let i = PATTERN_VIEW_WEEK_COUNT - 1; i >= 0; i--) {
    weekStarts.push(addDays(currentWeekStart, -7 * i));
  }
  return weekStarts;
}

export function computePatternView(input: PatternViewInput): PatternSeries {
  const weekStarts = patternViewWeekStarts(input.today);
  const currentWeekStart = weekStarts[weekStarts.length - 1];

  const weeks: PatternWeek[] = weekStarts.map((weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    const isCurrent = weekStart === currentWeekStart;
    const isGap = input.programStartDate == null || weekEnd < input.programStartDate;

    if (isGap) {
      return {
        weekStart,
        weekEnd,
        isCurrent,
        isGap: true,
        scheduledMileageM: null,
        completedMileageM: null,
        scheduledWorkoutCount: null,
        completedWorkoutCount: null,
        completionRate: null,
        longRunDistanceM: null,
        keySessionAvgRpe: null,
        keySessionAvgPrescribedRpe: null,
        checkin: null,
      };
    }

    const weekWorkouts = input.workouts.filter((w) => w.scheduledDate >= weekStart && w.scheduledDate <= weekEnd);

    const entries: WeeklyLoadEntry[] = weekWorkouts.map((w) => ({
      dayLabel: w.dayLabel,
      distanceM: w.plannedDistanceM,
      durationS: w.plannedDurationS,
      actualDistanceM: w.actualDistanceM,
      actualDurationS: w.actualDurationS,
      scheduledDate: w.scheduledDate,
    }));
    const load = computeWeeklyLoad(entries, null, input.today);

    const completedLongRuns = weekWorkouts.filter((w) => isLongRun(w) && hasCompletion(w) && w.actualDistanceM != null);
    const longRunDistanceM = completedLongRuns.length > 0 ? Math.round(Math.max(...completedLongRuns.map((w) => w.actualDistanceM!))) : null;

    const completedKeySessions = weekWorkouts.filter((w) => isKeySession(w) && w.actualRpe != null);
    const keySessionAvgRpe = completedKeySessions.length > 0 ? mean(completedKeySessions.map((w) => w.actualRpe!)) : null;
    const keySessionsWithPrescribedRpe = completedKeySessions.filter((w) => (w.plannedRpeMax ?? w.plannedRpe) != null);
    const keySessionAvgPrescribedRpe =
      keySessionsWithPrescribedRpe.length > 0 ? mean(keySessionsWithPrescribedRpe.map((w) => (w.plannedRpeMax ?? w.plannedRpe)!)) : null;

    const checkin = input.checkins.find((c) => c.weekStart === weekStart) ?? null;

    return {
      weekStart,
      weekEnd,
      isCurrent,
      isGap: false,
      scheduledMileageM: load.scheduledMileageM,
      completedMileageM: load.completedMileageM,
      scheduledWorkoutCount: load.scheduledWorkoutCount,
      completedWorkoutCount: load.completedWorkoutCount,
      completionRate: load.scheduledWorkoutCount > 0 ? load.completedWorkoutCount / load.scheduledWorkoutCount : null,
      longRunDistanceM,
      keySessionAvgRpe,
      keySessionAvgPrescribedRpe,
      checkin,
    };
  });

  // Mileage is unbounded and scales with the athlete, so its threshold is
  // relative (5% of the prior mean); completion rate, RPE, and the
  // check-in scale are all small, bounded quantities where a relative
  // threshold would be unstable near zero, so those use a fixed absolute
  // difference instead.
  const completedMileageTrend = trendDirection(qualifyingValues(weeks, (w) => w.completedMileageM), 0.05, true);
  const completionRateTrend = trendDirection(qualifyingValues(weeks, (w) => w.completionRate), 0.05, false);
  const longRunTrend = trendDirection(qualifyingValues(weeks, (w) => w.longRunDistanceM), 0.05, true);
  const keySessionRpeTrend = trendDirection(qualifyingValues(weeks, (w) => w.keySessionAvgRpe), 0.5, false);
  const checkinTrend = trendDirection(qualifyingValues(weeks, (w) => w.checkin?.overallFeel ?? null), 0.3, false);

  return { weeks, completedMileageTrend, completionRateTrend, longRunTrend, keySessionRpeTrend, checkinTrend };
}
