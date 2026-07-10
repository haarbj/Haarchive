import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { workoutTypeLabel } from "@/app/(app)/(protected)/plan/format-workout";
import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import type { MesocyclePhase, WorkoutType } from "@/lib/coaching-engine";

export const metadata: Metadata = {
  title: "Season",
};

type SeasonPlan = {
  id: string;
  name: string;
  goal_race_name: string;
  goal_race_date: string;
};

type SeasonPhase = {
  id: string;
  phase: MesocyclePhase;
  display_name: string;
  order_index: number;
  start_date: string;
  end_date: string;
  primary_goal: string;
  secondary_goals: string[];
  key_workout_types: WorkoutType[];
};

type SeasonWeek = {
  id: string;
  season_phase_id: string;
  week_index: number;
  theme: string;
  mileage_level: "low" | "moderate" | "high";
  workout_slots: { label: string; workoutType: WorkoutType }[];
};

type SeasonDetailPageProps = {
  params: Promise<{ seasonId: string }>;
};

export default async function SeasonDetailPage({ params }: SeasonDetailPageProps) {
  const { seasonId } = await params;
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("season_plans")
    .select("id, name, goal_race_name, goal_race_date")
    .eq("id", seasonId)
    .maybeSingle<SeasonPlan>();
  if (!season) notFound();

  const [{ data: phases }, { data: weeks }] = await Promise.all([
    supabase
      .from("season_phases")
      .select("id, phase, display_name, order_index, start_date, end_date, primary_goal, secondary_goals, key_workout_types")
      .eq("season_plan_id", seasonId)
      .order("order_index", { ascending: true })
      .returns<SeasonPhase[]>(),
    supabase
      .from("season_weeks")
      .select("id, season_phase_id, week_index, theme, mileage_level, workout_slots")
      .eq("season_plan_id", seasonId)
      .order("week_index", { ascending: true })
      .returns<SeasonWeek[]>(),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{season.name}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Building toward {season.goal_race_name} on {formatDate(season.goal_race_date)}.
      </p>

      <div className="mt-10 space-y-8">
        {phases?.map((phase) => (
          <div
            key={phase.id}
            className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
          >
            <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              {formatDate(phase.start_date)} – {formatDate(phase.end_date)}
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{phase.display_name}</p>

            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">Primary goal </span>
              {phase.primary_goal}
            </p>
            {phase.secondary_goals.length > 0 && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-white">Secondary goals </span>
                {phase.secondary_goals.join(", ")}
              </p>
            )}
            {phase.key_workout_types.length > 0 && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-white">Key workouts </span>
                {phase.key_workout_types.map(workoutTypeLabel).join(", ")}
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
              {weeks
                ?.filter((week) => week.season_phase_id === phase.id)
                .map((week) => (
                  <div
                    key={week.id}
                    className="rounded-xl bg-black/[0.03] p-3 text-sm dark:bg-white/[0.05]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white">
                        Week {week.week_index + 1}
                      </span>
                      <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                        {week.mileage_level} mileage
                      </span>
                    </div>
                    <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">{week.theme}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {week.workout_slots.map((slot) => `${slot.label}: ${workoutTypeLabel(slot.workoutType)}`).join(" · ")}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
