"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { weekDates, addDays } from "@/lib/week";
import { todayForViewer } from "@/lib/viewer-timezone";
import type { MesocyclePhase, WorkoutType } from "@/lib/coaching-engine";
import { getActiveCoachRelationship } from "@/lib/private-coaching/athlete-coach";
import { fetchCalendarWorkouts } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-data";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";
import type { TimelineWeekBlock } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-helpers";
import type { CompletionDetail } from "./completion-detail";

export type SelfWorkoutRow = {
  id: string;
  scheduled_date: string;
  workout_type: WorkoutType;
  prescription: unknown;
  adapted_at: string | null;
  adaptation_reason: string | null;
  adaptation_explanation: string | null;
};

/**
 * One union, two real sources -- the exact same data the current Week
 * view already renders (self-serve `workouts`, coach-assigned
 * `scheduled_workouts` via fetchCalendarWorkouts, see plan-view.tsx's own
 * comment on why both must appear here). plan-timeline-view.tsx's
 * normalizeEntry is the only place that branches on `source`.
 */
export type AthleteTimelineEntry =
  | { source: "self"; workout: SelfWorkoutRow; completion: CompletionDetail | null; phase: MesocyclePhase | null }
  | { source: "assigned"; workout: CalendarWorkout };

// Timeline View's own data loader for the athlete's /plan -- called from
// the client as the athlete scrolls past the server-rendered initial
// window, or jumps via the date picker. Mirrors the coach route's own
// timeline-actions.ts (loadTimelineWeeks) exactly in shape and purpose,
// just reading the athlete's own two tables instead of one coach-scoped
// table. No assignment/completion logic lives here -- self-serve
// workouts/completions and fetchCalendarWorkouts are read exactly as
// plan-view.tsx's own Week-view query already reads them, just across a
// wider date range and re-bucketed by week.
export async function loadAthleteTimelineWeeks(weekStarts: string[]): Promise<TimelineWeekBlock<AthleteTimelineEntry>[]> {
  const session = await getAppSession();
  if (!session) return [];
  if (weekStarts.length === 0) return [];

  const supabase = await createClient();
  const today = await todayForViewer();
  const sortedStarts = [...weekStarts].sort();
  const rangeStart = sortedStarts[0];
  const rangeEnd = addDays(sortedStarts[sortedStarts.length - 1], 6);

  const emptyWeeks = (): TimelineWeekBlock<AthleteTimelineEntry>[] =>
    weekStarts.map((weekStart) => ({ weekStart, itemsByDate: Object.fromEntries(weekDates(weekStart).map((d) => [d, []])) }));

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", session.userId)
    .in("status", ["draft", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const [selfEntries, assignedByDate] = await Promise.all([
    loadSelfWorkoutEntries(supabase, plan?.id ?? null, rangeStart, rangeEnd),
    loadAssignedWorkoutsByDate(supabase, session.userId, weekStarts, today),
  ]);

  if (selfEntries === null && Object.keys(assignedByDate).length === 0) return emptyWeeks();

  const entriesByDate: Record<string, AthleteTimelineEntry[]> = {};
  for (const entry of selfEntries ?? []) {
    const date = entry.workout.scheduled_date;
    (entriesByDate[date] ??= []).push(entry);
  }
  for (const [date, workouts] of Object.entries(assignedByDate)) {
    for (const workout of workouts) {
      (entriesByDate[date] ??= []).push({ source: "assigned", workout });
    }
  }

  return weekStarts.map((weekStart) => ({
    weekStart,
    itemsByDate: Object.fromEntries(weekDates(weekStart).map((d) => [d, entriesByDate[d] ?? []])),
  }));
}

type MesocycleRow = { id: string; phase: MesocyclePhase; start_date: string; end_date: string };

async function loadSelfWorkoutEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string | null,
  rangeStart: string,
  rangeEnd: string,
): Promise<Extract<AthleteTimelineEntry, { source: "self" }>[] | null> {
  if (!planId) return null;

  const { data: mesocycles } = await supabase
    .from("mesocycles")
    .select("id, phase, start_date, end_date")
    .eq("training_plan_id", planId)
    .returns<MesocycleRow[]>();
  // Only the mesocycles that actually overlap the requested range -- the
  // same "exactly what's shown, never the athlete's whole history" rule
  // the coach route's own PhaseViewSection follows for its own bounded
  // range queries.
  const overlapping = (mesocycles ?? []).filter((m) => m.start_date <= rangeEnd && m.end_date >= rangeStart);
  if (overlapping.length === 0) return [];
  const mesocycleIds = overlapping.map((m) => m.id);
  const phaseByMesocycleId = new Map(overlapping.map((m) => [m.id, m.phase]));

  const { data: workoutRows } = await supabase
    .from("workouts")
    .select("id, mesocycle_id, scheduled_date, workout_type, prescription, adapted_at, adaptation_reason, adaptation_explanation")
    .in("mesocycle_id", mesocycleIds)
    .gte("scheduled_date", rangeStart)
    .lte("scheduled_date", rangeEnd)
    .order("scheduled_date", { ascending: true })
    .returns<(SelfWorkoutRow & { mesocycle_id: string })[]>();

  const workoutIds = (workoutRows ?? []).map((w) => w.id);
  const { data: completions } = await supabase
    .from("workout_completions")
    .select("workout_id, actual_distance_m, actual_time_s, rpe, avg_hr, notes, strava_activity_id")
    .in("workout_id", workoutIds.length > 0 ? workoutIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<(CompletionDetail & { workout_id: string })[]>();
  const completionByWorkoutId = new Map((completions ?? []).map((c) => [c.workout_id, c]));

  return (workoutRows ?? []).map((row) => ({
    source: "self",
    workout: row,
    completion: completionByWorkoutId.get(row.id) ?? null,
    phase: phaseByMesocycleId.get(row.mesocycle_id) ?? null,
  }));
}

async function loadAssignedWorkoutsByDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  weekStarts: string[],
  today: string,
): Promise<Record<string, CalendarWorkout[]>> {
  const relationship = await getActiveCoachRelationship(supabase, athleteId);
  if (!relationship) return {};
  const allDates = weekStarts.flatMap((weekStart) => weekDates(weekStart));
  const byDate = await fetchCalendarWorkouts(supabase, athleteId, relationship.coachId, allDates, today);
  // A coach's unpublished draft must stay invisible to the athlete, same
  // rule plan-view.tsx's own publishedAssignedWorkoutsThisWeek enforces
  // (via computeWorkoutStatus's "draft" status) for the Week view.
  const published: Record<string, CalendarWorkout[]> = {};
  for (const [date, workouts] of Object.entries(byDate)) {
    published[date] = workouts.filter((w) => w.status !== "draft");
  }
  return published;
}
