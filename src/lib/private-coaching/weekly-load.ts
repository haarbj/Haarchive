import { isXtLabel, splitDayLabel } from "./day-type-visuals";
import { distanceMFromDurationPace, durationSFromDistancePace } from "./workout-distance";
import { formatMiles } from "@/lib/format";

// The Weekly Load footer's reconciled figure -- everything except
// cross-training counts toward mileage (a duration-only non-XT day is
// estimated into miles via the athlete's own easy pace, "assume the
// athlete will warm up at around that pace"); XT always stays separate,
// shown additively ("40 miles + 60min XT"). distanceM/durationS here are
// already the workout's EFFECTIVE values -- resolved volume-percent
// applied upstream if any (see effectiveWorkoutVolume in
// workout-status.ts) -- this module never touches volume-percent itself.
export type WeeklyLoadEntry = {
  dayLabel: string | null;
  distanceM: number | null;
  durationS: number | null;
  actualDistanceM: number | null;
  actualDurationS: number | null;
};

export type WeeklyLoadResult = {
  scheduledMileageM: number;
  scheduledXtDurationS: number;
  completedMileageM: number;
  completedXtDurationS: number;
  /** How many entries were pace-estimated -- coach-only context for why the number moves once a real race is logged. */
  estimatedCount: number;
};

// Scheduled totals count EVERY entry regardless of publish status -- this
// footer is a coach-only view of the coach's own planning work (its one
// caller, week-calendar.tsx, lives under /coaching/athletes/[athleteId]/
// schedule; nothing athlete-facing reads this module), so a draft isn't
// hidden information the coach needs protecting from -- it's exactly the
// content they're actively building and need an honest running total for.
// A previous revision gated this on `publishedAt` (carried over from an
// earlier footer that predates this module), which meant a week that was
// entirely drafts -- the normal state while a coach is still laying out
// the week -- always read "Scheduled: 0.0 mi" even though every card
// showed a real distance. Fixed: scheduled and completed are now
// symmetric in this one respect (completed totals already never checked
// publish state, for the same reason -- a coach who logged a completion
// on a draft row still sees it reflected here).
export function computeWeeklyLoad(entries: WeeklyLoadEntry[], easyPaceSPerMi: number | null): WeeklyLoadResult {
  let scheduledMileageM = 0;
  let scheduledXtDurationS = 0;
  let completedMileageM = 0;
  let completedXtDurationS = 0;
  let estimatedCount = 0;

  for (const entry of entries) {
    const { base } = splitDayLabel(entry.dayLabel ?? "");
    const isXt = isXtLabel(base);

    if (isXt) {
      scheduledXtDurationS += entry.durationS ?? 0;
    } else if (entry.distanceM != null) {
      scheduledMileageM += entry.distanceM;
    } else if (entry.durationS != null && easyPaceSPerMi != null) {
      scheduledMileageM += distanceMFromDurationPace(entry.durationS, easyPaceSPerMi);
      estimatedCount += 1;
    }
    // else: duration-only with no race on file -- contributes 0, never a
    // fabricated distance.

    if (isXt) {
      completedXtDurationS += entry.actualDurationS ?? 0;
    } else if (entry.actualDistanceM != null) {
      completedMileageM += entry.actualDistanceM;
    } else if (entry.actualDurationS != null && easyPaceSPerMi != null) {
      completedMileageM += distanceMFromDurationPace(entry.actualDurationS, easyPaceSPerMi);
    }
  }

  return {
    scheduledMileageM: Math.round(scheduledMileageM),
    scheduledXtDurationS,
    completedMileageM: Math.round(completedMileageM),
    completedXtDurationS,
    estimatedCount,
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
): { scheduledText: string; completedText: string } {
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
  return {
    scheduledText: combine(result.scheduledMileageM, result.scheduledXtDurationS),
    completedText: combine(result.completedMileageM, result.completedXtDurationS),
  };
}
