import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addDays } from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { ensureGroupPlan } from "@/app/(app)/(protected)/coach/group-plans-actions";
import { BackLink } from "@/components/back-link";
import type { GroupDayEntries } from "./all-groups-day-view";
import type { WeekRange, Workout } from "./schedule-builder";
import { ViewToggle } from "./view-toggle";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

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
      <Container variant="dashboard">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          {ensureError ?? "Couldn't set up this group's schedule."}
        </p>
      </Container>
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
    supabase.from("groups").select("id, name").eq("team_id", session!.coachTeamId!).order("name", { ascending: true }).returns<Group[]>(),
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

  // Cross-group day view: every group's own group_plans row for this
  // season (if they have one yet) and their workouts, re-shaped into
  // date -> group -> entries for the read-only "everyone, by day" toggle.
  const otherGroups = (allGroups ?? []).filter((g) => g.id !== groupId);
  const { data: allGroupPlans } = await supabase
    .from("group_plans")
    .select("id, group_id")
    .eq("season_plan_id", seasonId)
    .returns<{ id: string; group_id: string }[]>();

  const groupPlanIds = (allGroupPlans ?? []).map((gp) => gp.id);
  const { data: allWorkouts } = groupPlanIds.length
    ? await supabase
        .from("group_plan_workouts")
        .select("*")
        .in("group_plan_id", groupPlanIds)
        .order("scheduled_date", { ascending: true })
        .returns<Workout[]>()
    : { data: [] as Workout[] };

  const groupIdByPlanId = new Map((allGroupPlans ?? []).map((gp) => [gp.id, gp.group_id]));
  const groupPlanIdByGroupId = Object.fromEntries((allGroupPlans ?? []).map((gp) => [gp.group_id, gp.id]));
  const groupNameById = new Map((allGroups ?? []).map((g) => [g.id, g.name]));
  const workoutsByGroupThenDate = new Map<string, Map<string, Workout[]>>();
  const dateSet = new Set<string>();
  for (const w of allWorkouts ?? []) {
    const gid = groupIdByPlanId.get(w.group_plan_id);
    if (!gid) continue;
    dateSet.add(w.scheduled_date);
    if (!workoutsByGroupThenDate.has(gid)) workoutsByGroupThenDate.set(gid, new Map());
    const byDate = workoutsByGroupThenDate.get(gid)!;
    const list = byDate.get(w.scheduled_date) ?? [];
    list.push(w);
    byDate.set(w.scheduled_date, list);
  }
  const allGroupsDayData = {
    dates: Array.from(dateSet).sort(),
    groups: (allGroups ?? []).map((g): GroupDayEntries => ({
      groupId: g.id,
      groupName: groupNameById.get(g.id) ?? g.name,
      workoutsByDate: Object.fromEntries(workoutsByGroupThenDate.get(g.id) ?? new Map()),
    })),
  };

  return (
    <Container variant="dashboard">
      <BackLink href={`/coach/seasons/${seasonId}`} label={season.name} />
      <Heading className="mt-4">{group.name}</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {season.name} — build this group&rsquo;s week-by-week schedule.
      </p>

      {allGroups && allGroups.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {allGroups.map((g) => (
            <Link
              key={g.id}
              href={`/coach/seasons/${seasonId}/groups/${g.id}`}
              aria-current={g.id === groupId ? "page" : undefined}
              className={`inline-flex min-h-12 items-center rounded-full px-4 text-sm font-semibold transition ${
                g.id === groupId
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "border border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
              }`}
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10">
        <ViewToggle
          seasonId={seasonId}
          groupPlanId={groupPlanId}
          currentGroupId={groupId}
          weekRanges={weekRanges}
          workouts={workouts ?? []}
          otherGroups={otherGroups}
          allGroupsDayData={allGroupsDayData}
          groupPlanIdByGroupId={groupPlanIdByGroupId}
        />
      </div>
    </Container>
  );
}
