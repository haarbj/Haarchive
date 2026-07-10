"use server";

import { redirect } from "next/navigation";

import { generateSeasonBlueprint } from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";

const MILES_TO_METERS = 1609.34;

export type GenerateSeasonState = { error?: string };

// Mints season_phases ids client-side before insert, same reasoning as
// generatePlan's mesocycle ids in plan/actions.ts: a bulk insert's returned
// row order isn't guaranteed to match input order, and season_weeks.
// season_phase_id must never depend on that guarantee holding.
export async function generateSeason(
  _prevState: GenerateSeasonState,
  formData: FormData,
): Promise<GenerateSeasonState> {
  const session = await getAppSession();
  if (session?.role !== "coach" || !session.teamId) {
    return { error: "Not authorized." };
  }

  const name = formData.get("name");
  const goalRaceName = formData.get("goalRaceName");
  const goalRaceDate = formData.get("goalRaceDate");
  const goalDistanceM = Number(formData.get("goalDistanceM"));
  const currentWeeklyMileage = Number(formData.get("currentWeeklyMileage"));
  const daysPerWeek = Number(formData.get("daysPerWeek"));

  if (typeof name !== "string" || !name.trim()) return { error: "Enter a season name." };
  if (typeof goalRaceName !== "string" || !goalRaceName.trim()) return { error: "Enter a goal race name." };
  if (typeof goalRaceDate !== "string" || !goalRaceDate) return { error: "Enter a goal race date." };
  if (!goalDistanceM || goalDistanceM <= 0) return { error: "Choose a goal distance." };
  if (!currentWeeklyMileage || currentWeeklyMileage <= 0) {
    return { error: "Enter a representative current weekly mileage." };
  }
  if (!daysPerWeek || daysPerWeek < 3 || daysPerWeek > 6) return { error: "Choose 3-6 days per week." };

  const today = new Date().toISOString().slice(0, 10);
  const result = generateSeasonBlueprint({
    goal: { raceName: goalRaceName, distanceM: goalDistanceM, date: goalRaceDate },
    representativeAthlete: { currentWeeklyMileageM: currentWeeklyMileage * MILES_TO_METERS, daysPerWeek },
    today,
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();

  const { data: insertedSeason, error: seasonError } = await supabase
    .from("season_plans")
    .insert({
      team_id: session.teamId,
      created_by: session.userId,
      name,
      goal_race_name: goalRaceName,
      goal_race_date: goalRaceDate,
      goal_distance_m: goalDistanceM,
      status: "active",
    })
    .select("id")
    .single();
  if (seasonError || !insertedSeason) {
    return { error: seasonError?.message ?? "Couldn't save the season." };
  }

  const phaseIds = result.phases.map(() => crypto.randomUUID());
  const { error: phasesError } = await supabase.from("season_phases").insert(
    result.phases.map((phase, i) => ({
      id: phaseIds[i],
      team_id: session.teamId,
      season_plan_id: insertedSeason.id,
      phase: phase.phase,
      display_name: phase.displayName,
      order_index: phase.orderIndex,
      start_date: phase.startDate,
      end_date: phase.endDate,
      primary_goal: phase.primaryGoal,
      secondary_goals: phase.secondaryGoals,
      key_workout_types: phase.keyWorkoutTypes,
    })),
  );
  if (phasesError) return { error: phasesError.message };

  const { error: weeksError } = await supabase.from("season_weeks").insert(
    result.weeks.map((week) => ({
      team_id: session.teamId,
      season_plan_id: insertedSeason.id,
      season_phase_id: phaseIds[week.phaseOrderIndex],
      week_index: week.weekIndex,
      theme: week.theme,
      mileage_level: week.mileageLevel,
      workout_slots: week.workoutSlots,
    })),
  );
  if (weeksError) return { error: weeksError.message };

  redirect(`/coach/seasons/${insertedSeason.id}`);
}
