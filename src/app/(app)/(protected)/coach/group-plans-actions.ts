"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import type { WorkoutType } from "@/lib/coaching-engine";

export type ActionState = { error?: string };

// Idempotent -- called whenever a coach opens a group's schedule for a
// season, creating the group_plans row on first visit rather than
// requiring a separate explicit "set up this group" step.
export async function ensureGroupPlan(seasonId: string, groupId: string): Promise<{ groupPlanId?: string; error?: string }> {
  const session = await getAppSession();
  if (session?.role !== "coach" || !session.teamId) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("group_plans")
    .select("id")
    .eq("season_plan_id", seasonId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (existing) return { groupPlanId: existing.id };

  const { data: created, error } = await supabase
    .from("group_plans")
    .insert({ team_id: session.teamId, season_plan_id: seasonId, group_id: groupId })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Couldn't set up this group's schedule." };
  return { groupPlanId: created.id };
}

// Reveals a group's schedule to its athletes -- generated/edited content
// stays invisible to them until the coach explicitly publishes it.
export async function publishGroupPlan(groupPlanId: string): Promise<ActionState> {
  const session = await getAppSession();
  if (session?.role !== "coach") return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("group_plans")
    .update({ published_at: new Date().toISOString() })
    .eq("id", groupPlanId);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  revalidatePath("/plan");
  return {};
}

export async function unpublishGroupPlan(groupPlanId: string): Promise<ActionState> {
  const session = await getAppSession();
  if (session?.role !== "coach") return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("group_plans").update({ published_at: null }).eq("id", groupPlanId);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  revalidatePath("/plan");
  return {};
}

export type WorkoutInput = {
  id?: string;
  groupPlanId: string;
  seasonPhaseId: string | null;
  scheduledDate: string;
  timeOfDay: string | null;
  location: string | null;
  description: string;
  secondaryActivity: string | null;
  workoutType: WorkoutType | null;
  distanceM: number | null;
  paceFastSecPerMile: number | null;
  paceSlowSecPerMile: number | null;
  isRace: boolean;
  notes: string | null;
};

export async function upsertGroupPlanWorkout(input: WorkoutInput): Promise<ActionState> {
  const session = await getAppSession();
  if (session?.role !== "coach" || !session.teamId) return { error: "Not authorized." };
  if (!input.description.trim()) return { error: "Enter a description for this session." };

  const supabase = await createClient();
  const row = {
    team_id: session.teamId,
    group_plan_id: input.groupPlanId,
    season_phase_id: input.seasonPhaseId,
    scheduled_date: input.scheduledDate,
    time_of_day: input.timeOfDay,
    location: input.location,
    description: input.description.trim(),
    secondary_activity: input.secondaryActivity,
    workout_type: input.workoutType,
    distance_m: input.distanceM,
    pace_fast_sec_per_mile: input.paceFastSecPerMile,
    pace_slow_sec_per_mile: input.paceSlowSecPerMile,
    is_race: input.isRace,
    notes: input.notes,
  };

  const { error } = input.id
    ? await supabase.from("group_plan_workouts").update(row).eq("id", input.id)
    : await supabase.from("group_plan_workouts").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  return {};
}

export async function deleteGroupPlanWorkout(workoutId: string): Promise<ActionState> {
  const session = await getAppSession();
  if (session?.role !== "coach") return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("group_plan_workouts").delete().eq("id", workoutId);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  return {};
}

// Copies one workout entry (as-is) into one or more other groups' plans for
// the same date -- covers meet days and "All" sessions that apply across
// groups without the coach re-typing the same entry for each one.
export async function copyWorkoutToGroups(
  workoutId: string,
  seasonId: string,
  targetGroupIds: string[],
): Promise<ActionState> {
  const session = await getAppSession();
  if (session?.role !== "coach" || !session.teamId) return { error: "Not authorized." };
  if (targetGroupIds.length === 0) return { error: "Pick at least one group to copy to." };

  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("group_plan_workouts")
    .select("*")
    .eq("id", workoutId)
    .single();
  if (sourceError || !source) return { error: sourceError?.message ?? "Couldn't find that entry." };

  for (const groupId of targetGroupIds) {
    const { groupPlanId, error: ensureError } = await ensureGroupPlan(seasonId, groupId);
    if (ensureError || !groupPlanId) return { error: ensureError ?? "Couldn't set up the target group." };

    const { error: insertError } = await supabase.from("group_plan_workouts").insert({
      team_id: session.teamId,
      group_plan_id: groupPlanId,
      season_phase_id: source.season_phase_id,
      scheduled_date: source.scheduled_date,
      time_of_day: source.time_of_day,
      location: source.location,
      description: source.description,
      secondary_activity: source.secondary_activity,
      workout_type: source.workout_type,
      distance_m: source.distance_m,
      pace_fast_sec_per_mile: source.pace_fast_sec_per_mile,
      pace_slow_sec_per_mile: source.pace_slow_sec_per_mile,
      is_race: source.is_race,
      notes: source.notes,
    });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/coach/seasons", "layout");
  return {};
}

// Clones every entry in [weekStartDate, weekEndDate] from the source
// group's plan into the target group's plan -- a starting point the coach
// then edits/deletes directly (e.g. delete the Saturday entry, bump every
// time by 15 minutes) rather than an abstract "same but different" delta.
export async function duplicateWeekToGroup(
  sourceGroupPlanId: string,
  weekStartDate: string,
  weekEndDate: string,
  seasonId: string,
  targetGroupId: string,
): Promise<ActionState> {
  const session = await getAppSession();
  if (session?.role !== "coach" || !session.teamId) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: sourceWorkouts, error: sourceError } = await supabase
    .from("group_plan_workouts")
    .select("*")
    .eq("group_plan_id", sourceGroupPlanId)
    .gte("scheduled_date", weekStartDate)
    .lte("scheduled_date", weekEndDate);
  if (sourceError) return { error: sourceError.message };
  if (!sourceWorkouts || sourceWorkouts.length === 0) return { error: "Nothing to duplicate in that week yet." };

  const { groupPlanId, error: ensureError } = await ensureGroupPlan(seasonId, targetGroupId);
  if (ensureError || !groupPlanId) return { error: ensureError ?? "Couldn't set up the target group." };

  const { error: insertError } = await supabase.from("group_plan_workouts").insert(
    sourceWorkouts.map((source) => ({
      team_id: session.teamId,
      group_plan_id: groupPlanId,
      season_phase_id: source.season_phase_id,
      scheduled_date: source.scheduled_date,
      time_of_day: source.time_of_day,
      location: source.location,
      description: source.description,
      secondary_activity: source.secondary_activity,
      workout_type: source.workout_type,
      distance_m: source.distance_m,
      pace_fast_sec_per_mile: source.pace_fast_sec_per_mile,
      pace_slow_sec_per_mile: source.pace_slow_sec_per_mile,
      is_race: source.is_race,
      notes: source.notes,
    })),
  );
  if (insertError) return { error: insertError.message };

  revalidatePath("/coach/seasons", "layout");
  return {};
}
