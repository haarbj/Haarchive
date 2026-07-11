import { workoutTypeLabel } from "@/app/(app)/(protected)/plan/format-workout";
import { formatDate } from "@/lib/format";
import type { WorkoutType } from "@/lib/coaching-engine";

// Previously implemented independently in three files (schedule-builder.tsx,
// team-schedule-view.tsx, all-groups-day-view.tsx) -- adding duration_min
// required touching all three by hand. Structural typing means any of those
// files' Workout/GroupPlanWorkout objects satisfy these minimal shapes
// directly, no casting needed.

export function formatMinSecPerMile(secPerMile: number): string {
  return `${Math.floor(secPerMile / 60)}:${(secPerMile % 60).toString().padStart(2, "0")}`;
}

type WorkoutMeta = {
  time_of_day: string | null;
  location: string | null;
  workout_type: WorkoutType | null;
  is_race: boolean;
  duration_min?: number | null;
};

// The "time/location/type/Race" line. `date` (team-schedule-view's athlete
// view prefixes it) and `includeDuration` (all-groups-day-view's compact
// view folds duration in here since it has no separate length line) are
// both opt-in, off by default, so the plain schedule-builder.tsx case needs
// no extra props.
export function WorkoutMetaLine({
  date,
  workout,
  includeDuration = false,
  className = "text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400",
}: {
  date?: string;
  workout: WorkoutMeta;
  includeDuration?: boolean;
  className?: string;
}) {
  const timeLocation = [workout.time_of_day, workout.location].filter(Boolean).join(" · ");
  return (
    <p className={className}>
      {date && formatDate(date)}
      {date && timeLocation && ` · ${timeLocation}`}
      {!date && (timeLocation || "—")}
      {workout.workout_type && ` · ${workoutTypeLabel(workout.workout_type)}`}
      {includeDuration && workout.duration_min && ` · ${workout.duration_min} min`}
      {workout.is_race && (
        <span className="ml-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-rose-800 normal-case dark:bg-rose-900/40 dark:text-rose-300">
          RACE
        </span>
      )}
    </p>
  );
}

type WorkoutLength = {
  duration_min: number | null;
  distance_m: number | null;
  pace_fast_sec_per_mile: number | null;
  pace_slow_sec_per_mile: number | null;
};

const METERS_PER_MILE = 1609.34;

// The duration/distance/pace line -- null if nothing is set, matching every
// existing call site's "don't render an empty line" behavior.
export function WorkoutLengthLine({ workout }: { workout: WorkoutLength }) {
  if (!workout.duration_min && !workout.distance_m && !workout.pace_fast_sec_per_mile) return null;
  return (
    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
      {workout.duration_min && `${workout.duration_min} min`}
      {workout.duration_min && (workout.distance_m || workout.pace_fast_sec_per_mile) && " · "}
      {workout.distance_m && `${(workout.distance_m / METERS_PER_MILE).toFixed(1)} mi`}
      {workout.distance_m && workout.pace_fast_sec_per_mile && " · "}
      {workout.pace_fast_sec_per_mile &&
        workout.pace_slow_sec_per_mile &&
        `${formatMinSecPerMile(workout.pace_fast_sec_per_mile)}–${formatMinSecPerMile(workout.pace_slow_sec_per_mile)}/mi`}
    </p>
  );
}
