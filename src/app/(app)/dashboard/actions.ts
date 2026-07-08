"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { parseTimeToSeconds } from "@/lib/format";
import { goalSchema, raceResultSchema } from "@/lib/validation/onboarding";

export type OnboardingState = {
  error?: string;
};

export async function saveOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const goalParsed = goalSchema.safeParse({
    raceName: formData.get("goalRaceName"),
    distanceM: formData.get("goalDistanceM"),
    goalTimeInput: formData.get("goalTimeInput") || undefined,
    goalDate: formData.get("goalDate") || undefined,
  });
  if (!goalParsed.success) {
    return { error: goalParsed.error.issues[0]?.message ?? "Check your goal details" };
  }

  const goalTimeS = goalParsed.data.goalTimeInput
    ? parseTimeToSeconds(goalParsed.data.goalTimeInput)
    : null;
  if (goalParsed.data.goalTimeInput && goalTimeS === null) {
    return { error: "Enter your goal time as mm:ss or h:mm:ss" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  const { error: goalError } = await supabase.from("goals").insert({
    user_id: userId,
    race_name: goalParsed.data.raceName,
    distance_m: goalParsed.data.distanceM,
    goal_time_s: goalTimeS,
    goal_date: goalParsed.data.goalDate || null,
  });
  if (goalError) {
    return { error: goalError.message };
  }

  const resultRaceName = formData.get("resultRaceName");
  if (resultRaceName) {
    const resultParsed = raceResultSchema.safeParse({
      raceName: resultRaceName,
      raceDate: formData.get("resultRaceDate"),
      distanceM: formData.get("resultDistanceM"),
      finishTimeInput: formData.get("resultFinishTimeInput"),
      courseType: formData.get("resultCourseType"),
    });
    if (!resultParsed.success) {
      return {
        error: resultParsed.error.issues[0]?.message ?? "Check your race result details",
      };
    }

    const finishTimeS = parseTimeToSeconds(resultParsed.data.finishTimeInput);
    if (finishTimeS === null) {
      return { error: "Enter your finish time as mm:ss or h:mm:ss" };
    }

    const { error: resultError } = await supabase.from("race_results").insert({
      user_id: userId,
      race_name: resultParsed.data.raceName,
      race_date: resultParsed.data.raceDate,
      distance_m: resultParsed.data.distanceM,
      finish_time_s: finishTimeS,
      course_type: resultParsed.data.courseType,
    });
    if (resultError) {
      return { error: resultError.message };
    }
  }

  revalidatePath("/dashboard");
  return {};
}

export type UpdateGoalState = {
  error?: string;
  success?: boolean;
};

export async function updateGoal(
  _prevState: UpdateGoalState,
  formData: FormData,
): Promise<UpdateGoalState> {
  const goalId = formData.get("goalId");
  if (typeof goalId !== "string" || !goalId) {
    return { error: "Missing goal" };
  }

  const parsed = goalSchema.safeParse({
    raceName: formData.get("goalRaceName"),
    distanceM: formData.get("goalDistanceM"),
    goalTimeInput: formData.get("goalTimeInput") || undefined,
    goalDate: formData.get("goalDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your goal details" };
  }

  const goalTimeS = parsed.data.goalTimeInput
    ? parseTimeToSeconds(parsed.data.goalTimeInput)
    : null;
  if (parsed.data.goalTimeInput && goalTimeS === null) {
    return { error: "Enter your goal time as mm:ss or h:mm:ss" };
  }

  const supabase = await createClient();
  // No need to check the caller's identity separately here -- the
  // goals_update_own RLS policy already restricts this update to rows the
  // caller owns, regardless of which goalId was submitted.
  const { error } = await supabase
    .from("goals")
    .update({
      race_name: parsed.data.raceName,
      distance_m: parsed.data.distanceM,
      goal_time_s: goalTimeS,
      goal_date: parsed.data.goalDate || null,
    })
    .eq("id", goalId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
