import type { createClient } from "@/lib/db/server";
import type { WorkoutType } from "@/lib/coaching-engine";
import { computeCheckinPraiseCandidates, type CheckinPraiseCandidate, type CheckinPraiseWorkout } from "@/lib/private-coaching/checkin-praise";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ScheduledRow = {
  id: string;
  scheduled_date: string;
  day_label: string | null;
  title: string | null;
  workout_type: WorkoutType | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_rpe: number | null;
};
type CompletedRow = { scheduled_workout_id: string; actual_distance_m: number | null; actual_duration_s: number | null; rpe: number | null };
type PhaseRow = { start_date: string; end_date: string };

// Same scope cut roster-data.ts's own header comment already documents
// and explains for its "this week" figures: raw planned_distance_m/
// planned_duration_s, not the volume-percent-resolved effective value
// effectiveWorkoutVolume produces elsewhere. A volume-percent day without
// a resolved figure here simply can't clear a fact's bar (no planned
// target to compare against), which just means no candidate for that one
// workout -- never a wrong one.
//
// "Current program/cycle" is the training_phases row covering the
// check-in's own week, if one exists -- the same phase-lookup shape
// roster-data.ts already uses for `currentPhase`. With no matching phase
// (an athlete with no phases yet, or a check-in that predates the
// current one), the cycle search window degrades to the check-in's own
// week alone: milestone facts that need real history then simply find
// none to clear their bar, which is the correct "forced praise is worse
// than none" behavior, not a bug to special-case around.
export async function loadCheckinPraiseCandidates(
  supabase: Supabase,
  athleteId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CheckinPraiseCandidate[]> {
  const { data: phases } = await supabase
    .from("training_phases")
    .select("start_date, end_date")
    .eq("athlete_id", athleteId)
    .lte("start_date", periodStart)
    .gte("end_date", periodStart)
    .limit(1)
    .returns<PhaseRow[]>();
  const cycleStart = phases?.[0]?.start_date ?? periodStart;

  const { data: scheduledRows } = await supabase
    .from("scheduled_workouts")
    .select("id, scheduled_date, day_label, title, workout_type, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_rpe")
    .eq("athlete_id", athleteId)
    .not("published_at", "is", null)
    .gte("scheduled_date", cycleStart)
    .lte("scheduled_date", periodEnd)
    .returns<ScheduledRow[]>();

  const workoutIds = (scheduledRows ?? []).map((w) => w.id);
  const { data: completedRows } = workoutIds.length
    ? await supabase
        .from("completed_workouts")
        .select("scheduled_workout_id, actual_distance_m, actual_duration_s, rpe")
        .in("scheduled_workout_id", workoutIds)
        .returns<CompletedRow[]>()
    : { data: [] as CompletedRow[] };
  const completionByWorkoutId = new Map((completedRows ?? []).map((c) => [c.scheduled_workout_id, c]));

  const cycleWorkouts: CheckinPraiseWorkout[] = (scheduledRows ?? []).map((row) => {
    const completion = completionByWorkoutId.get(row.id) ?? null;
    return {
      id: row.id,
      scheduledDate: row.scheduled_date,
      dayLabel: row.day_label,
      title: row.title,
      workoutType: row.workout_type,
      plannedDistanceM: row.planned_distance_m,
      plannedDistanceMaxM: row.planned_distance_max_m,
      plannedDurationS: row.planned_duration_s,
      plannedDurationMaxS: row.planned_duration_max_s,
      plannedRpe: row.planned_rpe,
      actualDistanceM: completion?.actual_distance_m ?? null,
      actualDurationS: completion?.actual_duration_s ?? null,
      actualRpe: completion?.rpe ?? null,
    };
  });
  const periodWorkouts = cycleWorkouts.filter((w) => w.scheduledDate >= periodStart && w.scheduledDate <= periodEnd);

  return computeCheckinPraiseCandidates({ periodStart, periodEnd, periodWorkouts, cycleWorkouts });
}
