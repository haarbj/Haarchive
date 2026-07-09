import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { describePrescription, workoutTypeLabel } from "@/app/(app)/plan/format-workout";
import { GoalCard, type FitnessEstimate } from "@/app/(app)/dashboard/goal-card";
import { OnboardingForm } from "@/app/(app)/dashboard/onboarding-form";
import { equivalentPerformances } from "@/app/(app)/dashboard/recent-fitness";
import { StravaConnection, type LatestStravaActivity } from "@/app/(app)/dashboard/strava-connection";
import {
  addDays,
  diffDays,
  predictRaceTime,
  summarizeWeek,
  workoutPrescriptionSchema,
  PHASE_SUMMARY,
  type MesocyclePhase,
  type WorkoutType,
} from "@/lib/coaching-engine";
import { formatClock, formatDate, formatDistance, formatMiles, formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

const STRAVA_ERROR_MESSAGES: Record<string, string> = {
  denied: "Strava connection was cancelled.",
  invalid_state: "That Strava connection attempt couldn't be verified — please try again.",
  token_exchange_failed: "Strava didn't accept that connection — please try again.",
  save_failed: "Connected to Strava, but saving it failed — please try again.",
};

type Goal = {
  id: string;
  race_name: string;
  distance_m: number;
  goal_time_s: number | null;
  goal_date: string | null;
};

type RaceResult = {
  id: string;
  race_name: string;
  race_date: string;
  distance_m: number;
  finish_time_s: number;
  course_type: string;
};

type SavedCalculation = {
  id: string;
  calculator_type: string;
  label: string | null;
  created_at: string;
  input_json: unknown;
};

type Mesocycle = {
  phase: MesocyclePhase;
  start_date: string;
  end_date: string;
  focus_notes: string | null;
};

type TodayWorkoutRow = {
  id: string;
  workout_type: WorkoutType;
  prescription: unknown;
};

type DashboardPageProps = {
  searchParams: Promise<{ strava_connected?: string; strava_error?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { strava_connected: stravaConnectedParam, strava_error: stravaErrorParam } =
    await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const [
    { data: goals },
    { data: raceResults },
    { data: savedCalculations },
    { data: stravaAccount },
    { data: trainingPlan },
    { data: latestStravaCompletion },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("id, race_name, distance_m, goal_time_s, goal_date")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<Goal[]>(),
    supabase
      .from("race_results")
      .select("id, race_name, race_date, distance_m, finish_time_s, course_type")
      .order("race_date", { ascending: false })
      .limit(5)
      .returns<RaceResult[]>(),
    supabase
      .from("saved_calculations")
      .select("id, calculator_type, label, created_at, input_json")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<SavedCalculation[]>(),
    supabase.from("connected_accounts").select("id, last_synced_at").eq("provider", "strava").maybeSingle(),
    supabase
      .from("training_plans")
      .select("id, start_date")
      .in("status", ["draft", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_completions")
      .select("workout_id, actual_distance_m")
      .not("strava_activity_id", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const primaryGoal = goals?.[0] ?? null;
  const stravaConnected = !!stravaAccount;
  const hasTrainingPlan = !!trainingPlan;
  const goalReadyForPlan = !!(primaryGoal?.goal_time_s && primaryGoal?.goal_date);

  const mostRecentRace = raceResults?.[0] ?? null;
  const fitnessEstimate: FitnessEstimate | null =
    primaryGoal && mostRecentRace
      ? {
          predictedSeconds: predictRaceTime(mostRecentRace.distance_m, mostRecentRace.finish_time_s, primaryGoal.distance_m),
          sourceRaceName: mostRecentRace.race_name,
        }
      : null;

  const today = new Date().toISOString().slice(0, 10);

  let currentMesocycle: Mesocycle | null = null;
  let todayWorkout: TodayWorkoutRow | null = null;
  let weeklySummary: ReturnType<typeof summarizeWeek> | null = null;

  if (trainingPlan) {
    const [{ data: mesocycles }, { data: todayWorkoutRows }] = await Promise.all([
      supabase
        .from("mesocycles")
        .select("phase, start_date, end_date, focus_notes")
        .eq("training_plan_id", trainingPlan.id)
        .returns<Mesocycle[]>(),
      supabase
        .from("workouts")
        .select("id, workout_type, prescription")
        .eq("scheduled_date", today)
        .limit(1)
        .returns<TodayWorkoutRow[]>(),
    ]);
    currentMesocycle = mesocycles?.find((m) => m.start_date <= today && today <= m.end_date) ?? null;
    todayWorkout = todayWorkoutRows?.[0] ?? null;

    const weekIndex = Math.max(0, Math.floor(diffDays(trainingPlan.start_date, today) / 7));
    if (weekIndex >= 1) {
      const lastWeekStart = addDays(trainingPlan.start_date, (weekIndex - 1) * 7);
      const lastWeekEnd = addDays(lastWeekStart, 6);
      const { data: lastWeekWorkouts } = await supabase
        .from("workouts")
        .select("id")
        .gte("scheduled_date", lastWeekStart)
        .lte("scheduled_date", lastWeekEnd);
      const lastWeekWorkoutIds = lastWeekWorkouts?.map((w) => w.id) ?? [];
      const { data: lastWeekCompletions } = await supabase
        .from("workout_completions")
        .select("actual_distance_m, rpe")
        .in("workout_id", lastWeekWorkoutIds.length > 0 ? lastWeekWorkoutIds : ["00000000-0000-0000-0000-000000000000"]);
      weeklySummary = summarizeWeek(
        (lastWeekCompletions ?? []).map((c) => ({ actualDistanceM: c.actual_distance_m, rpe: c.rpe })),
        lastWeekWorkoutIds.length,
      );
    }
  }

  const parsedTodayWorkout = todayWorkout ? workoutPrescriptionSchema.safeParse(todayWorkout.prescription) : null;

  let latestActivity: LatestStravaActivity | null = null;
  if (latestStravaCompletion?.actual_distance_m) {
    const { data: matchedWorkout } = await supabase
      .from("workouts")
      .select("scheduled_date, workout_type")
      .eq("id", latestStravaCompletion.workout_id)
      .maybeSingle();
    if (matchedWorkout) {
      latestActivity = {
        distanceM: latestStravaCompletion.actual_distance_m,
        workoutType: matchedWorkout.workout_type,
        matchedScheduledDate: matchedWorkout.scheduled_date,
      };
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Dashboard
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        You&rsquo;re signed in.
      </p>

      {stravaConnectedParam && (
        <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Strava connected.
        </p>
      )}
      {stravaErrorParam && (
        <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-400">
          {STRAVA_ERROR_MESSAGES[stravaErrorParam] ?? "Something went wrong connecting Strava."}
        </p>
      )}

      <div className="mt-10 space-y-8">
        {!primaryGoal && <OnboardingForm />}

        {hasTrainingPlan && (
          <div className="rounded-2xl border-2 border-zinc-900 bg-white p-6 shadow-sm dark:border-white dark:bg-zinc-900">
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Today&rsquo;s workout
            </p>
            {todayWorkout && parsedTodayWorkout?.success ? (
              <>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {workoutTypeLabel(todayWorkout.workout_type)}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {describePrescription(parsedTodayWorkout.data)}
                </p>
                <Link
                  href="/plan"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/20 dark:hover:decoration-white"
                >
                  Open workout →
                </Link>
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                No workout scheduled today. Rest days are part of the plan too — adaptation happens
                during recovery, not just during training.
              </p>
            )}
          </div>
        )}

        {hasTrainingPlan && currentMesocycle && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Current training phase
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 capitalize dark:text-white">
              {currentMesocycle.phase}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{PHASE_SUMMARY[currentMesocycle.phase]}</p>
            <Link
              href="/plan"
              className="mt-3 inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              View full plan →
            </Link>
          </div>
        )}

        {primaryGoal && <GoalCard goal={primaryGoal} estimate={fitnessEstimate} />}

        {primaryGoal && !hasTrainingPlan && goalReadyForPlan && (
          <Link
            href="/plan/new"
            className="block rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
          >
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
              Generate your training plan →
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Two questions, and the deterministic coaching engine builds the rest.
            </p>
          </Link>
        )}

        {primaryGoal && !hasTrainingPlan && !goalReadyForPlan && (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Add a goal time and date above to unlock your training plan.
          </p>
        )}

        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Recent fitness
          </p>

          {weeklySummary && (
            <div className="mt-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Last week</p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                <span>{formatMiles(weeklySummary.mileageM)} total</span>
                <span>
                  {weeklySummary.completedCount}/{weeklySummary.scheduledCount} workouts
                </span>
                {weeklySummary.longestRunM > 0 && <span>{formatMiles(weeklySummary.longestRunM)} longest run</span>}
                {weeklySummary.avgRpe !== null && <span>RPE {weeklySummary.avgRpe.toFixed(1)} avg</span>}
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{weeklySummary.summary}</p>
            </div>
          )}

          {raceResults && raceResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {raceResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {result.race_name}
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {formatDistance(result.distance_m)} in{" "}
                    {formatClock(result.finish_time_s)} · {formatDate(result.race_date)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            {savedCalculations && savedCalculations.length > 0 ? (
              <div className="space-y-2">
                {savedCalculations.map((calc) => {
                  const equivalents = equivalentPerformances(calc.input_json);
                  return (
                    <div
                      key={calc.id}
                      className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {calc.label ?? calc.calculator_type}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatRelativeTime(calc.created_at)}
                        </span>
                      </div>
                      {equivalents.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          {equivalents.map((eq) => `${eq.label} ${formatClock(eq.seconds)}`).join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Nothing saved yet — save a result from the Pace Calculator to see it here.
              </p>
            )}
          </div>
        </div>

        <StravaConnection
          connected={stravaConnected}
          lastSyncedAt={stravaAccount?.last_synced_at ?? null}
          latestActivity={latestActivity}
        />
      </div>
    </section>
  );
}
