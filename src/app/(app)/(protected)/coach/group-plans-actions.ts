"use server";

import { APICallError, generateText } from "ai";
import { revalidatePath } from "next/cache";

import { buildGroupWorkoutExplanationPrompt } from "@/lib/ai/group-workout-explanation";
import { coachModel } from "@/lib/ai/model";
import { createClient } from "@/lib/db/server";
import { getAppSession } from "@/lib/auth/session";
import type { WorkoutType } from "@/lib/coaching-engine";

export type ActionState = { error?: string };

// Idempotent -- called whenever a coach opens a group's schedule for a
// season, creating the group_plans row on first visit rather than
// requiring a separate explicit "set up this group" step.
export async function ensureGroupPlan(seasonId: string, groupId: string): Promise<{ groupPlanId?: string; error?: string }> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };

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
    .insert({ team_id: session.coachTeamId, season_plan_id: seasonId, group_id: groupId })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Couldn't set up this group's schedule." };
  return { groupPlanId: created.id };
}

// Every group's plans for a season, so publish actions can cascade across
// all of them -- a coach who builds JV/Frosh and Varsity together
// shouldn't have to click publish twice for the same week.
async function allGroupPlanIdsForSeason(supabase: Awaited<ReturnType<typeof createClient>>, seasonId: string): Promise<string[]> {
  const { data } = await supabase.from("group_plans").select("id").eq("season_plan_id", seasonId);
  return (data ?? []).map((p) => p.id);
}

// Reveals one specific week to its athletes -- publishing is per-entry, not
// per-plan, so a coach can finalize and reveal this week without being
// forced to also publish months of not-yet-settled weeks ahead of it.
// Season-wide (not per-group): groups in the same season are usually built
// and finalized together, so publishing one group's week publishes every
// other group's entries for that same date range too.
export async function publishWeek(seasonId: string, weekStartDate: string, weekEndDate: string): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const groupPlanIds = await allGroupPlanIdsForSeason(supabase, seasonId);
  if (groupPlanIds.length === 0) return {};
  const { error } = await supabase
    .from("group_plan_workouts")
    .update({ published_at: new Date().toISOString() })
    .in("group_plan_id", groupPlanIds)
    .gte("scheduled_date", weekStartDate)
    .lte("scheduled_date", weekEndDate);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  revalidatePath("/plan");
  return {};
}

export async function unpublishWeek(seasonId: string, weekStartDate: string, weekEndDate: string): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const groupPlanIds = await allGroupPlanIdsForSeason(supabase, seasonId);
  if (groupPlanIds.length === 0) return {};
  const { error } = await supabase
    .from("group_plan_workouts")
    .update({ published_at: null })
    .in("group_plan_id", groupPlanIds)
    .gte("scheduled_date", weekStartDate)
    .lte("scheduled_date", weekEndDate);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  revalidatePath("/plan");
  return {};
}

// Convenience for "just publish everything so far" -- publishes every
// not-yet-published entry across every group in the season, regardless of
// week, matching publishWeek/unpublishWeek's season-wide scope.
export async function publishAllWeeks(seasonId: string): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const groupPlanIds = await allGroupPlanIdsForSeason(supabase, seasonId);
  if (groupPlanIds.length === 0) return {};
  const { error } = await supabase
    .from("group_plan_workouts")
    .update({ published_at: new Date().toISOString() })
    .in("group_plan_id", groupPlanIds)
    .is("published_at", null);
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
  durationMin: number | null;
  distanceM: number | null;
  paceFastSecPerMile: number | null;
  paceSlowSecPerMile: number | null;
  isRace: boolean;
  notes: string | null;
  explanation: string | null;
};

export async function upsertGroupPlanWorkout(input: WorkoutInput): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };
  if (!input.description.trim()) return { error: "Enter a description for this session." };

  const supabase = await createClient();
  const row = {
    team_id: session.coachTeamId,
    group_plan_id: input.groupPlanId,
    season_phase_id: input.seasonPhaseId,
    scheduled_date: input.scheduledDate,
    time_of_day: input.timeOfDay,
    location: input.location,
    description: input.description.trim(),
    secondary_activity: input.secondaryActivity,
    workout_type: input.workoutType,
    duration_min: input.durationMin,
    distance_m: input.distanceM,
    pace_fast_sec_per_mile: input.paceFastSecPerMile,
    pace_slow_sec_per_mile: input.paceSlowSecPerMile,
    is_race: input.isRace,
    notes: input.notes,
    explanation: input.explanation,
  };

  const { error } = input.id
    ? await supabase.from("group_plan_workouts").update(row).eq("id", input.id)
    : await supabase.from("group_plan_workouts").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  return {};
}

// Fills the explanation textarea for the coach to review/edit/clear before
// saving -- never called automatically, and never shown to an athlete
// until the coach explicitly keeps it and saves.
export async function generateWorkoutExplanation(
  description: string,
  workoutType: string | null,
  seasonPhaseId: string | null,
): Promise<{ explanation?: string; error?: string }> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };
  if (!description.trim()) return { error: "Add a description first." };

  const supabase = await createClient();
  let phaseDisplayName: string | null = null;
  let phasePrimaryGoal: string | null = null;
  if (seasonPhaseId) {
    const { data: phase } = await supabase
      .from("season_phases")
      .select("display_name, primary_goal")
      .eq("id", seasonPhaseId)
      .maybeSingle();
    phaseDisplayName = phase?.display_name ?? null;
    phasePrimaryGoal = phase?.primary_goal ?? null;
  }

  const prompt = buildGroupWorkoutExplanationPrompt({ description, workoutType, phaseDisplayName, phasePrimaryGoal });

  try {
    const result = await generateText({ model: coachModel, prompt });
    return { explanation: result.text.trim() };
  } catch (err) {
    const isRateLimited = err instanceof APICallError && err.statusCode === 429;
    return {
      error: isRateLimited
        ? "Getting a lot of requests right now -- try again in a minute, or just write it yourself."
        : "Couldn't generate an explanation right now -- try again, or just write it yourself.",
    };
  }
}

// Create-only: inserts the same entry into the primary group's plan plus
// any additional groups selected in the form, in one submission -- the
// "vertical row spanning several groups" case (a meet, an "All" session)
// without create-then-separately-copy. Each group ends up with its own
// independent row (matches copyWorkoutToGroups), not one row shared across
// groups, so publish state and later edits stay per-group.
export async function createWorkoutForGroups(
  input: WorkoutInput,
  seasonId: string,
  additionalGroupIds: string[],
): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };
  if (!input.description.trim()) return { error: "Enter a description for this session." };

  const supabase = await createClient();
  const baseRow = {
    team_id: session.coachTeamId,
    season_phase_id: input.seasonPhaseId,
    scheduled_date: input.scheduledDate,
    time_of_day: input.timeOfDay,
    location: input.location,
    description: input.description.trim(),
    secondary_activity: input.secondaryActivity,
    workout_type: input.workoutType,
    duration_min: input.durationMin,
    distance_m: input.distanceM,
    pace_fast_sec_per_mile: input.paceFastSecPerMile,
    pace_slow_sec_per_mile: input.paceSlowSecPerMile,
    is_race: input.isRace,
    notes: input.notes,
    explanation: input.explanation,
  };

  const { error: primaryError } = await supabase
    .from("group_plan_workouts")
    .insert({ ...baseRow, group_plan_id: input.groupPlanId });
  if (primaryError) return { error: primaryError.message };

  for (const groupId of additionalGroupIds) {
    const { groupPlanId, error: ensureError } = await ensureGroupPlan(seasonId, groupId);
    if (ensureError || !groupPlanId) return { error: ensureError ?? "Couldn't set up an additional group's schedule." };
    const { error: insertError } = await supabase
      .from("group_plan_workouts")
      .insert({ ...baseRow, group_plan_id: groupPlanId });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/coach/seasons", "layout");
  return {};
}

// Create-only: inserts the same entry on the given date plus the same
// weekday in every later week of the current phase -- the actual point of
// friction a coach hits repeatedly ("easy 30 min" every Monday for a whole
// phase), which nothing else in this file addresses (copyWorkoutToGroups
// repeats across groups on one date; this repeats across dates in one
// group). Each week gets its own independent row, editable/deletable on
// its own afterward, same as every other bulk-insert path here.
export async function createRepeatingWorkout(
  input: WorkoutInput,
  additionalDates: string[],
): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };
  if (!input.description.trim()) return { error: "Enter a description for this session." };

  const supabase = await createClient();
  const baseRow = {
    team_id: session.coachTeamId,
    group_plan_id: input.groupPlanId,
    season_phase_id: input.seasonPhaseId,
    time_of_day: input.timeOfDay,
    location: input.location,
    description: input.description.trim(),
    secondary_activity: input.secondaryActivity,
    workout_type: input.workoutType,
    duration_min: input.durationMin,
    distance_m: input.distanceM,
    pace_fast_sec_per_mile: input.paceFastSecPerMile,
    pace_slow_sec_per_mile: input.paceSlowSecPerMile,
    is_race: input.isRace,
    notes: input.notes,
    explanation: input.explanation,
  };

  const { error } = await supabase.from("group_plan_workouts").insert(
    [input.scheduledDate, ...additionalDates].map((scheduled_date) => ({ ...baseRow, scheduled_date })),
  );
  if (error) return { error: error.message };

  revalidatePath("/coach/seasons", "layout");
  return {};
}

export async function deleteGroupPlanWorkout(workoutId: string): Promise<ActionState> {
  const session = await getAppSession();
  if (!session?.isCoach) return { error: "Not authorized." };

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
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };
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
      team_id: session.coachTeamId,
      group_plan_id: groupPlanId,
      season_phase_id: source.season_phase_id,
      scheduled_date: source.scheduled_date,
      time_of_day: source.time_of_day,
      location: source.location,
      description: source.description,
      secondary_activity: source.secondary_activity,
      workout_type: source.workout_type,
      duration_min: source.duration_min,
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
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };

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
      team_id: session.coachTeamId,
      group_plan_id: groupPlanId,
      season_phase_id: source.season_phase_id,
      scheduled_date: source.scheduled_date,
      time_of_day: source.time_of_day,
      location: source.location,
      description: source.description,
      secondary_activity: source.secondary_activity,
      workout_type: source.workout_type,
      duration_min: source.duration_min,
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
