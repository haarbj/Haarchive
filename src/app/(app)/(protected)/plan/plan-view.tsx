import { redirect } from "next/navigation";

import {
  addDays,
  diffDays,
  distanceBucket,
  phaseSummary,
  workoutPrescriptionSchema,
  type MesocyclePhase,
  type WorkoutType,
} from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { describePrescription, workoutTypeLabel } from "./format-workout";
import { WorkoutCard } from "./workout-card";

type Mesocycle = {
  id: string;
  phase: MesocyclePhase;
  start_date: string;
  end_date: string;
  focus_notes: string | null;
};

type WorkoutRow = {
  id: string;
  scheduled_date: string;
  workout_type: WorkoutType;
  prescription: unknown;
  adapted_at: string | null;
  adaptation_reason: string | null;
  adaptation_explanation: string | null;
};

// Read-only row for the coach's view of an athlete's plan -- deliberately
// not the full interactive WorkoutCard (complete/adjust/explain all act on
// behalf of "the current session's own user_id" today, not an athleteId
// parameter, so wiring those up for a coach acting on someone else's
// workout is real additional scope, not part of this pass). Same
// information, no interactive controls.
function ReadOnlyWorkoutRow({ workout, completed }: { workout: WorkoutRow; completed: boolean }) {
  const parsed = workoutPrescriptionSchema.safeParse(workout.prescription);
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {formatDate(workout.scheduled_date)} · {workoutTypeLabel(workout.workout_type)}
          </p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
            {parsed.success ? describePrescription(parsed.data) : "Details unavailable"}
          </p>
        </div>
        {completed && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Completed
          </span>
        )}
      </div>
    </div>
  );
}

type PlanViewProps = {
  userId: string;
  coachView?: boolean;
};

// Shared between the self-serve /plan page (userId = the caller's own
// session) and the coach's per-athlete view (userId = the route's
// athleteId) -- render logic is identical either way, only whose rows are
// visible differs, which is purely an RLS question already solved by the
// coach-athlete RLS migration. Every query here is explicitly scoped by
// userId rather than left to RLS alone, since RLS for a coach session
// permits reading multiple different athletes' rows, not just one.
export async function PlanView({ userId, coachView = false }: PlanViewProps) {
  const supabase = await createClient();

  const { data: goal } = await supabase
    .from("goals")
    .select("race_name, distance_m")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Falls back to "middle" for the edge case of a plan outliving its goal
  // (e.g. the goal was later marked achieved/abandoned) -- a plan can't be
  // generated without an active goal in the first place, so this is a
  // defensive default, not the common path.
  const bucket = goal?.distance_m ? distanceBucket(goal.distance_m) : "middle";

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, name, start_date, end_date")
    .eq("user_id", userId)
    .in("status", ["draft", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    if (coachView) {
      return (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          This athlete doesn&rsquo;t have a training plan yet.
        </p>
      );
    }
    redirect("/plan/new");
  }

  const { data: mesocycles } = await supabase
    .from("mesocycles")
    .select("id, phase, start_date, end_date, focus_notes")
    .eq("training_plan_id", plan.id)
    .order("start_date", { ascending: true })
    .returns<Mesocycle[]>();

  const today = new Date().toISOString().slice(0, 10);
  const currentMesocycle =
    mesocycles?.find((m) => m.start_date <= today && today <= m.end_date) ?? null;
  const planComplete = !currentMesocycle && mesocycles && today > (mesocycles.at(-1)?.end_date ?? "");

  const weekIndex = Math.max(0, Math.floor(diffDays(plan.start_date, today) / 7));
  const weekStart = addDays(plan.start_date, weekIndex * 7);
  const weekEnd = addDays(weekStart, 6);

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, scheduled_date, workout_type, prescription, adapted_at, adaptation_reason, adaptation_explanation")
    .eq("mesocycle_id", currentMesocycle?.id ?? mesocycles?.at(-1)?.id ?? "")
    .gte("scheduled_date", weekStart)
    .lte("scheduled_date", weekEnd)
    .order("scheduled_date", { ascending: true })
    .returns<WorkoutRow[]>();

  const workoutIds = workouts?.map((w) => w.id) ?? [];
  const { data: completions } = await supabase
    .from("workout_completions")
    .select("id, workout_id, actual_distance_m, actual_time_s, rpe")
    .in("workout_id", workoutIds.length > 0 ? workoutIds : ["00000000-0000-0000-0000-000000000000"]);

  const completedWorkoutIds = new Set((completions ?? []).map((c) => c.workout_id));

  return (
    <>
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        {plan.name}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {goal?.race_name ? `Building toward ${goal.race_name} on ${formatDate(plan.end_date)}.` : null}
      </p>

      {planComplete ? (
        <div className="mt-10 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            This plan has run its course.{" "}
            {coachView ? "Nice work." : "Nice work — set a new goal on your dashboard whenever you’re ready for the next one."}
          </p>
        </div>
      ) : (
        <>
          {currentMesocycle && (
            <div className="mt-10 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                Current phase
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 capitalize dark:text-white">
                {currentMesocycle.phase}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {phaseSummary(currentMesocycle.phase, bucket)}
              </p>
              {currentMesocycle.focus_notes && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {currentMesocycle.focus_notes}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(currentMesocycle.start_date)} – {formatDate(currentMesocycle.end_date)}
              </p>
            </div>
          )}

          <div className="mt-8">
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              This week
            </p>
            <div className="mt-3 space-y-3">
              {workouts && workouts.length > 0 ? (
                workouts.map((workout) =>
                  coachView ? (
                    <ReadOnlyWorkoutRow key={workout.id} workout={workout} completed={completedWorkoutIds.has(workout.id)} />
                  ) : (
                    <WorkoutCard
                      key={workout.id}
                      workout={workout}
                      phase={currentMesocycle?.phase ?? null}
                      distanceBucket={bucket}
                      completed={completedWorkoutIds.has(workout.id)}
                    />
                  ),
                )
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  No workouts scheduled this week.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
