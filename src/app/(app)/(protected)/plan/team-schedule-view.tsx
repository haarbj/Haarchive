import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { workoutTypeLabel } from "./format-workout";
import { GroupWorkoutCompleteButton } from "./group-workout-complete-button";
import type { WorkoutType } from "@/lib/coaching-engine";

type GroupPlanWorkout = {
  id: string;
  scheduled_date: string;
  time_of_day: string | null;
  location: string | null;
  description: string;
  secondary_activity: string | null;
  workout_type: WorkoutType | null;
  distance_m: number | null;
  pace_fast_sec_per_mile: number | null;
  pace_slow_sec_per_mile: number | null;
  is_race: boolean;
  notes: string | null;
  published_at: string | null;
};

function formatMinSecPerMile(secPerMile: number): string {
  return `${Math.floor(secPerMile / 60)}:${(secPerMile % 60).toString().padStart(2, "0")}`;
}

function GroupWorkoutRow({
  workout,
  completed,
  showCompleteButton,
  showPublishState,
}: {
  workout: GroupPlanWorkout;
  completed: boolean;
  showCompleteButton: boolean;
  showPublishState: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {formatDate(workout.scheduled_date)}
            {(workout.time_of_day || workout.location) &&
              ` · ${[workout.time_of_day, workout.location].filter(Boolean).join(" · ")}`}
            {workout.workout_type && ` · ${workoutTypeLabel(workout.workout_type)}`}
            {workout.is_race && " · Race"}
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{workout.description}</p>
          {workout.secondary_activity && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{workout.secondary_activity}</p>
          )}
          {(workout.distance_m || workout.pace_fast_sec_per_mile) && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {workout.distance_m && `${(workout.distance_m / 1609.34).toFixed(1)} mi`}
              {workout.distance_m && workout.pace_fast_sec_per_mile && " · "}
              {workout.pace_fast_sec_per_mile &&
                workout.pace_slow_sec_per_mile &&
                `${formatMinSecPerMile(workout.pace_fast_sec_per_mile)}–${formatMinSecPerMile(workout.pace_slow_sec_per_mile)}/mi`}
            </p>
          )}
          {workout.notes && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{workout.notes}</p>}
          {showPublishState && !workout.published_at && (
            <p className="mt-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">Not published</p>
          )}
        </div>
        {completed && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Completed
          </span>
        )}
      </div>
      {showCompleteButton && (
        <div className="mt-2">
          <GroupWorkoutCompleteButton workoutId={workout.id} completed={completed} />
        </div>
      )}
    </div>
  );
}

// Team-connected athletes get their schedule from a coach-published group
// plan instead of an individually-generated one -- this is a genuinely
// different data source (group_plan_workouts, coach-authored free text)
// from the self-serve path's algorithmic training_plans/workouts, so it's
// its own render path rather than a branch inside the self-serve one.
export async function TeamScheduleView({ userId, coachView = false }: { userId: string; coachView?: boolean }) {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {coachView
          ? "This athlete isn't in a group yet."
          : "You're connected to Brophy Broncos XC, but not assigned to a group yet -- check with your coach."}
      </p>
    );
  }

  const { data: group } = await supabase.from("groups").select("name").eq("id", membership.group_id).maybeSingle();

  // Publishing is per-entry now (Stage J), not per-plan -- any group_plan
  // this group has qualifies as "the" one to look at (most recently
  // created, in case a group somehow has plans across more than one
  // season); whether anything inside it is actually published is a
  // per-workout question, handled by the workouts query below and the
  // generic "nothing scheduled" empty state.
  const { data: groupPlan } = await supabase
    .from("group_plans")
    .select("id")
    .eq("group_id", membership.group_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!groupPlan) {
    return (
      <div>
        <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          {group?.name}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {coachView
            ? "No schedule for this group yet."
            : "You're connected to Brophy Broncos XC — your coach hasn't set up a schedule for your group yet."}
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 2);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 12);

  let workoutsQuery = supabase
    .from("group_plan_workouts")
    .select("id, scheduled_date, time_of_day, location, description, secondary_activity, workout_type, distance_m, pace_fast_sec_per_mile, pace_slow_sec_per_mile, is_race, notes, published_at")
    .eq("group_plan_id", groupPlan.id)
    .gte("scheduled_date", windowStart.toISOString().slice(0, 10))
    .lte("scheduled_date", windowEnd.toISOString().slice(0, 10));
  // A coach previewing an athlete's page sees everything they've built,
  // published or not -- their own session's RLS grant (group_plan_workouts_
  // all_coach) already permits reading unpublished rows, so this app-layer
  // filter is the only thing standing between "coach preview" and "athlete
  // view" here; the athlete's own session can never see an unpublished row
  // regardless, since their RLS grant requires published_at is not null.
  if (!coachView) workoutsQuery = workoutsQuery.not("published_at", "is", null);
  const { data: workouts } = await workoutsQuery.order("scheduled_date", { ascending: true }).returns<GroupPlanWorkout[]>();

  const workoutIds = (workouts ?? []).map((w) => w.id);
  const { data: completions } = workoutIds.length
    ? await supabase
        .from("workout_completions")
        .select("group_plan_workout_id")
        .eq("user_id", userId)
        .in("group_plan_workout_id", workoutIds)
    : { data: [] };
  const completedIds = new Set((completions ?? []).map((c) => c.group_plan_workout_id));

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
        {group?.name}
      </p>
      <div className="mt-3 space-y-3">
        {workouts && workouts.length > 0 ? (
          workouts.map((workout) => (
            <GroupWorkoutRow
              key={workout.id}
              workout={workout}
              completed={completedIds.has(workout.id)}
              showCompleteButton={!coachView && workout.scheduled_date <= today}
              showPublishState={coachView}
            />
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing scheduled in the next couple of weeks.</p>
        )}
      </div>
    </div>
  );
}
