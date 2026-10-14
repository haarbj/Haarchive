"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { detectDeterioration, type PastReview } from "@/lib/private-coaching/estimate-review";
import { getAthleteGoalRace } from "@/lib/private-coaching/goal-race";
import {
  assessUnderFueling,
  ferritinCheckGuidance,
  runGutTrainingCheck,
  type FuelRelevantWorkout,
  type GutTrainingFinding,
  type UnderFuelingAssessment,
  type UnderFuelingSignals,
} from "@/lib/private-coaching/fueling-oversight";
import type { SetbackGuidance } from "@/lib/private-coaching/setbacks";

// Part L, coach-only. The under-fuelling cluster is answered in the
// moment (same stateless pattern as Parts I and J's panels) since it is
// a judgment call about the athlete, not something with a structured
// column anywhere. The gut-training check and the ferritin trigger's
// "aerobic fitness stalling" half are both derived from real logged data.

async function requireCoachOf(athleteId: string) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." as const };
  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." as const };
  return { session, supabase };
}

export type FuelingOversightView = {
  error?: string;
  underFueling?: UnderFuelingAssessment;
  gutTraining?: GutTrainingFinding;
  ferritin?: SetbackGuidance | null;
};

type WorkoutRow = {
  id: string;
  scheduled_date: string;
  notes_from_coach: string | null;
  planned_distance_m: number | null;
  published_at: string | null;
};
type CompletionRow = { scheduled_workout_id: string; athlete_notes: string | null; conditions_notes: string | null };

export async function loadFuelingOversight(input: {
  athleteId: string;
  underFuelingSignals: UnderFuelingSignals;
}): Promise<FuelingOversightView> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const underFueling = assessUnderFueling(input.underFuelingSignals);

  const goalRace = await getAthleteGoalRace(supabase, input.athleteId);
  const raceDate = goalRace?.goalDate ?? null;

  let gutTraining: GutTrainingFinding = { fired: false, detail: "", unpracticedSessions: [] };
  if (raceDate) {
    const windowStart = new Date(`${raceDate}T00:00:00Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - 8 * 7);
    const windowStartIso = windowStart.toISOString().slice(0, 10);

    const { data: workoutRows } = await supabase
      .from("scheduled_workouts")
      .select("id, scheduled_date, notes_from_coach, planned_distance_m, published_at")
      .eq("athlete_id", input.athleteId)
      .gte("scheduled_date", windowStartIso)
      .lte("scheduled_date", raceDate)
      .returns<WorkoutRow[]>();
    const workouts = workoutRows ?? [];

    const { data: completionRows } = workouts.length
      ? await supabase
          .from("completed_workouts")
          .select("scheduled_workout_id, athlete_notes, conditions_notes")
          .in("scheduled_workout_id", workouts.map((w) => w.id))
          .returns<CompletionRow[]>()
      : { data: [] as CompletionRow[] };
    const completionByWorkout = new Map((completionRows ?? []).map((c) => [c.scheduled_workout_id, c]));

    const fuelRelevantWorkouts: FuelRelevantWorkout[] = workouts.map((w) => {
      const completion = completionByWorkout.get(w.id);
      return {
        id: w.id,
        scheduledDate: w.scheduled_date,
        prescription: w.notes_from_coach,
        phaseKey: null,
        plannedDistanceM: w.planned_distance_m,
        completed: completion != null,
        loggedNotes: completion ? [completion.athlete_notes, completion.conditions_notes].filter(Boolean).join(" ") : null,
      };
    });

    gutTraining = runGutTrainingCheck({ workouts: fuelRelevantWorkouts, raceDate });
  }

  // The same deterioration signal Part F's estimate review already
  // computes, reused here rather than asking the coach to judge "stalling"
  // a second time through a different question.
  const { data: historyRows } = await supabase
    .from("coach_estimate_reviews")
    .select("reviewed_at, confirmed_time_s, work_completed")
    .eq("athlete_id", input.athleteId)
    .order("reviewed_at", { ascending: false })
    .limit(10)
    .returns<{ reviewed_at: string; confirmed_time_s: number | null; work_completed: boolean }[]>();
  const pastReviews: PastReview[] = (historyRows ?? [])
    .filter((r): r is typeof r & { confirmed_time_s: number } => r.confirmed_time_s != null)
    .map((r) => ({ reviewedAt: r.reviewed_at, estimateTimeS: r.confirmed_time_s, workCompleted: r.work_completed }))
    .reverse();
  const aerobicFitnessStalling = detectDeterioration(pastReviews).flagged;

  const ferritin = ferritinCheckGuidance({
    underFuelingClusterPresent: underFueling.clusterPresent,
    aerobicFitnessStalling,
  });

  return { underFueling, gutTraining, ferritin };
}
