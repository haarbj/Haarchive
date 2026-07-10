import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { addDays } from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { ensureGroupPlan } from "@/app/(app)/(protected)/coach/group-plans-actions";
import { ScheduleBuilder, type WeekRange, type Workout } from "./schedule-builder";

export const metadata: Metadata = {
  title: "Group Schedule",
};

type SeasonPlan = { id: string; name: string };
type Group = { id: string; name: string };
type SeasonPhase = { id: string; phase: string; display_name: string; start_date: string; order_index: number };
type SeasonWeek = { id: string; season_phase_id: string; week_index: number; theme: string };

type PageProps = {
  params: Promise<{ seasonId: string; groupId: string }>;
};

export default async function GroupSchedulePage({ params }: PageProps) {
  const { seasonId, groupId } = await params;
  const session = await getAppSession();
  const supabase = await createClient();

  const [{ data: season }, { data: group }] = await Promise.all([
    supabase.from("season_plans").select("id, name").eq("id", seasonId).maybeSingle<SeasonPlan>(),
    supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle<Group>(),
  ]);
  if (!season || !group) notFound();

  const { groupPlanId, error: ensureError } = await ensureGroupPlan(seasonId, groupId);
  if (!groupPlanId) {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          {ensureError ?? "Couldn't set up this group's schedule."}
        </p>
      </section>
    );
  }

  const [{ data: phases }, { data: weeks }, { data: workouts }, { data: allGroups }] = await Promise.all([
    supabase
      .from("season_phases")
      .select("id, phase, display_name, start_date, order_index")
      .eq("season_plan_id", seasonId)
      .order("order_index", { ascending: true })
      .returns<SeasonPhase[]>(),
    supabase
      .from("season_weeks")
      .select("id, season_phase_id, week_index, theme")
      .eq("season_plan_id", seasonId)
      .order("week_index", { ascending: true })
      .returns<SeasonWeek[]>(),
    supabase
      .from("group_plan_workouts")
      .select("*")
      .eq("group_plan_id", groupPlanId)
      .order("scheduled_date", { ascending: true })
      .returns<Workout[]>(),
    supabase.from("groups").select("id, name").eq("team_id", session!.teamId!).order("name", { ascending: true }).returns<Group[]>(),
  ]);

  // Weeks within a phase are contiguous 7-day blocks starting at the
  // phase's own start_date -- season_weeks itself only carries a global
  // week_index, not a calendar date, so the date range is derived here the
  // same way coalesceMesocycles derives mesocycle date ranges.
  const weeksByPhase = new Map<string, SeasonWeek[]>();
  for (const week of weeks ?? []) {
    const list = weeksByPhase.get(week.season_phase_id) ?? [];
    list.push(week);
    weeksByPhase.set(week.season_phase_id, list);
  }

  const weekRanges: WeekRange[] = [];
  for (const phase of phases ?? []) {
    const phaseWeeks = (weeksByPhase.get(phase.id) ?? []).sort((a, b) => a.week_index - b.week_index);
    phaseWeeks.forEach((week, i) => {
      const startDate = addDays(phase.start_date, i * 7);
      weekRanges.push({
        weekIndex: week.week_index,
        startDate,
        endDate: addDays(startDate, 6),
        theme: week.theme,
        phaseId: phase.id,
        phaseDisplayName: phase.display_name,
      });
    });
  }
  weekRanges.sort((a, b) => a.weekIndex - b.weekIndex);

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 animate-fade-in">
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{group.name}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {season.name} — build this group&rsquo;s week-by-week schedule.
      </p>

      <div className="mt-10">
        <ScheduleBuilder
          seasonId={seasonId}
          groupPlanId={groupPlanId}
          weekRanges={weekRanges}
          workouts={workouts ?? []}
          otherGroups={(allGroups ?? []).filter((g) => g.id !== groupId)}
        />
      </div>
    </section>
  );
}
