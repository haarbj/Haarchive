import { isXtLabel, splitDayLabel } from "./day-type-visuals";
import { distanceMFromDurationPace, durationSFromDistancePace } from "./workout-distance";
import { formatMiles } from "@/lib/format";
import { formatClock } from "@/lib/running-format";

// The Weekly Load footer's reconciled figure -- everything except
// cross-training counts toward mileage (a duration-only non-XT day is
// estimated into miles via the athlete's own easy pace, "assume the
// athlete will warm up at around that pace"); XT always stays separate,
// shown additively ("40 miles + 60min XT"). distanceM/durationS here are
// already the workout's EFFECTIVE values -- resolved volume-percent
// applied upstream if any (see effectiveWorkoutVolume in
// workout-status.ts) -- this module never touches volume-percent itself.
//
// Reconciliation is per-entry, never a net of two independently-summed
// week totals: an entry with no scheduled distance/duration at all (an
// Off day, or any day with nothing planned) has nothing to credit a
// completion against, so a completion logged on one of those rows -- the
// run genuinely happened, it just isn't the day's plan -- counts as
// unscheduled volume instead of netting against the rest of the week's
// remaining work. scheduledDate is used for exactly one thing: a
// scheduled (non-Off) workout that's already in the past with no
// completion is "missed," not "remaining" -- it stays inside the
// top-line scheduledMileageM total unchanged (Scheduled's own range-sum
// logic never changes), but doesn't inflate what's still realistically
// ahead.
export type WeeklyLoadEntry = {
  dayLabel: string | null;
  distanceM: number | null;
  durationS: number | null;
  actualDistanceM: number | null;
  actualDurationS: number | null;
  /** YYYY-MM-DD, compared against `today` passed to computeWeeklyLoad -- the one piece of date awareness this otherwise date-agnostic module needs, solely to tell "missed" apart from "still ahead." */
  scheduledDate: string;
};

export type WeeklyLoadResult = {
  scheduledMileageM: number;
  scheduledXtDurationS: number;
  /** Completed mileage credited against a real scheduled (non-Off) workout only -- see unscheduledMileageM for everything else. */
  completedMileageM: number;
  completedXtDurationS: number;
  /** A completion with no scheduled (non-Off) workout to credit it against -- the run happened, it just wasn't the day's plan. Never nets against scheduled/remaining. */
  unscheduledMileageM: number;
  unscheduledXtDurationS: number;
  unscheduledDurationS: number;
  /** How many entries were pace-estimated -- coach-only context for why the number moves once a real race is logged. */
  estimatedCount: number;
  /**
   * The week's real total time, XT included -- a plain sum of every
   * entry's own known durationS/actualDurationS, never pace-estimated
   * (unlike scheduledMileageM/completedMileageM's duration-only-day
   * estimate above): a workout with no logged duration at all simply
   * doesn't contribute one, rather than fabricating it from distance.
   * Lets "planned vs completed" show distance AND duration side by side
   * (see formatWeeklyLoadText) without inventing a second, parallel
   * mileage-estimation calculation for time.
   */
  scheduledDurationS: number;
  /** Scheduled (non-Off) workouts only -- same basis as completedMileageM. */
  completedDurationS: number;
  /** The sum of every uncompleted, not-yet-missed scheduled (non-Off) workout's own mileage -- by construction, scheduledMileageM minus completedMileageM minus every missed workout's mileage. */
  remainingMileageM: number;
  remainingXtDurationS: number;
  remainingDurationS: number;
  /** "Y" in "X / Y workouts completed" -- real scheduled workouts, Off days excluded. */
  scheduledWorkoutCount: number;
  /** "X" -- scheduled (non-Off) workouts with a completion credited to them. */
  completedWorkoutCount: number;
};

// Scheduled totals count EVERY entry regardless of publish status. For
// week-calendar.tsx (/coaching/athletes/[athleteId]/schedule, the coach's
// own planning view), that's deliberate -- a draft isn't hidden
// information the coach needs protecting from, it's exactly the content
// they're actively building and need an honest running total for. The
// athlete-facing /plan week view (plan-view.tsx, via
// assigned-week-workouts.ts) is the other caller -- it only ever passes
// already-published entries in (drafts are filtered out well before they
// reach this function, see publishedAssignedWorkoutsThisWeek), so the
// "count everything" behavior here never actually surfaces a draft to an
// athlete; this function itself just stays agnostic about publish state
// either way, same as it always has.
// A previous revision gated this on `publishedAt` (carried over from an
// earlier footer that predates this module), which meant a week that was
// entirely drafts -- the normal state while a coach is still laying out
// the week -- always read "Scheduled: 0.0 mi" even though every card
// showed a real distance. Fixed: scheduled and completed are now
// symmetric in this one respect (completed totals already never checked
// publish state, for the same reason -- a coach who logged a completion
// on a draft row still sees it reflected here).
export function computeWeeklyLoad(entries: WeeklyLoadEntry[], easyPaceSPerMi: number | null, today: string): WeeklyLoadResult {
  let scheduledMileageM = 0;
  let scheduledXtDurationS = 0;
  let completedMileageM = 0;
  let completedXtDurationS = 0;
  let unscheduledMileageM = 0;
  let unscheduledXtDurationS = 0;
  let unscheduledDurationS = 0;
  let estimatedCount = 0;
  let scheduledDurationS = 0;
  let completedDurationS = 0;
  let remainingMileageM = 0;
  let remainingXtDurationS = 0;
  let remainingDurationS = 0;
  let scheduledWorkoutCount = 0;
  let completedWorkoutCount = 0;

  for (const entry of entries) {
    const { base } = splitDayLabel(entry.dayLabel ?? "");
    const isXt = isXtLabel(base);

    // Nothing scheduled at all (an Off day, or any day with no planned
    // distance/duration) has no real workout to credit a completion
    // against -- the governing distinction this whole function reconciles
    // around, not a day-label text match.
    const hasScheduledVolume = isXt ? entry.durationS != null : entry.distanceM != null || entry.durationS != null;
    const hasCompletion = entry.actualDistanceM != null || entry.actualDurationS != null;
    const isMissed = !hasCompletion && entry.scheduledDate < today;

    let entryScheduledMileageM = 0;
    if (isXt) {
      scheduledXtDurationS += entry.durationS ?? 0;
    } else if (entry.distanceM != null) {
      entryScheduledMileageM = entry.distanceM;
      scheduledMileageM += entryScheduledMileageM;
    } else if (entry.durationS != null && easyPaceSPerMi != null) {
      entryScheduledMileageM = distanceMFromDurationPace(entry.durationS, easyPaceSPerMi);
      scheduledMileageM += entryScheduledMileageM;
      estimatedCount += 1;
    }
    // else: duration-only with no race on file -- contributes 0, never a
    // fabricated distance.
    if (entry.durationS != null) scheduledDurationS += entry.durationS;

    if (hasScheduledVolume) {
      scheduledWorkoutCount += 1;
      if (hasCompletion) completedWorkoutCount += 1;
    }

    if (hasScheduledVolume) {
      if (isXt) {
        completedXtDurationS += entry.actualDurationS ?? 0;
      } else if (entry.actualDistanceM != null) {
        completedMileageM += entry.actualDistanceM;
      } else if (entry.actualDurationS != null && easyPaceSPerMi != null) {
        completedMileageM += distanceMFromDurationPace(entry.actualDurationS, easyPaceSPerMi);
      }
      if (entry.actualDurationS != null) completedDurationS += entry.actualDurationS;
    } else if (hasCompletion) {
      // Logged against a day with nothing scheduled -- real volume, but
      // never credited toward the plan. See the module header comment.
      if (isXt) {
        unscheduledXtDurationS += entry.actualDurationS ?? 0;
      } else if (entry.actualDistanceM != null) {
        unscheduledMileageM += entry.actualDistanceM;
      } else if (entry.actualDurationS != null && easyPaceSPerMi != null) {
        unscheduledMileageM += distanceMFromDurationPace(entry.actualDurationS, easyPaceSPerMi);
      }
      if (entry.actualDurationS != null) unscheduledDurationS += entry.actualDurationS;
    }

    if (hasScheduledVolume && !hasCompletion && !isMissed) {
      if (isXt) {
        remainingXtDurationS += entry.durationS ?? 0;
      } else {
        remainingMileageM += entryScheduledMileageM;
      }
      if (entry.durationS != null) remainingDurationS += entry.durationS;
    }
  }

  return {
    scheduledMileageM: Math.round(scheduledMileageM),
    scheduledXtDurationS,
    completedMileageM: Math.round(completedMileageM),
    completedXtDurationS,
    unscheduledMileageM: Math.round(unscheduledMileageM),
    unscheduledXtDurationS,
    unscheduledDurationS,
    estimatedCount,
    scheduledDurationS,
    completedDurationS,
    remainingMileageM: Math.round(remainingMileageM),
    remainingXtDurationS,
    remainingDurationS,
    scheduledWorkoutCount,
    completedWorkoutCount,
  };
}

// unitPreference "minutes" converts the mileage figure to a minutes
// equivalent via the same easy pace (durationSFromDistancePace) -- when no
// pace is available yet, falls back to the miles figure rather than
// fabricating a minutes number. XT duration is never touched by the
// miles<->minutes flip either direction -- it was already in minutes.
export function formatWeeklyLoadText(
  result: WeeklyLoadResult,
  unitPreference: "miles" | "minutes",
  easyPaceSPerMi: number | null,
): {
  scheduledText: string;
  completedText: string;
  remainingText: string;
  /** "+5.2 mi" -- only set once there's real unscheduled volume, never shown as "+0". */
  unscheduledText: string | null;
  /** Null when nothing in the week had a known duration at all -- same "say nothing rather than fabricate" rule as scheduledMileageM/completedMileageM's own duration-only-day estimate, just for the figure itself rather than for a day's distance. */
  scheduledDurationText: string | null;
  completedDurationText: string | null;
  /** "X / Y workouts completed" -- Y excludes Off days, X counts only scheduled (non-Off) workouts with a completion. */
  countText: string;
} {
  function primaryText(mileageM: number): string {
    if (unitPreference === "minutes" && easyPaceSPerMi != null) {
      const minutes = Math.round(durationSFromDistancePace(mileageM, easyPaceSPerMi) / 60);
      return `${minutes} min`;
    }
    return formatMiles(mileageM);
  }
  function combine(mileageM: number, xtDurationS: number): string {
    const primary = primaryText(mileageM);
    if (xtDurationS <= 0) return primary;
    return `${primary} + ${Math.round(xtDurationS / 60)}min XT`;
  }
  const unscheduledText =
    result.unscheduledMileageM > 0 || result.unscheduledXtDurationS > 0 ? `+${combine(result.unscheduledMileageM, result.unscheduledXtDurationS)}` : null;
  return {
    scheduledText: combine(result.scheduledMileageM, result.scheduledXtDurationS),
    completedText: combine(result.completedMileageM, result.completedXtDurationS),
    remainingText: combine(result.remainingMileageM, result.remainingXtDurationS),
    unscheduledText,
    scheduledDurationText: result.scheduledDurationS > 0 ? formatClock(result.scheduledDurationS) : null,
    completedDurationText: result.completedDurationS > 0 ? formatClock(result.completedDurationS) : null,
    countText: `${result.completedWorkoutCount} / ${result.scheduledWorkoutCount} workouts completed`,
  };
}
