import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { getAppSession } from "@/lib/auth/session";
import { PhaseEditor, type SeasonPhaseRow } from "./phase-editor";
import { RosterGeneratePanel } from "./roster-generate-panel";
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

type Membership = { user_id: string };
type Profile = { id: string; display_name: string };

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
  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("user_id")
    .eq("team_id", session!.teamId!)
    .eq("role", "athlete")
    .returns<Membership[]>();
  const athleteIds = memberships?.map((m) => m.user_id) ?? [];
  const { data: rosterProfiles } = athleteIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<Profile[]>()
    : { data: [] as Profile[] };
  const athletes = (rosterProfiles ?? []).map((p) => ({ id: p.id, display_name: p.display_name }));

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
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{season.name}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Building toward {season.goal_race_name} on {formatDate(season.goal_race_date)}.
      </p>

      <div className="mt-10">
        <RosterGeneratePanel seasonId={seasonId} athletes={athletes} />
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
