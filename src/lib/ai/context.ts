import type { SupabaseClient } from "@supabase/supabase-js";

import type { MesocyclePhase, WorkoutPrescription, WorkoutType } from "@/lib/coaching-engine";

// Per-conversation context is deliberately curated, not "send everything":
// the athlete's current goal and mesocycle phase, the last several workout
// completions, the most recent check-in, and nothing else -- keeps token
// cost down, limits what leaves the database in any single call, and keeps
// answers traceable to a specific, small set of facts instead of a diffuse
// "the whole athlete history."
const RECENT_COMPLETIONS_LIMIT = 5;

export type GoalSummary = {
  raceName: string;
  distanceM: number;
  goalTimeS: number | null;
  goalDate: string | null;
};

export type WorkoutContext = {
  workoutType: WorkoutType;
  prescription: WorkoutPrescription;
  scheduledDate: string;
  phase: MesocyclePhase | null;
  focusNotes: string | null;
};

export type CompletionSummary = {
  scheduledDate: string;
  workoutType: WorkoutType;
  actualDistanceM: number | null;
  actualTimeS: number | null;
  rpe: number | null;
};

export type CheckinSummary = {
  weekStart: string;
  fatigue: number;
  soreness: number;
  sleepQuality: number;
  stress: number;
};

export type CoachingContext = {
  goal: GoalSummary | null;
  workout: WorkoutContext | null;
  recentCompletions: CompletionSummary[];
  recentCheckin: CheckinSummary | null;
};

export async function assembleCoachingContext(
  supabase: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<CoachingContext> {
  const [{ data: workoutRow }, { data: goalRow }, { data: completionRows }, { data: checkinRow }] =
    await Promise.all([
      supabase
        .from("workouts")
        .select("workout_type, prescription, scheduled_date, mesocycle_id")
        .eq("id", workoutId)
        .maybeSingle(),
      supabase
        .from("goals")
        .select("race_name, distance_m, goal_time_s, goal_date")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workout_completions")
        .select("workout_id, actual_distance_m, actual_time_s, rpe")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(RECENT_COMPLETIONS_LIMIT),
      supabase
        .from("weekly_checkins")
        .select("week_start, fatigue, soreness, sleep_quality, stress")
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  let workout: WorkoutContext | null = null;
  if (workoutRow) {
    const { data: mesocycleRow } = await supabase
      .from("mesocycles")
      .select("phase, focus_notes")
      .eq("id", workoutRow.mesocycle_id)
      .maybeSingle();
    workout = {
      workoutType: workoutRow.workout_type,
      prescription: workoutRow.prescription,
      scheduledDate: workoutRow.scheduled_date,
      phase: mesocycleRow?.phase ?? null,
      focusNotes: mesocycleRow?.focus_notes ?? null,
    };
  }

  let recentCompletions: CompletionSummary[] = [];
  if (completionRows && completionRows.length > 0) {
    const workoutIds = completionRows.map((row) => row.workout_id);
    const { data: relatedWorkouts } = await supabase
      .from("workouts")
      .select("id, workout_type, scheduled_date")
      .in("id", workoutIds);
    const workoutsById = new Map((relatedWorkouts ?? []).map((w) => [w.id, w]));

    recentCompletions = completionRows
      .map((row) => {
        const relatedWorkout = workoutsById.get(row.workout_id);
        if (!relatedWorkout) return null;
        return {
          scheduledDate: relatedWorkout.scheduled_date,
          workoutType: relatedWorkout.workout_type,
          actualDistanceM: row.actual_distance_m,
          actualTimeS: row.actual_time_s,
          rpe: row.rpe,
        };
      })
      .filter((c): c is CompletionSummary => c !== null);
  }

  return {
    goal: goalRow
      ? {
          raceName: goalRow.race_name,
          distanceM: goalRow.distance_m,
          goalTimeS: goalRow.goal_time_s,
          goalDate: goalRow.goal_date,
        }
      : null,
    workout,
    recentCompletions,
    recentCheckin: checkinRow
      ? {
          weekStart: checkinRow.week_start,
          fatigue: checkinRow.fatigue,
          soreness: checkinRow.soreness,
          sleepQuality: checkinRow.sleep_quality,
          stress: checkinRow.stress,
        }
      : null,
  };
}
