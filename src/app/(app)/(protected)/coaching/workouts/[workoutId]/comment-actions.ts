"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createNotification } from "@/lib/notifications/create-notification";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";

export type AddCommentState = { error?: string };

// Kept attached to the workout it's about (see workout_comments' own RLS --
// either party on the scheduled_workouts row can read/post) rather than
// routed through the general coach<->athlete message thread, matching the
// product brief's own "can I move Thursday's workout" example: the
// question should be visible right next to the workout in question, not
// buried in a separate inbox.
export async function addWorkoutComment(
  scheduledWorkoutId: string,
  _prevState: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase.from("workout_comments").insert({
    scheduled_workout_id: scheduledWorkoutId,
    author_id: session.userId,
    body,
  });
  if (error) return { error: error.message };

  const { data: workout } = await supabase
    .from("scheduled_workouts")
    .select("coach_id, athlete_id, title, day_label")
    .eq("id", scheduledWorkoutId)
    .maybeSingle<{ coach_id: string; athlete_id: string; title: string | null; day_label: string | null }>();
  if (workout) {
    const recipientId = session.userId === workout.coach_id ? workout.athlete_id : workout.coach_id;
    const displayLabel = getWorkoutDisplayLabel(workout.day_label, workout.title);
    // Only worth naming the commenter when the recipient is the coach --
    // a coach with several athletes can't tell whose workout a bare "New
    // comment on <label>" is about, but an athlete only has one coach, so
    // there's no equivalent ambiguity on that side.
    let content = `New comment on ${displayLabel}`;
    if (recipientId === workout.coach_id) {
      const { data: athleteProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", workout.athlete_id)
        .maybeSingle<{ display_name: string }>();
      content = `${athleteProfile?.display_name ?? "An athlete"} commented on ${displayLabel}`;
    }
    await createNotification({
      userId: recipientId,
      type: "workout_comment",
      content,
      relatedEntityId: scheduledWorkoutId,
    });
  }

  revalidatePath(`/coaching/workouts/${scheduledWorkoutId}`);
  return {};
}
