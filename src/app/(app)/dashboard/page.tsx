import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoalCard } from "@/app/(app)/dashboard/goal-card";
import { OnboardingForm } from "@/app/(app)/dashboard/onboarding-form";
import { StravaConnection } from "@/app/(app)/dashboard/strava-connection";
import { formatClock, formatDate, formatDistance } from "@/lib/format";
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
      .select("id, calculator_type, label, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<SavedCalculation[]>(),
    supabase.from("connected_accounts").select("id").eq("provider", "strava").maybeSingle(),
    supabase.from("training_plans").select("id").in("status", ["draft", "active"]).maybeSingle(),
  ]);

  const primaryGoal = goals?.[0] ?? null;
  const stravaConnected = !!stravaAccount;
  const hasTrainingPlan = !!trainingPlan;
  const goalReadyForPlan = !!(primaryGoal?.goal_time_s && primaryGoal?.goal_date);

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

        {primaryGoal && <GoalCard goal={primaryGoal} />}

        {primaryGoal && hasTrainingPlan && (
          <Link
            href="/plan"
            className="block rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
          >
            <p className="text-lg font-semibold text-zinc-900 dark:text-white">
              View your training plan →
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              This week&rsquo;s workouts and your current phase.
            </p>
          </Link>
        )}

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

        {raceResults && raceResults.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Recent race results
            </p>
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
          </div>
        )}

        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Saved calculations
          </p>
          {savedCalculations && savedCalculations.length > 0 ? (
            <div className="mt-3 space-y-2">
              {savedCalculations.map((calc) => (
                <div
                  key={calc.id}
                  className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  {calc.label ?? calc.calculator_type}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Nothing saved yet — save a result from the Pace Calculator to see
              it here.
            </p>
          )}
        </div>

        <StravaConnection connected={stravaConnected} />
      </div>
    </section>
  );
}
