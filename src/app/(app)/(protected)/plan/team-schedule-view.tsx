import { createClient } from "@/lib/db/server";
import { formatClock } from "@/lib/format";
import { WorkoutLengthLine, WorkoutMetaLine } from "@/components/workout-summary-line";
import { CompletionSummary, type CompletionDetail } from "./completion-detail";
import { GroupWorkoutCompleteForm, UndoGroupCompletionButton } from "./group-workout-complete-form";
import type { WorkoutType } from "@/lib/coaching-engine";

type AthleteGoal = { race_name: string; distance_m: number; goal_time_s: number | null };

type GroupPlanWorkout = {
  id: string;
  scheduled_date: string;
  time_of_day: string | null;
  location: string | null;
  description: string;
  secondary_activity: string | null;
  workout_type: WorkoutType | null;
  duration_min: number | null;
  distance_m: number | null;
  pace_fast_sec_per_mile: number | null;
  pace_slow_sec_per_mile: number | null;
  is_race: boolean;
  notes: string | null;
  published_at: string | null;
  explanation: string | null;
};

function GroupWorkoutRow({
  workout,
  completion,
  showCompleteForm,
  showPublishState,
  athleteGoal,
}: {
  workout: GroupPlanWorkout;
  completion: CompletionDetail | null;
  showCompleteForm: boolean;
  showPublishState: boolean;
  athleteGoal: AthleteGoal | null;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <WorkoutMetaLine date={workout.scheduled_date} workout={workout} />
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{workout.description}</p>
          {workout.secondary_activity && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{workout.secondary_activity}</p>
          )}
          <WorkoutLengthLine workout={workout} />
          {workout.is_race && athleteGoal && (
            <p className="mt-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
              Your goal: {athleteGoal.race_name}
              {athleteGoal.goal_time_s ? `, ${formatClock(athleteGoal.goal_time_s)}` : ""}
            </p>
          )}
          {workout.notes && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{workout.notes}</p>}
          {workout.explanation && (
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">Why today </span>
              {workout.explanation}
            </p>
          )}
          {showPublishState && !workout.published_at && (
            <p className="mt-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">Not published</p>
          )}
          {completion && <CompletionSummary completion={completion} />}
        </div>
        {completion && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Completed
          </span>
        )}
      </div>
      {showCompleteForm &&
        (completion ? (
          <div className="mt-2">
            <UndoGroupCompletionButton workoutId={workout.id} />
          </div>
        ) : (
          <GroupWorkoutCompleteForm workoutId={workout.id} isRace={workout.is_race} />
        ))}
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
    .select("id, scheduled_date, time_of_day, location, description, secondary_activity, workout_type, duration_min, distance_m, pace_fast_sec_per_mile, pace_slow_sec_per_mile, is_race, notes, published_at, explanation")
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
        .select("group_plan_workout_id, actual_distance_m, actual_time_s, rpe, avg_hr, notes")
        .eq("user_id", userId)
        .in("group_plan_workout_id", workoutIds)
        .returns<(CompletionDetail & { group_plan_workout_id: string })[]>()
    : { data: [] };
  const completionByWorkoutId = new Map((completions ?? []).map((c) => [c.group_plan_workout_id, c]));

  const { data: athleteGoal } = await supabase
    .from("goals")
    .select("race_name, distance_m, goal_time_s")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AthleteGoal>();

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
              completion={completionByWorkoutId.get(workout.id) ?? null}
              showCompleteForm={!coachView && workout.scheduled_date <= today}
              showPublishState={coachView}
              athleteGoal={athleteGoal ?? null}
            />
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Nothing scheduled in the next couple of weeks.</p>
        )}
      </div>
    </div>
  );
}
