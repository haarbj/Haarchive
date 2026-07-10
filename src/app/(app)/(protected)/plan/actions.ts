"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  generateCompletionFeedback,
  generateTrainingPlan,
  workoutPrescriptionSchema,
  type WorkoutPrescription,
} from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { parseTimeToSeconds } from "@/lib/format";
import { completeWorkoutSchema, generatePlanSchema } from "@/lib/validation/plan";

const MILES_TO_METERS = 1609.34;

// Called by ExplainWorkoutButton once it finishes reading the streamed
// explanation from /api/coach/explain-workout -- persisting the assistant's
// final text is the client's job specifically so it happens as a normal,
// fully-awaited write, not a server-side "after the response" hook.
export async function logExplanation(conversationId: string, content: string): Promise<void> {
  if (!conversationId || !content) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "assistant",
    content,
  });
}

export type GeneratePlanState = { error?: string };

export async function generatePlan(
  _prevState: GeneratePlanState,
  formData: FormData,
): Promise<GeneratePlanState> {
  const parsed = generatePlanSchema.safeParse({
    currentWeeklyMileage: formData.get("currentWeeklyMileage"),
    daysPerWeek: formData.get("daysPerWeek"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your training details" };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired -- sign in again." };
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("id, race_name, distance_m, goal_time_s, goal_date")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!goal || !goal.goal_time_s || !goal.goal_date) {
    return { error: "Set a goal time and date before generating a plan." };
  }

  const { data: existingPlan } = await supabase
    .from("training_plans")
    .select("id")
    .in("status", ["draft", "active"])
    .maybeSingle();
  if (existingPlan) {
    return { error: "You already have an active training plan." };
  }

  const { error: profileError } = await supabase.from("athlete_profiles").upsert({
    user_id: userId,
    current_weekly_mileage: parsed.data.currentWeeklyMileage,
    running_days_per_week: parsed.data.daysPerWeek,
  });
  if (profileError) {
    return { error: profileError.message };
  }

  const result = generateTrainingPlan({
    goal: {
      raceName: goal.race_name,
      distanceM: goal.distance_m,
      timeS: goal.goal_time_s,
      date: goal.goal_date,
    },
    athlete: {
      currentWeeklyMileageM: parsed.data.currentWeeklyMileage * MILES_TO_METERS,
      daysPerWeek: parsed.data.daysPerWeek,
    },
    today: new Date().toISOString().slice(0, 10),
  });
  if (!result.ok) {
    return { error: result.error };
  }

  const { data: insertedPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: userId,
      goal_id: goal.id,
      name: result.plan.name,
      start_date: result.plan.startDate,
      end_date: result.plan.endDate,
      philosophy: result.plan.philosophy,
      status: result.plan.status,
    })
    .select("id")
    .single();
  if (planError || !insertedPlan) {
    return { error: planError?.message ?? "Couldn't save your plan." };
  }

  // Mint mesocycle IDs client-side rather than reading them back from the
  // insert response -- Postgres doesn't guarantee a bulk-insert's returned
  // row order matches input order, and workouts.mesocycle_id must never
  // depend on that guarantee holding.
  const mesocycleIds = result.mesocycles.map(() => crypto.randomUUID());
  const { error: mesoError } = await supabase.from("mesocycles").insert(
    result.mesocycles.map((mesocycle, i) => ({
      id: mesocycleIds[i],
      training_plan_id: insertedPlan.id,
      user_id: userId,
      phase: mesocycle.phase,
      start_date: mesocycle.startDate,
      end_date: mesocycle.endDate,
      focus_notes: mesocycle.focusNotes,
    })),
  );
  if (mesoError) {
    return { error: mesoError.message };
  }

  const { error: workoutsError } = await supabase.from("workouts").insert(
    result.workouts.map((workout) => ({
      mesocycle_id: mesocycleIds[workout.mesocycleIndex],
      user_id: userId,
      scheduled_date: workout.scheduledDate,
      workout_type: workout.workoutType,
      prescription: workout.prescription,
    })),
  );
  if (workoutsError) {
    return { error: workoutsError.message };
  }

  revalidatePath("/dashboard");
  redirect("/plan");
}

export type CompleteWorkoutState = { error?: string; feedback?: string };

export async function completeWorkout(
  _prevState: CompleteWorkoutState,
  formData: FormData,
): Promise<CompleteWorkoutState> {
  const workoutId = formData.get("workoutId");
  if (typeof workoutId !== "string" || !workoutId) {
    return { error: "Missing workout" };
  }

  const parsed = completeWorkoutSchema.safeParse({
    actualDistanceInput: formData.get("actualDistanceInput") || undefined,
    actualTimeInput: formData.get("actualTimeInput") || undefined,
    rpeInput: formData.get("rpeInput") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check what you entered" };
  }

  const actualDistanceM = parsed.data.actualDistanceInput
    ? Number(parsed.data.actualDistanceInput) * MILES_TO_METERS
    : null;
  if (parsed.data.actualDistanceInput && (actualDistanceM === null || Number.isNaN(actualDistanceM) || actualDistanceM <= 0)) {
    return { error: "Enter your distance as a number" };
  }

  const actualTimeS = parsed.data.actualTimeInput
    ? parseTimeToSeconds(parsed.data.actualTimeInput)
    : null;
  if (parsed.data.actualTimeInput && actualTimeS === null) {
    return { error: "Enter your time as mm:ss or h:mm:ss" };
  }

  const rpe = parsed.data.rpeInput ? Number(parsed.data.rpeInput) : null;
  if (parsed.data.rpeInput && (rpe === null || rpe < 1 || rpe > 10)) {
    return { error: "RPE must be between 1 and 10" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired -- sign in again." };
  }

  const { error } = await supabase.from("workout_completions").insert({
    workout_id: workoutId,
    user_id: userId,
    actual_distance_m: actualDistanceM,
    actual_time_s: actualTimeS,
    rpe,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/plan");

  // Best-effort: a short coaching note comparing planned vs. actual, shown
  // once right after logging. Not persisted -- it's cheaply recomputable
  // from the same completion + prescription data, so there's no need for a
  // column that could go stale.
  const { data: workoutRow } = await supabase
    .from("workouts")
    .select("prescription")
    .eq("id", workoutId)
    .maybeSingle();
  const parsedPrescription = workoutRow ? workoutPrescriptionSchema.safeParse(workoutRow.prescription) : null;
  const feedback = parsedPrescription?.success
    ? (generateCompletionFeedback(parsedPrescription.data, { actualDistanceM, actualTimeS, rpe }) ?? undefined)
    : undefined;

  return { feedback };
}

export type ApplyAdaptationState = { error?: string };

// Called once the athlete confirms a proposed change from the adapt-workout
// flow -- nothing from that flow ever touches the database on its own,
// per the "always confirm first" decision for this feature.
export async function applyAdaptation(
  workoutId: string,
  before: WorkoutPrescription,
  after: WorkoutPrescription,
  athleteMessage: string,
  explanation: string,
): Promise<ApplyAdaptationState> {
  if (!workoutId) return { error: "Missing workout" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired -- sign in again." };

  // original_prescription is set once and preserved across repeated
  // adaptations, so Undo always restores the true original, not whatever
  // the prior adaptation's "before" happened to be.
  const { data: existing } = await supabase
    .from("workouts")
    .select("original_prescription")
    .eq("id", workoutId)
    .maybeSingle();

  const { error } = await supabase
    .from("workouts")
    .update({
      prescription: after,
      original_prescription: existing?.original_prescription ?? before,
      adapted_at: new Date().toISOString(),
      adaptation_reason: athleteMessage,
      adaptation_explanation: explanation,
    })
    .eq("id", workoutId);
  if (error) return { error: error.message };

  revalidatePath("/plan");
  return {};
}

export async function undoAdaptation(workoutId: string): Promise<ApplyAdaptationState> {
  if (!workoutId) return { error: "Missing workout" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired -- sign in again." };

  const { data: workout } = await supabase
    .from("workouts")
    .select("original_prescription")
    .eq("id", workoutId)
    .maybeSingle();
  if (!workout?.original_prescription) {
    return { error: "Nothing to undo." };
  }

  const { error } = await supabase
    .from("workouts")
    .update({
      prescription: workout.original_prescription,
      original_prescription: null,
      adapted_at: null,
      adaptation_reason: null,
      adaptation_explanation: null,
    })
    .eq("id", workoutId);
  if (error) return { error: error.message };

  revalidatePath("/plan");
  return {};
}

export type ToggleGroupCompletionState = { error?: string };

// Deliberately simpler than completeWorkout -- a coach-authored group
// session is qualitative (free-text description, no distance/pace unless
// the coach opted in), so there's no prescription to compare actuals
// against and generate feedback from. Just "did you do it," toggled.
export async function toggleGroupWorkoutCompletion(
  groupPlanWorkoutId: string,
  currentlyCompleted: boolean,
): Promise<ToggleGroupCompletionState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired -- sign in again." };

  if (currentlyCompleted) {
    const { error } = await supabase
      .from("workout_completions")
      .delete()
      .eq("group_plan_workout_id", groupPlanWorkoutId)
      .eq("user_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("workout_completions")
      .insert({ group_plan_workout_id: groupPlanWorkoutId, user_id: userId });
    if (error) return { error: error.message };
  }

  revalidatePath("/plan");
  return {};
}
