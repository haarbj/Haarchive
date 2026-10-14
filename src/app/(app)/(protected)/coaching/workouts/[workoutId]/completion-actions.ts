"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";
import { parseTimeToSeconds } from "@/lib/running-format";
import { MILE_METERS } from "@/lib/race-distances";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { EFFORT_LEVEL_VALUES } from "@/lib/private-coaching/effort-levels";

// Same string-input shape as the self-serve/team completion forms
// (completeWorkoutSchema in lib/validation/plan.ts) -- entered as free
// text ("6.2", "42:15"), parsed here, so this form matches how every other
// completion form in this app already asks for the same data.
const completeScheduledWorkoutSchema = z.object({
  scheduledWorkoutId: z.string().uuid(),
  actualDistanceInput: z.string().optional(),
  actualDurationInput: z.string().optional(),
  avgHeartRateInput: z.string().optional(),
  rpeInput: z.string().optional(),
  // Which intensity domain the athlete believes they actually ran in, and
  // the heat/wind/terrain/fatigue context behind any gap between the
  // prescribed pace and the real one. Together with rpe, this is what
  // lets a coach tell "the fitness estimate is wrong" apart from "it was
  // 90 degrees." Validated against the shared EFFORT_LEVELS vocabulary so
  // the stored value always matches a label the pacing guide explains.
  effortLevelInput: z.string().optional(),
  conditionsNotesInput: z.string().optional(),
  // Only ever asked for (and shown) when the coach scheduled a bare
  // cross-training day with no modality of their own already attached --
  // see CompletionForm's promptActivityType prop, set from page.tsx's own
  // isBareXt check. Free text, not a closed enum, same discipline as
  // day_label and the coach's own XT-modality picker.
  activityTypeInput: z.string().optional(),
  athleteNotesInput: z.string().optional(),
  painReported: z.boolean().optional().default(false),
  painNotesInput: z.string().optional(),
});

export type CompleteScheduledWorkoutInput = z.infer<typeof completeScheduledWorkoutSchema>;
export type CompleteWorkoutState = { error?: string; success?: boolean };

export async function completeScheduledWorkout(input: CompleteScheduledWorkoutInput): Promise<CompleteWorkoutState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const parsed = completeScheduledWorkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  // Same bounds already enforced by the team-product's own completeWorkout
  // (plan/actions.ts) -- this form was written without them, silently
  // accepting a negative distance/heart-rate or discarding an unparseable
  // duration as null instead of telling the athlete their input didn't
  // register.
  const actualDistanceM = data.actualDistanceInput?.trim()
    ? Math.round(Number(data.actualDistanceInput) * MILE_METERS)
    : null;
  if (actualDistanceM !== null && (Number.isNaN(actualDistanceM) || actualDistanceM <= 0)) {
    return { error: "Enter your distance as a number." };
  }

  const actualDurationS = data.actualDurationInput?.trim() ? parseTimeToSeconds(data.actualDurationInput) : null;
  if (data.actualDurationInput?.trim() && actualDurationS === null) {
    return { error: "Enter your time as mm:ss or h:mm:ss." };
  }

  const avgHr = data.avgHeartRateInput?.trim() ? Math.round(Number(data.avgHeartRateInput)) : null;
  if (avgHr !== null && (Number.isNaN(avgHr) || avgHr <= 0)) {
    return { error: "Enter your average heart rate as a number." };
  }

  const rpe = data.rpeInput?.trim() ? Math.round(Number(data.rpeInput)) : null;
  if (rpe !== null && (rpe < 1 || rpe > 10)) return { error: "RPE must be between 1 and 10." };

  const effortLevel = data.effortLevelInput?.trim() || null;
  if (effortLevel !== null && !EFFORT_LEVEL_VALUES.includes(effortLevel)) {
    return { error: "Pick an effort level from the list." };
  }

  const activityType = data.activityTypeInput?.trim() || null;

  const supabase = await createClient();
  // completed_workouts_all_own's own with-check already enforces
  // athlete_id = auth.uid() -- this insert can't be made to belong to
  // anyone else regardless of what scheduledWorkoutId points at.
  const { data: workout } = await supabase
    .from("scheduled_workouts")
    .select("id, coach_id, athlete_id, title, day_label")
    .eq("id", data.scheduledWorkoutId)
    .maybeSingle<{ id: string; coach_id: string; athlete_id: string; title: string | null; day_label: string | null }>();
  if (!workout || workout.athlete_id !== session.userId) return { error: "That workout isn't yours to complete." };

  // This action now also handles editing an already-completed workout
  // (CompletionForm's hasExisting path, including a Strava-approved
  // completion), so it can't unconditionally notify the coach on every
  // submit -- that would re-fire "X completed <workout>" on every RPE
  // tweak. Only notify for what's actually new: a first-time completion,
  // or pain reported for the first time.
  const { data: existingCompletion } = await supabase
    .from("completed_workouts")
    .select("id, pain_reported")
    .eq("scheduled_workout_id", data.scheduledWorkoutId)
    .maybeSingle<{ id: string; pain_reported: boolean }>();
  const isFirstCompletion = !existingCompletion;
  const isNewlyReportedPain = (data.painReported ?? false) && !(existingCompletion?.pain_reported ?? false);

  const { error: upsertError } = await supabase.from("completed_workouts").upsert(
    {
      scheduled_workout_id: data.scheduledWorkoutId,
      athlete_id: session.userId,
      actual_distance_m: actualDistanceM,
      actual_duration_s: actualDurationS,
      avg_hr: avgHr,
      rpe,
      effort_level: effortLevel,
      conditions_notes: data.conditionsNotesInput?.trim() || null,
      activity_type: activityType,
      pain_reported: data.painReported ?? false,
      pain_notes: data.painNotesInput?.trim() || null,
      athlete_notes: data.athleteNotesInput?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scheduled_workout_id" },
  );
  if (upsertError) return { error: upsertError.message };

  // scheduled_workouts has no athlete UPDATE policy at all (only the
  // authoring coach can write to it -- see the Phase 1 migration; an
  // athlete-writable policy there would also let them rewrite the coach's
  // own title/notes, not just status). workout.athlete_id was already
  // confirmed to be the caller via the RLS-scoped read above, so this
  // narrow, already-authorized status flip is safe via the service-role
  // client -- the one legitimate reason to reach for it from an athlete-
  // initiated action.
  const admin = createServiceRoleClient();
  await admin.from("scheduled_workouts").update({ status: "completed" }).eq("id", data.scheduledWorkoutId);

  // A coach with more than one athlete can't tell who a bare "<workout
  // title> -- completed" notification is about -- caught live on staging
  // (same fix as checkin/actions.ts). session.userId === workout.athlete_id
  // was already confirmed above, so profiles_select_own covers this read.
  const { data: athleteProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle<{ display_name: string }>();
  const athleteName = athleteProfile?.display_name ?? "An athlete";

  if (isFirstCompletion) {
    await createNotification({
      userId: workout.coach_id,
      type: "workout_completed",
      content: `${athleteName} completed ${getWorkoutDisplayLabel(workout.day_label, workout.title)}`,
      relatedEntityId: workout.id,
    });
    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "workout_completed",
      entity_type: "scheduled_workouts",
      entity_id: workout.id,
      metadata: { pain_reported: data.painReported ?? false },
    });
  }
  if (isNewlyReportedPain) {
    await createNotification({
      userId: workout.coach_id,
      type: "pain_reported",
      content: `${athleteName} reported pain on ${getWorkoutDisplayLabel(workout.day_label, workout.title)}`,
      relatedEntityId: workout.id,
    });
    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "pain_reported",
      entity_type: "scheduled_workouts",
      entity_id: workout.id,
      metadata: {},
    });
  }

  revalidatePath(`/coaching/workouts/${data.scheduledWorkoutId}`);
  return { success: true };
}

type PendingMatchRow = {
  id: string;
  strava_activity_id: number;
  activity_distance_m: number | null;
  activity_duration_s: number | null;
  activity_avg_hr: number | null;
};

// The athlete's explicit consent step for a Strava-suggested match (see
// strava-actions.ts's private-coaching branch, which only ever writes to
// strava_pending_matches, never completed_workouts, for exactly this
// reason). Approving is what actually creates the completion a coach can
// see -- everything below mirrors completeScheduledWorkout's own
// completion+notification+audit shape so a Strava-approved completion
// behaves identically to a manually-logged one from here on, including
// being editable afterward via the same form. Takes the specific
// pendingMatchId (not just the workout) since more than one candidate can
// exist for the same workout now (two runs on the same day both matching
// it) -- see the strava-multi-candidate migration.
export async function approveStravaMatch(scheduledWorkoutId: string, pendingMatchId: string): Promise<CompleteWorkoutState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("strava_pending_matches")
    .select("id, strava_activity_id, activity_distance_m, activity_duration_s, activity_avg_hr")
    .eq("id", pendingMatchId)
    .eq("scheduled_workout_id", scheduledWorkoutId)
    .eq("athlete_id", session.userId)
    .maybeSingle<PendingMatchRow>();
  if (!pending) return { error: "No Strava match to approve." };

  const { data: workout } = await supabase
    .from("scheduled_workouts")
    .select("id, coach_id, athlete_id, title, day_label")
    .eq("id", scheduledWorkoutId)
    .maybeSingle<{ id: string; coach_id: string; athlete_id: string; title: string | null; day_label: string | null }>();
  if (!workout || workout.athlete_id !== session.userId) return { error: "That workout isn't yours to complete." };

  const { error: upsertError } = await supabase.from("completed_workouts").upsert(
    {
      scheduled_workout_id: scheduledWorkoutId,
      athlete_id: session.userId,
      actual_distance_m: pending.activity_distance_m,
      actual_duration_s: pending.activity_duration_s,
      avg_hr: pending.activity_avg_hr,
      strava_activity_id: pending.strava_activity_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scheduled_workout_id" },
  );
  if (upsertError) return { error: upsertError.message };

  // Approving one candidate settles the question for this workout --
  // remove every candidate on file for it (not just the approved one),
  // so a second real candidate from the same day (see the multi-candidate
  // migration) doesn't linger as a stale "is this the one?" prompt on a
  // workout that's already complete.
  await supabase.from("strava_pending_matches").delete().eq("scheduled_workout_id", scheduledWorkoutId);

  const admin = createServiceRoleClient();
  await admin.from("scheduled_workouts").update({ status: "completed" }).eq("id", scheduledWorkoutId);

  const { data: athleteProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", session.userId)
    .maybeSingle<{ display_name: string }>();
  const athleteName = athleteProfile?.display_name ?? "An athlete";

  await createNotification({
    userId: workout.coach_id,
    type: "workout_completed",
    content: `${athleteName} completed ${getWorkoutDisplayLabel(workout.day_label, workout.title)} (via Strava)`,
    relatedEntityId: workout.id,
  });

  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "workout_completed",
    entity_type: "scheduled_workouts",
    entity_id: workout.id,
    metadata: { source: "strava", strava_activity_id: pending.strava_activity_id },
  });

  revalidatePath(`/coaching/workouts/${scheduledWorkoutId}`);
  return { success: true };
}

// Soft-dismisses just the one candidate the athlete said "not this one"
// to (not the whole row set for the workout) -- a hard delete here used
// to wipe out the athlete's only candidate the moment they rejected it,
// even when a second real candidate genuinely existed (two runs on the
// same day both matching this workout). Leaving any OTHER, still-live
// candidate for this workout in place is what lets the athlete get asked
// about it next, instead of the review UI just disappearing.
export async function dismissStravaMatch(scheduledWorkoutId: string, pendingMatchId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("strava_pending_matches")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", pendingMatchId)
    .eq("scheduled_workout_id", scheduledWorkoutId)
    .eq("athlete_id", session.userId);
  if (error) return { error: error.message };

  revalidatePath(`/coaching/workouts/${scheduledWorkoutId}`);
  return {};
}

export async function deleteWorkoutCompletion(scheduledWorkoutId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const supabase = await createClient();
  // .select() on the delete so a zero-row match is actually observable --
  // a plain .delete() that matches nothing returns no error either way, so
  // without this, the unconditional service-role write below would have
  // run for ANY scheduledWorkoutId any signed-in user passed in, regardless
  // of whether they owned a completion on it at all (caught in the pre-
  // apply security audit: this let any authenticated user revert an
  // arbitrary workout's status to "scheduled" with no ownership check
  // whatsoever).
  const { data: deleted, error } = await supabase
    .from("completed_workouts")
    .delete()
    .eq("scheduled_workout_id", scheduledWorkoutId)
    .eq("athlete_id", session.userId)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) return { error: "Nothing to undo." };

  // Same service-role reasoning as completeScheduledWorkout above -- the
  // delete above just proved the caller owned that completion, so
  // reverting the parent workout's status is safe here too.
  const admin = createServiceRoleClient();
  await admin.from("scheduled_workouts").update({ status: "scheduled" }).eq("id", scheduledWorkoutId);

  revalidatePath(`/coaching/workouts/${scheduledWorkoutId}`);
  return {};
}
