import { createClient } from "@/lib/db/server";
import { addDays } from "@/lib/coaching-engine";
import { mostRecentMonday } from "@/lib/week";
import { computeAttentionFlags, isHighRpe, type AttentionFlag } from "@/lib/private-coaching/attention";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";

export type AthleteAttention = {
  athleteId: string;
  coachAthleteId: string;
  displayName: string;
  flags: AttentionFlag[];
};

export type UpcomingRace = { athleteName: string; raceName: string; goalDate: string };
export type RecentCompletion = { athleteName: string; workoutTitle: string; completedAt: string; rpe: number | null };

export type CoachHomeData = {
  athletesNeedingAttention: AthleteAttention[];
  athletesOnTrack: AthleteAttention[];
  upcomingRaces: UpcomingRace[];
  recentCompletions: RecentCompletion[];
};

const LOOKBACK_DAYS = 14;

// Every query here is batched across the coach's whole roster (.in(...)),
// not one query per athlete -- the same discipline admin/users/page.tsx's
// loadUsers() already uses for its own per-user counts, just applied to a
// smaller roster. This is the one place all the individually-boring
// signals (missed workouts, pain, RPE, unread messages, missing check-ins)
// get turned into "who actually needs a look today" -- see
// computeAttentionFlags for the actual triage rule.
export async function loadCoachHomeData(coachId: string): Promise<CoachHomeData> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const lookbackDate = addDays(today, -LOOKBACK_DAYS);
  const currentWeekStart = mostRecentMonday(new Date());

  const { data: relationships } = await supabase
    .from("coach_athletes")
    .select("id, athlete_id, started_at")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .returns<{ id: string; athlete_id: string; started_at: string }[]>();

  if (!relationships || relationships.length === 0) {
    return { athletesNeedingAttention: [], athletesOnTrack: [], upcomingRaces: [], recentCompletions: [] };
  }

  const athleteIds = relationships.map((r) => r.athlete_id);

  const [
    { data: profiles },
    { data: missedWorkouts },
    { data: recentCompletionsRaw },
    { data: unreadMessages },
    { data: currentWeekCheckins },
    { data: goalRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<{ id: string; display_name: string }[]>(),
    // This filter's three conditions are the SQL-level equivalent of
    // computeWorkoutStatus's "missed" branch (src/lib/private-coaching/
    // workout-status.ts) -- kept as a query filter rather than a fetch-all-
    // then-compute-in-JS call to that function, since this is a roster-wide
    // count, not a per-workout render. If that function's boundary
    // condition ever changes, this filter needs to change with it.
    supabase
      .from("scheduled_workouts")
      .select("athlete_id")
      .in("athlete_id", athleteIds)
      .eq("status", "scheduled")
      .not("published_at", "is", null)
      .lt("scheduled_date", today)
      .returns<{ athlete_id: string }[]>(),
    supabase
      .from("completed_workouts")
      .select("athlete_id, scheduled_workout_id, completed_at, rpe, pain_reported")
      .in("athlete_id", athleteIds)
      .gte("completed_at", `${lookbackDate}T00:00:00Z`)
      .order("completed_at", { ascending: false })
      .returns<{ athlete_id: string; scheduled_workout_id: string; completed_at: string; rpe: number | null; pain_reported: boolean }[]>(),
    supabase
      .from("coach_athlete_messages")
      .select("coach_athlete_id")
      .in(
        "coach_athlete_id",
        relationships.map((r) => r.id),
      )
      .neq("sender_id", coachId)
      .is("read_at", null)
      .returns<{ coach_athlete_id: string }[]>(),
    supabase
      .from("weekly_checkins")
      .select("user_id")
      .in("user_id", athleteIds)
      .eq("week_start", currentWeekStart)
      .returns<{ user_id: string }[]>(),
    supabase
      .from("goals")
      .select("user_id, race_name, goal_date")
      .in("user_id", athleteIds)
      .eq("status", "active")
      .not("goal_date", "is", null)
      .gte("goal_date", today)
      .lte("goal_date", addDays(today, 14))
      .order("goal_date", { ascending: true })
      .returns<{ user_id: string; race_name: string; goal_date: string }[]>(),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const countBy = (rows: { athlete_id: string }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) counts.set(row.athlete_id, (counts.get(row.athlete_id) ?? 0) + 1);
    return counts;
  };
  const missedByAthlete = countBy(missedWorkouts);
  const painByAthlete = countBy((recentCompletionsRaw ?? []).filter((c) => c.pain_reported));
  const highRpeByAthlete = countBy((recentCompletionsRaw ?? []).filter((c) => isHighRpe(c.rpe)));
  const checkinAthleteIds = new Set((currentWeekCheckins ?? []).map((c) => c.user_id));

  const unreadByRelationship = new Map<string, number>();
  for (const row of unreadMessages ?? []) {
    unreadByRelationship.set(row.coach_athlete_id, (unreadByRelationship.get(row.coach_athlete_id) ?? 0) + 1);
  }

  const now = new Date();
  const athletes: AthleteAttention[] = relationships.map((rel) => {
    const daysSince = Math.floor((now.getTime() - new Date(rel.started_at).getTime()) / (24 * 60 * 60 * 1000));
    const flags = computeAttentionFlags({
      missedWorkoutCount: missedByAthlete.get(rel.athlete_id) ?? 0,
      recentPainReportCount: painByAthlete.get(rel.athlete_id) ?? 0,
      highRpeCount: highRpeByAthlete.get(rel.athlete_id) ?? 0,
      unreadMessageCount: unreadByRelationship.get(rel.id) ?? 0,
      hasCurrentWeekCheckin: checkinAthleteIds.has(rel.athlete_id),
      daysSinceRelationshipStarted: daysSince,
    });
    return {
      athleteId: rel.athlete_id,
      coachAthleteId: rel.id,
      displayName: nameById.get(rel.athlete_id) ?? "Athlete",
      flags,
    };
  });

  const athletesNeedingAttention = athletes.filter((a) => a.flags.length > 0);
  const athletesOnTrack = athletes.filter((a) => a.flags.length === 0);

  const upcomingRaces: UpcomingRace[] = (goalRows ?? []).map((g) => ({
    athleteName: nameById.get(g.user_id) ?? "Athlete",
    raceName: g.race_name,
    goalDate: g.goal_date,
  }));

  const recentCompletions: RecentCompletion[] = (recentCompletionsRaw ?? []).slice(0, 8).map((c) => ({
    athleteName: nameById.get(c.athlete_id) ?? "Athlete",
    workoutTitle: "", // filled in below once we have titles
    completedAt: c.completed_at,
    rpe: c.rpe,
  }));

  // A second, small lookup for just the titles of the completions shown --
  // deliberately not selected in the same query as the counting pass
  // above, since that one intentionally over-fetches (LOOKBACK_DAYS worth,
  // for counting) while this only needs the 8 actually displayed.
  const workoutIds = (recentCompletionsRaw ?? []).slice(0, 8).map((c) => c.scheduled_workout_id);
  if (workoutIds.length > 0) {
    const { data: workoutTitles } = await supabase
      .from("scheduled_workouts")
      .select("id, title, day_label")
      .in("id", workoutIds)
      .returns<{ id: string; title: string | null; day_label: string | null }[]>();
    const titleById = new Map((workoutTitles ?? []).map((w) => [w.id, getWorkoutDisplayLabel(w.day_label, w.title)]));
    recentCompletions.forEach((c, i) => {
      c.workoutTitle = titleById.get((recentCompletionsRaw ?? [])[i]?.scheduled_workout_id ?? "") ?? "Workout";
    });
  }

  return { athletesNeedingAttention, athletesOnTrack, upcomingRaces, recentCompletions };
}
