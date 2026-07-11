import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { getAppSession } from "@/lib/auth/session";
import { BackLink } from "@/components/back-link";
import { PhaseEditor, type SeasonPhaseRow } from "./phase-editor";
import { WeekEditor, type SeasonWeekRow } from "./week-editor";

export const metadata: Metadata = {
  title: "Season",
};

type SeasonPlan = {
  id: string;
  name: string;
  goal_race_name: string;
  goal_race_date: string;
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

  const session = await getAppSession();

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("team_id", session!.teamId!)
    .order("name", { ascending: true })
    .returns<{ id: string; name: string }[]>();

  const [{ data: phases }, { data: weeks }] = await Promise.all([
    supabase
      .from("season_phases")
      .select("id, phase, display_name, order_index, start_date, end_date, primary_goal, secondary_goals, key_workout_types")
      .eq("season_plan_id", seasonId)
      .order("order_index", { ascending: true })
      .returns<SeasonPhaseRow[]>(),
    supabase
      .from("season_weeks")
      .select("id, season_phase_id, week_index, theme, mileage_level, workout_slots")
      .eq("season_plan_id", seasonId)
      .order("week_index", { ascending: true })
      .returns<(SeasonWeekRow & { season_phase_id: string })[]>(),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
      <BackLink href="/coach" label="Coach" />
      <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{season.name}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Building toward {season.goal_race_name} on {formatDate(season.goal_race_date)}.
      </p>

      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Group schedules</p>
          <Link
            href={`/coach/seasons/${seasonId}/results`}
            className="text-xs font-semibold text-zinc-600 underline decoration-black/10 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/10 dark:hover:decoration-white"
          >
            Race results
          </Link>
        </div>
        {groups && groups.length > 0 ? (
          <div className="mt-3 space-y-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/coach/seasons/${seasonId}/groups/${group.id}`}
                className="block rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:border-black/20 dark:border-white/10 dark:text-white dark:hover:border-white/20"
              >
                {group.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            No groups yet — <Link href="/coach/groups" className="underline">create one</Link> to start building a
            schedule.
          </p>
        )}
      </div>

      <div className="mt-8 space-y-8">
        {phases?.map((phase, i) => (
          <PhaseEditor
            key={phase.id}
            phase={phase}
            seasonId={seasonId}
            isFirst={i === 0}
            isLast={i === phases.length - 1}
          >
            <div className="mt-4 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
              {weeks
                ?.filter((week) => week.season_phase_id === phase.id)
                .map((week) => (
                  <WeekEditor key={week.id} week={week} seasonId={seasonId} />
                ))}
            </div>
          </PhaseEditor>
        ))}
      </div>
    </section>
  );
}
