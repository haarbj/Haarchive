import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { formatClock, formatDate } from "@/lib/format";
import { CompletionSummary, type CompletionDetail } from "@/app/(app)/(protected)/plan/completion-detail";

export const metadata: Metadata = {
  title: "Race results",
};

type ResultsPageProps = {
  params: Promise<{ seasonId: string }>;
};

type RaceResultRow = {
  groupName: string;
  athleteName: string;
  raceDescription: string;
  raceDate: string;
  completion: CompletionDetail;
  goal: { raceName: string; goalTimeS: number | null } | null;
};

// A goal's race isn't necessarily the same race as a given logged result --
// deliberately no automatic matching by distance/date (which could guess
// wrong); the athlete's current goal is just always shown alongside so the
// coach can judge relevance themselves.
function GapNote({ actualTimeS, goalTimeS }: { actualTimeS: number; goalTimeS: number }) {
  const deltaS = actualTimeS - goalTimeS;
  if (deltaS === 0) return <span className="font-medium text-emerald-700 dark:text-emerald-400">right on goal</span>;
  const ahead = deltaS < 0;
  return (
    <span className={ahead ? "font-medium text-emerald-700 dark:text-emerald-400" : "font-medium text-amber-700 dark:text-amber-400"}>
      {ahead ? "-" : "+"}
      {formatClock(Math.abs(deltaS))} {ahead ? "faster than goal" : "slower than goal"}
    </span>
  );
}

export default async function SeasonResultsPage({ params }: ResultsPageProps) {
  const { seasonId } = await params;
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("season_plans")
    .select("id, name")
    .eq("id", seasonId)
    .maybeSingle<{ id: string; name: string }>();
  if (!season) notFound();

  const { data: groupPlans } = await supabase
    .from("group_plans")
    .select("id, group_id")
    .eq("season_plan_id", seasonId)
    .returns<{ id: string; group_id: string }[]>();

  if (!groupPlans || groupPlans.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Race results</h1>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">No group schedules for {season.name} yet.</p>
      </section>
    );
  }

  const groupPlanIds = groupPlans.map((gp) => gp.id);
  const groupIds = [...new Set(groupPlans.map((gp) => gp.group_id))];
  const groupIdByPlanId = new Map(groupPlans.map((gp) => [gp.id, gp.group_id]));

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .in("id", groupIds)
    .returns<{ id: string; name: string }[]>();
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const { data: raceWorkouts } = await supabase
    .from("group_plan_workouts")
    .select("id, group_plan_id, scheduled_date, description")
    .in("group_plan_id", groupPlanIds)
    .eq("is_race", true)
    .returns<{ id: string; group_plan_id: string; scheduled_date: string; description: string }[]>();

  const rows: RaceResultRow[] = [];

  if (raceWorkouts && raceWorkouts.length > 0) {
    const raceWorkoutIds = raceWorkouts.map((w) => w.id);
    const raceWorkoutById = new Map(raceWorkouts.map((w) => [w.id, w]));

    const { data: completions } = await supabase
      .from("workout_completions")
      .select("group_plan_workout_id, user_id, actual_distance_m, actual_time_s, rpe, avg_hr, notes")
      .in("group_plan_workout_id", raceWorkoutIds)
      .returns<(CompletionDetail & { group_plan_workout_id: string; user_id: string })[]>();

    if (completions && completions.length > 0) {
      const athleteIds = [...new Set(completions.map((c) => c.user_id))];

      const [{ data: profiles }, { data: goals }] = await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<{ id: string; display_name: string }[]>(),
        supabase
          .from("goals")
          .select("user_id, race_name, goal_time_s")
          .in("user_id", athleteIds)
          .eq("status", "active")
          .returns<{ user_id: string; race_name: string; goal_time_s: number | null }[]>(),
      ]);
      const nameByAthleteId = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      const goalByAthleteId = new Map((goals ?? []).map((g) => [g.user_id, { raceName: g.race_name, goalTimeS: g.goal_time_s }]));

      for (const completion of completions) {
        const workout = raceWorkoutById.get(completion.group_plan_workout_id);
        if (!workout) continue;
        const groupId = groupIdByPlanId.get(workout.group_plan_id);
        rows.push({
          groupName: (groupId && groupNameById.get(groupId)) ?? "Unknown group",
          athleteName: nameByAthleteId.get(completion.user_id) ?? "Unknown athlete",
          raceDescription: workout.description,
          raceDate: workout.scheduled_date,
          completion,
          goal: goalByAthleteId.get(completion.user_id) ?? null,
        });
      }
    }
  }

  rows.sort((a, b) => (a.groupName === b.groupName ? b.raceDate.localeCompare(a.raceDate) : a.groupName.localeCompare(b.groupName)));

  const rowsByGroup = new Map<string, RaceResultRow[]>();
  for (const row of rows) {
    const list = rowsByGroup.get(row.groupName) ?? [];
    list.push(row);
    rowsByGroup.set(row.groupName, list);
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Race results</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Logged results for {season.name}, against each athlete&rsquo;s own goal.
      </p>

      {rowsByGroup.size === 0 ? (
        <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-300">No race results logged yet.</p>
      ) : (
        <div className="mt-10 space-y-8">
          {[...rowsByGroup.entries()].map(([groupName, groupRows]) => (
            <div key={groupName}>
              <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">{groupName}</p>
              <div className="mt-3 space-y-3">
                {groupRows.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
                  >
                    <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                      {formatDate(row.raceDate)} · {row.raceDescription}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{row.athleteName}</p>
                    <CompletionSummary completion={row.completion} />
                    {row.goal && (
                      <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        Goal: {row.goal.raceName}
                        {row.goal.goalTimeS ? `, ${formatClock(row.goal.goalTimeS)}` : ""}
                        {row.goal.goalTimeS && row.completion.actual_time_s && (
                          <>
                            {" "}
                            (<GapNote actualTimeS={row.completion.actual_time_s} goalTimeS={row.goal.goalTimeS} />)
                          </>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
