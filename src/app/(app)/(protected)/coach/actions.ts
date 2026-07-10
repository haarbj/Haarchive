"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { generateSeasonBlueprint, type WorkoutType } from "@/lib/coaching-engine";
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

export type UpdatePhaseState = { error?: string; success?: boolean };

export async function updatePhase(_prevState: UpdatePhaseState, formData: FormData): Promise<UpdatePhaseState> {
  const session = await getAppSession();
  if (session?.role !== "coach") return { error: "Not authorized." };

  const phaseId = formData.get("phaseId");
  const seasonId = formData.get("seasonId");
  const displayName = formData.get("displayName");
  const primaryGoal = formData.get("primaryGoal");
  const secondaryGoalsRaw = formData.get("secondaryGoals");
  const keyWorkoutTypes = formData.getAll("keyWorkoutTypes") as WorkoutType[];

  if (typeof phaseId !== "string" || !phaseId) return { error: "Missing phase." };
  if (typeof displayName !== "string" || !displayName.trim()) return { error: "Enter a phase name." };

  const secondaryGoals =
    typeof secondaryGoalsRaw === "string"
      ? secondaryGoalsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("season_phases")
    .update({
      display_name: displayName.trim(),
      primary_goal: typeof primaryGoal === "string" ? primaryGoal.trim() : "",
      secondary_goals: secondaryGoals,
      key_workout_types: keyWorkoutTypes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", phaseId);
  if (error) return { error: error.message };

  if (typeof seasonId === "string" && seasonId) revalidatePath(`/coach/seasons/${seasonId}`);
  return { success: true };
}

export type ReorderPhaseState = { error?: string };

// Swaps order_index with the adjacent phase via a temporary sentinel value
// rather than a direct two-step swap: season_phases has a
// unique(season_plan_id, order_index) constraint, so setting phase A's
// order_index directly to phase B's current value would collide with B
// still holding it. No explicit transaction wrapper, matching this
// codebase's existing convention for other multi-step writes (e.g.
// generatePlan's sequential inserts) -- a failure mid-swap is a rare,
// recoverable glitch (the coach retries), not a correctness risk to the
// rest of the season.
export async function reorderPhase(
  seasonId: string,
  phaseId: string,
  direction: "up" | "down",
): Promise<ReorderPhaseState> {
  const session = await getAppSession();
  if (session?.role !== "coach") return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: phases, error: loadError } = await supabase
    .from("season_phases")
    .select("id, order_index")
    .eq("season_plan_id", seasonId)
    .order("order_index", { ascending: true });
  if (loadError || !phases) return { error: loadError?.message ?? "Couldn't load phases." };

  const currentIndex = phases.findIndex((p) => p.id === phaseId);
  if (currentIndex === -1) return { error: "Phase not found." };
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= phases.length) return {}; // already at the boundary, no-op

  const current = phases[currentIndex];
  const target = phases[targetIndex];
  const TEMP_ORDER_INDEX = -1;

  const { error: e1 } = await supabase.from("season_phases").update({ order_index: TEMP_ORDER_INDEX }).eq("id", current.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase.from("season_phases").update({ order_index: current.order_index }).eq("id", target.id);
  if (e2) return { error: e2.message };
  const { error: e3 } = await supabase.from("season_phases").update({ order_index: target.order_index }).eq("id", current.id);
  if (e3) return { error: e3.message };

  revalidatePath(`/coach/seasons/${seasonId}`);
  return {};
}

export type UpdateWeekState = { error?: string; success?: boolean };

export async function updateWeek(_prevState: UpdateWeekState, formData: FormData): Promise<UpdateWeekState> {
  const session = await getAppSession();
  if (session?.role !== "coach") return { error: "Not authorized." };

  const weekId = formData.get("weekId");
  const seasonId = formData.get("seasonId");
  const theme = formData.get("theme");
  const mileageLevel = formData.get("mileageLevel");

  if (typeof weekId !== "string" || !weekId) return { error: "Missing week." };
  if (typeof theme !== "string" || !theme.trim()) return { error: "Enter a focus for this week." };
  if (mileageLevel !== "low" && mileageLevel !== "moderate" && mileageLevel !== "high") {
    return { error: "Choose a mileage level." };
  }

  const slots: { label: string; workoutType: string }[] = [];
  for (let i = 0; ; i++) {
    const label = formData.get(`slot-label-${i}`);
    const workoutType = formData.get(`slot-type-${i}`);
    if (label === null || workoutType === null) break;
    if (typeof label === "string" && typeof workoutType === "string" && label.trim()) {
      slots.push({ label: label.trim(), workoutType });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("season_weeks")
    .update({
      theme: theme.trim(),
      mileage_level: mileageLevel,
      workout_slots: slots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", weekId);
  if (error) return { error: error.message };

  if (typeof seasonId === "string" && seasonId) revalidatePath(`/coach/seasons/${seasonId}`);
  return { success: true };
}
