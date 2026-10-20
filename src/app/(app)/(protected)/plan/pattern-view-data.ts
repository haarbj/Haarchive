import type { createClient } from "@/lib/db/server";
import type { WorkoutType } from "@/lib/coaching-engine";
import { patternViewWeekStarts, computePatternView, type PatternSeries, type PatternViewWorkout, type PatternViewCheckin } from "@/lib/private-coaching/pattern-view";
import { addDays } from "@/lib/week";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ScheduledRow = {
  id: string;
  scheduled_date: string;
  day_label: string | null;
  workout_type: WorkoutType | null;
  planned_distance_m: number | null;
  planned_duration_s: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  is_optional: boolean;
};
type CompletedRow = { scheduled_workout_id: string; actual_distance_m: number | null; actual_duration_s: number | null; rpe: number | null };
type CheckinRow = { week_start: string; overall_feel: number | null; fatigue: number; soreness: number; sleep_quality: number; stress: number };
type EarliestPublishedRow = { scheduled_date: string };

// The one canonical loader behind the Pattern view on both surfaces --
// the coach's athlete-detail page imports this directly rather than
// re-deriving it, so "what the coach sees is what the athlete sees" is
// true by construction (same precedent as plan-payoff/data.ts's
// loadPlanPayoffData). `athleteId` is the athlete being viewed either
// way; `today` is the VIEWER's own "today" (todayForViewer()), per the
// task's own instruction that the window is computed in the viewer's
// timezone, not a stored athlete timezone.
//
// Read-only: no new table, no migration. The only query beyond the
// window itself is a single "earliest ever published workout" lookup
// (LIMIT 1), used only to tell a genuine pre-program gap week apart from
// a programmed week that happened to have nothing scheduled.
export async function loadPatternViewData(supabase: Supabase, athleteId: string, today: string): Promise<PatternSeries> {
  const weekStarts = patternViewWeekStarts(today);
  const windowStart = weekStarts[0];
  const windowEnd = addDays(weekStarts[weekStarts.length - 1], 6);

  const [{ data: earliestPublished }, { data: scheduledRows }, { data: checkinRows }] = await Promise.all([
    supabase
      .from("scheduled_workouts")
      .select("scheduled_date")
      .eq("athlete_id", athleteId)
      .not("published_at", "is", null)
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .returns<EarliestPublishedRow[]>(),
    supabase
      .from("scheduled_workouts")
      .select("id, scheduled_date, day_label, workout_type, planned_distance_m, planned_duration_s, planned_rpe, planned_rpe_max, is_optional")
      .eq("athlete_id", athleteId)
      .not("published_at", "is", null)
      .gte("scheduled_date", windowStart)
      .lte("scheduled_date", windowEnd)
      .returns<ScheduledRow[]>(),
    supabase
      .from("weekly_checkins")
      .select("week_start, overall_feel, fatigue, soreness, sleep_quality, stress")
      .eq("user_id", athleteId)
      .in("week_start", weekStarts)
      .returns<CheckinRow[]>(),
  ]);

  const workoutIds = (scheduledRows ?? []).map((w) => w.id);
  const { data: completedRows } = workoutIds.length
    ? await supabase
        .from("completed_workouts")
        .select("scheduled_workout_id, actual_distance_m, actual_duration_s, rpe")
        .in("scheduled_workout_id", workoutIds)
        .returns<CompletedRow[]>()
    : { data: [] as CompletedRow[] };
  const completionByWorkoutId = new Map((completedRows ?? []).map((c) => [c.scheduled_workout_id, c]));

  const workouts: PatternViewWorkout[] = (scheduledRows ?? []).map((row) => {
    const completion = completionByWorkoutId.get(row.id) ?? null;
    return {
      id: row.id,
      scheduledDate: row.scheduled_date,
      dayLabel: row.day_label,
      workoutType: row.workout_type,
      plannedDistanceM: row.planned_distance_m,
      plannedDurationS: row.planned_duration_s,
      plannedRpe: row.planned_rpe,
      plannedRpeMax: row.planned_rpe_max,
      isOptional: row.is_optional,
      actualDistanceM: completion?.actual_distance_m ?? null,
      actualDurationS: completion?.actual_duration_s ?? null,
      actualRpe: completion?.rpe ?? null,
    };
  });

  const checkins: PatternViewCheckin[] = (checkinRows ?? []).map((row) => ({
    weekStart: row.week_start,
    overallFeel: row.overall_feel,
    fatigue: row.fatigue,
    soreness: row.soreness,
    sleepQuality: row.sleep_quality,
    stress: row.stress,
  }));

  return computePatternView({
    today,
    programStartDate: earliestPublished?.[0]?.scheduled_date ?? null,
    workouts,
    checkins,
  });
}
