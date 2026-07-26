"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { athleteProfileSchema } from "@/lib/validation/athlete-profile";

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
};

export type UpdateAthleteProfileState = {
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
