import { coreDistanceOf, workoutPrescriptionSchema } from "@/lib/coaching-engine";
import type { WeeklyLoadEntry } from "@/lib/private-coaching/weekly-load";
import type { CompletionDetail } from "./completion-detail";

type SelfServeWorkoutLike = {
  id: string;
  prescription: unknown;
  scheduled_date: string;
};

/**
 * Maps self-created workouts into the same WeeklyLoadEntry shape
 * weeklyLoadEntriesFromAssignedWorkouts (assigned-week-workouts.ts) builds
 * for coach-assigned ones -- the two lists are concatenated before a
 * single computeWeeklyLoad/formatWeeklyLoadText call, so "Weekly Load"
 * reflects assigned + self-created totals together rather than only ever
 * covering assigned workouts (the previous, narrower scope). dayLabel is
 * always null here: self-serve workouts have no coach-authored day-label
 * vocabulary, so none of them can ever match isXtLabel's cross-training
 * check -- their distance always counts toward mileage, never XT minutes,
 * which matches how a self-serve plan has no cross-training workout kind
 * today.
 */
export function weeklyLoadEntriesFromSelfServeWorkouts(
  workouts: SelfServeWorkoutLike[],
  completionByWorkoutId: Map<string, CompletionDetail>,
): WeeklyLoadEntry[] {
  return workouts.map((workout) => {
    const parsed = workoutPrescriptionSchema.safeParse(workout.prescription);
    const completion = completionByWorkoutId.get(workout.id) ?? null;
    return {
      dayLabel: null,
      distanceM: parsed.success ? coreDistanceOf(parsed.data) : null,
      durationS: null,
      actualDistanceM: completion?.actual_distance_m ?? null,
      actualDurationS: completion?.actual_time_s ?? null,
      scheduledDate: workout.scheduled_date,
    };
  });
}
