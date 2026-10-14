import { mostRecentMonday, daysBetween } from "@/lib/week";
import type { createClient } from "@/lib/db/server";

// Athlete's own upcoming/target race -- reused, not duplicated. `goals`
// already exists (self-serve product's own table: race_name, distance_m,
// goal_time_s, goal_date, status, priority), is already private-coach
// readable via goals_select_private_coach RLS, and is the correct
// existing source of truth for "goal race" -- there is deliberately no
// second, private-coaching-specific goal-race table or column.
export type AthleteGoalRace = {
  id: string;
  raceName: string;
  goalDate: string; // ISO date
};

type GoalRow = { id: string; race_name: string; goal_date: string | null; status: string };

// Picks the athlete's single most temporally relevant active goal -- the
// one whose date is closest to today, whether that's still upcoming or
// was recently passed without being marked achieved/abandoned yet. An
// athlete training toward one goal at a time (the common case) has
// exactly one active goal and this is a no-op; the "closest to today"
// rule only matters for the rarer case of more than one.
export async function getAthleteGoalRace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<AthleteGoalRace | null> {
  const { data } = await supabase
    .from("goals")
    .select("id, race_name, goal_date, status")
    .eq("user_id", athleteId)
    .eq("status", "active")
    .returns<GoalRow[]>();

  const candidates = (data ?? []).filter((g): g is GoalRow & { goal_date: string } => g.goal_date != null);
  if (candidates.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  let closest = candidates[0];
  let closestDiff = Math.abs(daysBetween(today, closest.goal_date));
  for (const g of candidates.slice(1)) {
    const diff = Math.abs(daysBetween(today, g.goal_date));
    if (diff < closestDiff) {
      closest = g;
      closestDiff = diff;
    }
  }
  return { id: closest.id, raceName: closest.race_name, goalDate: closest.goal_date };
}

export type WeeksUntilGoalRace =
  | { kind: "none" }
  | { kind: "past"; weeksSince: number }
  | { kind: "race-week" }
  | { kind: "upcoming"; weeks: number };

// Deterministic by construction: normalizes the race date to its OWN
// week's Monday, then diffs whole weeks against the selected week's
// Monday -- so "race during the selected week" is always exactly
// race-week regardless of which weekday the race itself falls on (a
// Sunday race and a Monday race in the same calendar week both resolve
// identically), never a fractional/rounded day count.
export function weeksUntilGoalRace(weekStart: string, goalRaceDate: string | null): WeeksUntilGoalRace {
  if (!goalRaceDate) return { kind: "none" };
  const raceWeekStart = mostRecentMonday(new Date(`${goalRaceDate}T00:00:00Z`));
  const weeks = daysBetween(weekStart, raceWeekStart) / 7;
  if (weeks > 0) return { kind: "upcoming", weeks };
  if (weeks === 0) return { kind: "race-week" };
  return { kind: "past", weeksSince: -weeks };
}

// The one place the exact contextual phrasing lives -- reused by Week/Day/
// Phase views instead of each view inventing its own wording. `oneLine`
// controls the Week/Day-header sentence vs. Phase View's own two-line
// treatment (which calls weeksUntilGoalRace itself and lays the same
// result out differently, rather than parsing this string back apart).
export function formatGoalRaceContext(result: WeeksUntilGoalRace, raceName: string | null): string {
  switch (result.kind) {
    case "none":
      return "No goal race set";
    case "race-week":
      return "This is race week";
    case "past":
      return `${result.weeksSince} week${result.weeksSince === 1 ? "" : "s"} since ${raceName ?? "goal race"}`;
    case "upcoming":
      return `${result.weeks} week${result.weeks === 1 ? "" : "s"} to ${raceName ?? "goal race"}`;
  }
}

// The same magnitude, without the race name -- Phase View already shows
// the race name as its own line, so it only needs "14 weeks away" /
// "1 week ago" / "This is race week" alongside it, not the full sentence.
export function formatWeeksAwayLabel(result: WeeksUntilGoalRace): string {
  switch (result.kind) {
    case "none":
      return "";
    case "race-week":
      return "This is race week";
    case "past":
      return `${result.weeksSince} week${result.weeksSince === 1 ? "" : "s"} ago`;
    case "upcoming":
      return `${result.weeks} week${result.weeks === 1 ? "" : "s"} away`;
  }
}
