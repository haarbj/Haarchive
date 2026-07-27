"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { athleteProfileSchema } from "@/lib/validation/athlete-profile";
import { communityProfileSchema } from "@/lib/validation/community-profile";
import { raceResultSchema } from "@/lib/validation/onboarding";
import { raceDistanceMap } from "@/lib/race-distances";
import { parseTimeToSeconds } from "@/lib/running-format";

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
};

export type UpdateAthleteProfileState = {
  error?: string;
  success?: boolean;
};

export type UpdateCommunityProfileState = {
  error?: string;
  success?: boolean;
};

export type AddRaceResultState = {
  error?: string;
  success?: boolean;
};

function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const displayName = formData.get("displayName");
  const units = formData.get("units");

  if (typeof displayName !== "string" || !displayName.trim()) {
    return { error: "Display name can't be empty" };
  }
  if (units !== "mi" && units !== "km") {
    return { error: "Invalid units" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim(), units })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAthleteProfile(
  _prevState: UpdateAthleteProfileState,
  formData: FormData,
): Promise<UpdateAthleteProfileState> {
  const parsed = athleteProfileSchema.safeParse({
    birthYear: formData.get("birthYear"),
    weightLb: formData.get("weightLb"),
    currentWeeklyMileage: formData.get("currentWeeklyMileage"),
    daysPerWeek: formData.get("daysPerWeek"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the values above." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  const { error } = await supabase.from("athlete_profiles").upsert({
    user_id: userId,
    birth_year: parsed.data.birthYear,
    weight_kg: lbsToKg(parsed.data.weightLb),
    current_weekly_mileage: parsed.data.currentWeeklyMileage,
    running_days_per_week: parsed.data.daysPerWeek,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/plan/new");
  return { success: true };
}

export async function updateCommunityProfile(
  _prevState: UpdateCommunityProfileState,
  formData: FormData,
): Promise<UpdateCommunityProfileState> {
  const parsed = communityProfileSchema.safeParse({
    bio: formData.get("bio"),
    location: formData.get("location"),
    favoriteDistances: formData.getAll("favoriteDistances"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the values above." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  const { error } = await supabase.from("community_profiles").upsert({
    user_id: userId,
    bio: parsed.data.bio,
    location: parsed.data.location,
    favorite_distances: parsed.data.favoriteDistances,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath(`/community/${userId}`);
  return { success: true };
}

export async function addRaceResult(
  _prevState: AddRaceResultState,
  formData: FormData,
): Promise<AddRaceResultState> {
  const distanceKey = formData.get("distanceKey");
  const distance = typeof distanceKey === "string" ? raceDistanceMap.get(distanceKey) : undefined;
  if (!distance) {
    return { error: "Pick a valid distance" };
  }

  const parsed = raceResultSchema.safeParse({
    raceName: formData.get("raceName"),
    raceDate: formData.get("raceDate"),
    distanceM: Math.round(distance.meters),
    finishTimeInput: formData.get("finishTimeInput"),
    courseType: formData.get("courseType"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your race result details" };
  }

  const finishTimeS = parseTimeToSeconds(parsed.data.finishTimeInput);
  if (finishTimeS === null) {
    return { error: "Enter your finish time as mm:ss or h:mm:ss" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  const { error } = await supabase.from("race_results").insert({
    user_id: userId,
    race_name: parsed.data.raceName,
    race_date: parsed.data.raceDate,
    distance_m: parsed.data.distanceM,
    finish_time_s: finishTimeS,
    course_type: parsed.data.courseType,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export type UpdateRaceResultState = {
  error?: string;
  success?: boolean;
};

export async function updateRaceResult(
  _prevState: UpdateRaceResultState,
  formData: FormData,
): Promise<UpdateRaceResultState> {
  const raceResultId = formData.get("raceResultId");
  if (typeof raceResultId !== "string" || !raceResultId) {
    return { error: "Missing race result" };
  }

  const distanceKey = formData.get("distanceKey");
  const distance = typeof distanceKey === "string" ? raceDistanceMap.get(distanceKey) : undefined;
  if (!distance) {
    return { error: "Pick a valid distance" };
  }

  const parsed = raceResultSchema.safeParse({
    raceName: formData.get("raceName"),
    raceDate: formData.get("raceDate"),
    distanceM: Math.round(distance.meters),
    finishTimeInput: formData.get("finishTimeInput"),
    courseType: formData.get("courseType"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your race result details" };
  }

  const finishTimeS = parseTimeToSeconds(parsed.data.finishTimeInput);
  if (finishTimeS === null) {
    return { error: "Enter your finish time as mm:ss or h:mm:ss" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired — sign in again." };
  }

  // Scoped to both id and user_id -- RLS already enforces owner-only
  // updates, but matching it explicitly here (as deleteRaceResult already
  // does) means a wrong/stale id can never silently no-op against someone
  // else's row.
  const { error } = await supabase
    .from("race_results")
    .update({
      race_name: parsed.data.raceName,
      race_date: parsed.data.raceDate,
      distance_m: parsed.data.distanceM,
      finish_time_s: finishTimeS,
      course_type: parsed.data.courseType,
    })
    .eq("id", raceResultId)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteRaceResult(raceResultId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  // Scoped to both id and user_id -- RLS already enforces owner-only
  // deletes, but matching it explicitly here means a wrong/stale id can
  // never silently no-op against someone else's row.
  await supabase.from("race_results").delete().eq("id", raceResultId).eq("user_id", userId);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
