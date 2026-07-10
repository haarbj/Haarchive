"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { generateSeasonBlueprint, generateTrainingPlan, type WorkoutType } from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { formatDistance } from "@/lib/format";
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

export type GenerateRosterPlansState = {
  error?: string;
  result?: { succeeded: string[]; skipped: { athleteName: string; reason: string }[] };
};

// The existing self-serve generatePlan (plan/actions.ts) is left completely
// untouched -- this is a separate action rather than a parameterized
// version of it, because the two have genuinely different authorization
// shapes (caller-is-owner vs. caller-authorizes-someone-else) and
// conflating them risks the self-serve path's implicit RLS-scoping
// quietly depending on a new parameter. generateTrainingPlan() itself is
// also called completely unmodified here.
export async function generatePlansForRoster(
  seasonId: string,
  athleteUserIds: string[],
): Promise<GenerateRosterPlansState> {
  const session = await getAppSession();
  if (session?.role !== "coach" || !session.teamId) return { error: "Not authorized." };
  if (athleteUserIds.length === 0) return { error: "Select at least one athlete." };

  const supabase = await createClient();

  const { data: season } = await supabase
    .from("season_plans")
    .select("id, goal_race_name, goal_race_date, goal_distance_m")
    .eq("id", seasonId)
    .maybeSingle();
  if (!season) return { error: "Season not found." };

  // Ordered the same way season_generator.ts produced them, which is what
  // makes the positional mesocycles[i] <-> season_phases[i] mapping below
  // correct -- see the season_blueprint migration's own comment on this.
  const { data: seasonPhases } = await supabase
    .from("season_phases")
    .select("id, order_index")
    .eq("season_plan_id", seasonId)
    .order("order_index", { ascending: true });
  if (!seasonPhases || seasonPhases.length === 0) return { error: "This season has no phases yet." };

  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", athleteUserIds);
  const nameFor = (id: string) => profiles?.find((p) => p.id === id)?.display_name ?? id;

  const today = new Date().toISOString().slice(0, 10);
  const succeeded: string[] = [];
  const skipped: { athleteName: string; reason: string }[] = [];

  for (const athleteId of athleteUserIds) {
    const { data: existingPlan } = await supabase
      .from("training_plans")
      .select("id")
      .eq("user_id", athleteId)
      .in("status", ["draft", "active"])
      .maybeSingle();
    if (existingPlan) {
      skipped.push({ athleteName: nameFor(athleteId), reason: "Already has an active training plan." });
      continue;
    }

    const { data: athleteProfile } = await supabase
      .from("athlete_profiles")
      .select("current_weekly_mileage, running_days_per_week")
      .eq("user_id", athleteId)
      .maybeSingle();
    if (!athleteProfile?.current_weekly_mileage || !athleteProfile?.running_days_per_week) {
      skipped.push({ athleteName: nameFor(athleteId), reason: "Hasn't set their current mileage/days per week yet." });
      continue;
    }

    // The season sets the shared race (name/date/distance); each athlete's
    // own previously-set goal time drives their personal pace zones -- a
    // coach doesn't know each runner's individual goal time, so this reuses
    // whatever the athlete already entered themselves via the self-serve
    // goal flow rather than asking the coach to guess it.
    const { data: athleteGoal } = await supabase
      .from("goals")
      .select("id, distance_m, goal_time_s")
      .eq("user_id", athleteId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!athleteGoal || athleteGoal.distance_m !== season.goal_distance_m || !athleteGoal.goal_time_s) {
      skipped.push({
        athleteName: nameFor(athleteId),
        reason: `Needs an active ${formatDistance(season.goal_distance_m)} goal with a goal time set.`,
      });
      continue;
    }

    const result = generateTrainingPlan({
      goal: {
        raceName: season.goal_race_name,
        distanceM: season.goal_distance_m,
        timeS: athleteGoal.goal_time_s,
        date: season.goal_race_date,
      },
      athlete: {
        currentWeeklyMileageM: athleteProfile.current_weekly_mileage * MILES_TO_METERS,
        daysPerWeek: athleteProfile.running_days_per_week,
      },
      today,
    });
    if (!result.ok) {
      skipped.push({ athleteName: nameFor(athleteId), reason: result.error });
      continue;
    }
    // Defensive: the positional phase mapping only holds if this athlete's
    // plan has the same mesocycle structure as the season -- true whenever
    // roster generation happens in the same session as season generation
    // (today matches what season_phases[0].start_date was computed from),
    // but not guaranteed if a lot of time has passed since. Skip rather
    // than silently mis-map a phase.
    if (result.mesocycles.length !== seasonPhases.length) {
      skipped.push({
        athleteName: nameFor(athleteId),
        reason: "Plan structure doesn't match the season (it may be stale) -- regenerate the season to fix this.",
      });
      continue;
    }

    const { data: insertedPlan, error: planError } = await supabase
      .from("training_plans")
      .insert({
        user_id: athleteId,
        goal_id: athleteGoal.id,
        season_plan_id: seasonId,
        name: result.plan.name,
        start_date: result.plan.startDate,
        end_date: result.plan.endDate,
        philosophy: result.plan.philosophy,
        status: result.plan.status,
      })
      .select("id")
      .single();
    if (planError || !insertedPlan) {
      skipped.push({ athleteName: nameFor(athleteId), reason: planError?.message ?? "Couldn't save the plan." });
      continue;
    }

    const mesocycleIds = result.mesocycles.map(() => crypto.randomUUID());
    const { error: mesoError } = await supabase.from("mesocycles").insert(
      result.mesocycles.map((mesocycle, i) => ({
        id: mesocycleIds[i],
        training_plan_id: insertedPlan.id,
        user_id: athleteId,
        season_phase_id: seasonPhases[i].id,
        phase: mesocycle.phase,
        start_date: mesocycle.startDate,
        end_date: mesocycle.endDate,
        focus_notes: mesocycle.focusNotes,
      })),
    );
    if (mesoError) {
      skipped.push({ athleteName: nameFor(athleteId), reason: mesoError.message });
      continue;
    }

    const { error: workoutsError } = await supabase.from("workouts").insert(
      result.workouts.map((workout) => ({
        mesocycle_id: mesocycleIds[workout.mesocycleIndex],
        user_id: athleteId,
        scheduled_date: workout.scheduledDate,
        workout_type: workout.workoutType,
        prescription: workout.prescription,
      })),
    );
    if (workoutsError) {
      skipped.push({ athleteName: nameFor(athleteId), reason: workoutsError.message });
      continue;
    }

    succeeded.push(nameFor(athleteId));
  }

  revalidatePath(`/coach/seasons/${seasonId}`);
  return { result: { succeeded, skipped } };
}
