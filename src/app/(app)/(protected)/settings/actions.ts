"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import { becomeSelfCoach } from "@/app/(app)/(protected)/coaching/self-coach-actions";
import { athleteProfileSchema } from "@/lib/validation/athlete-profile";
import { communityProfileSchema } from "@/lib/validation/community-profile";
import { injurySchema, raceResultSchema } from "@/lib/validation/onboarding";
import { raceDistanceMap } from "@/lib/race-distances";
import { parseTimeToSeconds } from "@/lib/running-format";

export type UpdateProfileState = {
  error?: string;
  success?: boolean;
};

export type UpdateCoachSettingsState = {
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

function inToCm(inches: number): number {
  return inches * 2.54;
}

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const displayName = formData.get("displayName");
  const units = formData.get("units");
  // Standard unchecked-checkbox-sends-nothing handling, same convention as
  // question-triage-panel's isFaq and admin/users' permission checkboxes.
  const emailUnsubscribed = formData.get("emailUnsubscribed") === "on";
  const wasEmailUnsubscribed = formData.get("wasEmailUnsubscribed") === "true";

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
    return { error: "Your session expired. Sign in again." };
  }

  const updates: { display_name: string; units: string; email_unsubscribed_at?: string | null } = {
    display_name: displayName.trim(),
    units,
  };
  // Only touch the timestamp when the checkbox actually changed -- saving
  // the form for an unrelated field shouldn't stamp a fresh
  // email_unsubscribed_at (or silently clear one an admin set) just
  // because the box was already in that state.
  if (emailUnsubscribed !== wasEmailUnsubscribed) {
    updates.email_unsubscribed_at = emailUnsubscribed ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

// Coach-only settings, kept as their own action (rather than folded into
// updateProfile above) since they're a separate concern with their own
// section on the page, and updateProfile requires a non-empty displayName
// this form never collects. Available to update anytime, per the same
// "can be updated later" requirement as the required onboarding prompt
// this pairs with (setCoachTrainsSelf, below).
export async function updateCoachSettings(
  _prevState: UpdateCoachSettingsState,
  formData: FormData,
): Promise<UpdateCoachSettingsState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const coachDisplayName = formData.get("coachDisplayName");
  const trainsSelf = formData.get("coachTrainsSelf");
  if (trainsSelf !== "true" && trainsSelf !== "false") {
    return { error: "Choose whether you also train yourself." };
  }
  const coachBio = formData.get("coachBio");
  const coachPhilosophy = formData.get("coachPhilosophy");
  if (typeof coachBio === "string" && coachBio.length > 300) {
    return { error: "Keep your bio under 300 characters." };
  }
  if (typeof coachPhilosophy === "string" && coachPhilosophy.length > 5000) {
    return { error: "Keep your training philosophy under 5000 characters." };
  }
  const defaultVolumeUnit = formData.get("coachDefaultVolumeUnit");
  if (defaultVolumeUnit !== "miles" && defaultVolumeUnit !== "minutes") {
    return { error: "Choose a Weekly Load unit." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      coach_display_name: typeof coachDisplayName === "string" && coachDisplayName.trim() ? coachDisplayName.trim() : null,
      coach_trains_self: trainsSelf === "true",
      coach_bio: typeof coachBio === "string" && coachBio.trim() ? coachBio.trim() : null,
      coach_philosophy: typeof coachPhilosophy === "string" && coachPhilosophy.trim() ? coachPhilosophy.trim() : null,
      coach_default_volume_unit: defaultVolumeUnit,
    })
    .eq("id", session.userId);
  if (error) return { error: error.message };

  // Flipping this to "yes" from Settings (not just the onboarding prompt
  // below) should have the same real effect -- see setCoachTrainsSelf's
  // own comment for why.
  if (trainsSelf === "true") {
    const result = await becomeSelfCoach();
    if (result.error) return { error: result.error };
  }

  revalidatePath("/settings");
  revalidatePath("/coaching");
  revalidatePath("/coaching/coach-profile");
  return { success: true };
}

// The required-onboarding-prompt version of the same coach_trains_self
// write above -- deliberately simpler (a single boolean, not a form) since
// it's answered via two plain Yes/No buttons on /coaching, not a form
// field. Never touches coach_display_name, so a coach who answers this
// prompt first and sets a display name later in Settings doesn't have one
// silently clobber the other.
export async function setCoachTrainsSelf(trainsSelf: boolean): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ coach_trains_self: trainsSelf }).eq("id", session.userId);
  if (error) return { error: error.message };

  // "Yes, I train too" should actually make this coach self-coached, not
  // just flip a display flag -- otherwise a coach whose private_coach
  // permission was admin-granted (never went through the self-serve
  // SelfCoachPrompt on /coaching, which only renders for someone with
  // neither role) answers yes here and still has no coach_athletes row for
  // themselves, so they can never reach their own schedule/check-in/
  // coaching tools. becomeSelfCoach() is deliberately idempotent and
  // already skips its own permission-grant step here since isPrivateCoach
  // is already true -- see its own header comment.
  //
  // "No, coaching only" deliberately leaves any existing self-coach
  // relationship untouched: this prompt is a "do you also train" display
  // preference, not an "undo self-coaching" control, and silently
  // deactivating that relationship here could hide real schedule/workout
  // history a coach already built up for themselves.
  if (trainsSelf) {
    const result = await becomeSelfCoach();
    if (result.error) return { error: result.error };
  }

  revalidatePath("/coaching");
  revalidatePath("/settings");
  return {};
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
    sex: formData.get("sex") || undefined,
    heightIn: formData.get("heightIn") || undefined,
    yearsRunning: formData.get("yearsRunning") || undefined,
    currentLevel: formData.get("currentLevel") || undefined,
    primaryEvent: formData.get("primaryEvent") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the values above." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: "Your session expired. Sign in again." };
  }

  const { error } = await supabase.from("athlete_profiles").upsert({
    user_id: userId,
    birth_year: parsed.data.birthYear,
    weight_kg: lbsToKg(parsed.data.weightLb),
    current_weekly_mileage: parsed.data.currentWeeklyMileage,
    running_days_per_week: parsed.data.daysPerWeek,
    sex: parsed.data.sex ?? null,
    height_cm: parsed.data.heightIn != null ? inToCm(parsed.data.heightIn) : null,
    years_running: parsed.data.yearsRunning ?? null,
    current_level: parsed.data.currentLevel ?? null,
    primary_event: parsed.data.primaryEvent || null,
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
    avatarUrl: formData.get("avatarUrl"),
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
    return { error: "Your session expired. Sign in again." };
  }

  // avatar_url lives on profiles (shared with the contributor profile),
  // not community_profiles -- two separate writes, not one row.
  const [{ error }, { error: avatarError }] = await Promise.all([
    supabase.from("community_profiles").upsert({
      user_id: userId,
      bio: parsed.data.bio,
      location: parsed.data.location,
      favorite_distances: parsed.data.favoriteDistances,
    }),
    supabase.from("profiles").update({ avatar_url: parsed.data.avatarUrl || null }).eq("id", userId),
  ]);

  if (error) return { error: error.message };
  if (avatarError) return { error: avatarError.message };

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
    return { error: "Your session expired. Sign in again." };
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
    return { error: "Your session expired. Sign in again." };
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

export type InjuryFormState = { error?: string; success?: boolean };

export async function addInjury(
  _prevState: InjuryFormState,
  formData: FormData,
): Promise<InjuryFormState> {
  const parsed = injurySchema.safeParse({
    injuryType: formData.get("injuryType"),
    bodyPart: formData.get("bodyPart"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    severity: formData.get("severity"),
    affectsTraining: formData.get("affectsTraining"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your injury details" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.from("injuries").insert({
    user_id: userId,
    injury_type: parsed.data.injuryType,
    body_part: parsed.data.bodyPart,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate || null,
    severity: parsed.data.severity,
    affects_training: parsed.data.affectsTraining,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function updateInjury(
  _prevState: InjuryFormState,
  formData: FormData,
): Promise<InjuryFormState> {
  const injuryId = formData.get("injuryId");
  if (typeof injuryId !== "string" || !injuryId) return { error: "Missing injury" };

  const parsed = injurySchema.safeParse({
    injuryType: formData.get("injuryType"),
    bodyPart: formData.get("bodyPart"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    severity: formData.get("severity"),
    affectsTraining: formData.get("affectsTraining"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your injury details" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("injuries")
    .update({
      injury_type: parsed.data.injuryType,
      body_part: parsed.data.bodyPart,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate || null,
      severity: parsed.data.severity,
      affects_training: parsed.data.affectsTraining,
      notes: parsed.data.notes || null,
    })
    .eq("id", injuryId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteInjury(injuryId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  await supabase.from("injuries").delete().eq("id", injuryId).eq("user_id", userId);

  revalidatePath("/settings");
}

export type UpdateFitnessEstimateState = {
  error?: string;
  success?: boolean;
};

// "Your current 5K estimate," a single mutable value per reference_key --
// see athlete_fitness_estimates' own migration comment for why this is an
// upsert, not an ever-growing history list. Distinct from race_results:
// this is a self-reported CURRENT fitness estimate, not a completed race,
// and it's what any Program-assigned pace-percent day/step (e.g. "90-92%
// MP") resolves against live, every time it's read -- updating it here is
// reflected in every not-yet-completed workout automatically, without
// touching anything already completed.
export async function updateFitnessEstimate(
  _prevState: UpdateFitnessEstimateState,
  formData: FormData,
): Promise<UpdateFitnessEstimateState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Not signed in." };

  const referenceKey = formData.get("referenceKey");
  if (referenceKey !== "5k" && referenceKey !== "marathon") {
    return { error: "Pick a valid distance." };
  }
  const estimatedTimeS = parseTimeToSeconds(String(formData.get("estimatedTimeInput") ?? ""));
  if (estimatedTimeS === null || estimatedTimeS <= 0) {
    return { error: "Enter your estimate as mm:ss or h:mm:ss." };
  }

  const { error } = await supabase.from("athlete_fitness_estimates").upsert(
    {
      athlete_id: userId,
      reference_key: referenceKey,
      estimated_time_s: estimatedTimeS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,reference_key" },
  );
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteFitnessEstimate(referenceKey: "5k" | "marathon"): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  await supabase.from("athlete_fitness_estimates").delete().eq("athlete_id", userId).eq("reference_key", referenceKey);

  revalidatePath("/settings");
}
