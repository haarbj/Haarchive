// Pure, framework-free helpers for Timeline View -- split out from
// timeline-view.tsx (a "use client" component importing React hooks and
// next/navigation, neither of which a plain Node test environment can
// import directly) so the actual date-window math and tile-figure
// formatting are unit-testable without a component-rendering harness,
// which this repo doesn't have (see vitest.config.ts's node environment).

import { addDays, shiftWeek, mostRecentMonday } from "@/lib/week";
import { formatDate } from "@/lib/format";
import { effectiveWorkoutVolume } from "@/lib/private-coaching/workout-status";
import { formatCompactDistanceRange, formatDurationRange, formatPaceRange } from "@/lib/private-coaching/workout-distance";
import type { CalendarWorkout } from "./calendar-types";

type WeekBlock = { weekStart: string };

export const WEEKS_BEHIND_INITIAL = 2;
export const WEEKS_AHEAD_INITIAL = 4;
export const WEEKS_PER_LOAD = 3;

/** "Week of Oct 19 – Oct 25" -- the sticky header's own label for one week block. */
export function weekRangeLabel(weekStart: string): string {
  return `Week of ${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;
}

/**
 * The initial continuous-scroll window: WEEKS_BEHIND_INITIAL weeks before
 * centerWeek, centerWeek itself, then WEEKS_AHEAD_INITIAL weeks after --
 * in chronological order, exactly what TimelineViewSection's server
 * component fetches up front and what jumpWindowForDate rebuilds around a
 * picked date.
 */
export function initialWeekWindow(centerWeek: string): string[] {
  return [
    ...Array.from({ length: WEEKS_BEHIND_INITIAL }, (_, i) => shiftWeek(centerWeek, -(WEEKS_BEHIND_INITIAL - i))),
    centerWeek,
    ...Array.from({ length: WEEKS_AHEAD_INITIAL }, (_, i) => shiftWeek(centerWeek, i + 1)),
  ];
}

/**
 * The next WEEKS_PER_LOAD week-starts to fetch when the coach scrolls
 * past either edge of what's currently loaded -- "before" extends
 * backward from the earliest loaded week (oldest-first, so prepending
 * keeps chronological order), "after" extends forward from the latest.
 */
export function nextWeeksToLoad(edgeWeek: string, direction: "before" | "after"): string[] {
  if (direction === "before") {
    return Array.from({ length: WEEKS_PER_LOAD }, (_, i) => shiftWeek(edgeWeek, -(WEEKS_PER_LOAD - i)));
  }
  return Array.from({ length: WEEKS_PER_LOAD }, (_, i) => shiftWeek(edgeWeek, i + 1));
}

/** The date picker's jump target: the Monday-start week containing isoDate, plus the exact same WEEKS_BEHIND_INITIAL/WEEKS_AHEAD_INITIAL window shape the initial server render uses, so a far jump looks and scrolls exactly like landing on this view fresh would. */
export function jumpWindowForDate(isoDate: string): { weekStart: string; weeks: string[] } {
  const weekStart = mostRecentMonday(new Date(`${isoDate}T00:00:00Z`));
  return { weekStart, weeks: initialWeekWindow(weekStart) };
}

export type TimelineTileFigures = {
  distanceText: string | null;
  durationText: string | null;
  /** Pace when set; RPE ("RPE 5" / "RPE 5–7") only as a fallback when no pace is set at all -- never both at once. */
  effortText: string | null;
};

/**
 * Timeline View's own denser tile content -- distance, duration, and
 * pace/effort are ALL returned (when set), unlike Month View's
 * single-figure-wins compact chip. Works identically for a coach-assigned
 * workout and a self-coached one (coach_id === athlete_id on
 * scheduled_workouts) -- both are the exact same CalendarWorkout shape
 * from the exact same fetchCalendarWorkouts query, so there's no separate
 * code path to keep in sync here.
 */
/**
 * The single place week lists get merged -- prepend, append, and a
 * date-jump's fresh window all funnel through this before becoming the
 * new `weeks` state, so no load path (present or future) can land two
 * sections keyed by the same weekStart. `weeks` is read in the order
 * given; the first occurrence of each weekStart wins and every later
 * duplicate is dropped. Pass the newly-loaded block(s) first for a
 * prepend (so freshly-fetched data wins over a stale duplicate already
 * in state) and last for an append.
 */
export function mergeTimelineWeeks<T extends WeekBlock>(weeks: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const week of weeks) {
    if (seen.has(week.weekStart)) continue;
    seen.add(week.weekStart);
    result.push(week);
  }
  return result;
}

export function buildTimelineTileFigures(workout: CalendarWorkout): TimelineTileFigures {
  const effective = effectiveWorkoutVolume(workout);
  const distanceText = formatCompactDistanceRange(effective.distanceM, effective.distanceMaxM);
  const durationText = formatDurationRange(effective.durationS, effective.durationMaxS);
  const paceText = workout.paceReference
    ? formatPaceRange(workout.resolvedPaceMinSPerMi, workout.resolvedPaceMaxSPerMi)
    : formatPaceRange(workout.plannedPaceSPerMi, workout.plannedPaceMaxSPerMi);
  const effortText = paceText ?? (workout.plannedRpe != null ? `RPE ${workout.plannedRpe}${workout.plannedRpeMax ? `–${workout.plannedRpeMax}` : ""}` : null);
  return { distanceText, durationText, effortText };
}
