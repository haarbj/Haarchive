import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";
import { effectiveWorkoutVolume } from "@/lib/private-coaching/workout-status";
import type { WeeklyLoadEntry } from "@/lib/private-coaching/weekly-load";

/**
 * Flattens fetchCalendarWorkouts' date-keyed map into the single,
 * date-sorted list the athlete-facing /plan week view renders -- filtering
 * out any unpublished draft along the way, the same rule
 * AthleteHomeSection's own `.not("published_at", "is", null)` filter
 * enforces for the /coaching home list. computeWorkoutStatus already
 * folds "no published_at" into status "draft", so this reuses that
 * existing signal rather than re-deriving a publish check from
 * publishedAt a second time.
 */
export function publishedAssignedWorkoutsThisWeek(workoutsByDate: Record<string, CalendarWorkout[]>): CalendarWorkout[] {
  return Object.values(workoutsByDate)
    .flat()
    .filter((workout) => workout.status !== "draft")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

/**
 * Maps coach-assigned workouts into the same WeeklyLoadEntry shape
 * week-calendar.tsx's own footer builds (effectiveWorkoutVolume resolves
 * a volume-percent day the same way there, reused rather than
 * reimplemented) so computeWeeklyLoad/formatWeeklyLoadText -- the exact
 * functions that module already uses -- can produce the athlete-facing
 * "Scheduled: / Completed:" figures for /plan's week view.
 */
export function weeklyLoadEntriesFromAssignedWorkouts(workouts: CalendarWorkout[]): WeeklyLoadEntry[] {
  return workouts.map((workout) => {
    const effective = effectiveWorkoutVolume(workout);
    return {
      dayLabel: workout.dayLabel,
      distanceM: effective.distanceM,
      durationS: effective.durationS,
      actualDistanceM: workout.completion?.actualDistanceM ?? null,
      actualDurationS: workout.completion?.actualDurationS ?? null,
      scheduledDate: workout.scheduledDate,
    };
  });
}
