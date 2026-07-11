"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { fetchRecentActivities, refreshStravaToken } from "@/lib/strava/client";
import { activityLocalDate, isRunningActivity, mapToWorkoutCompletion } from "@/lib/strava/map-activity";

const DEFAULT_LOOKBACK_DAYS = 30; // first sync ever -- how far back to reach

export type SyncStravaState = { error?: string; syncedCount?: number };

// On-demand only (a "Sync now" button), not automatic -- matches every
// other athlete-initiated action in this app (generating a plan, marking a
// workout complete). Always refreshes the access token first rather than
// tracking its expiry separately: sync is low-frequency enough that the
// extra refresh call costs nothing, and Strava rotates the refresh token on
// every use, so the new pair has to be stored back regardless.
export async function syncStravaActivities(_prevState: SyncStravaState): Promise<SyncStravaState> {
  void _prevState; // required by useActionState's calling convention, unused here
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Your session expired -- sign in again." };

  const { data: account } = await supabase
    .from("connected_accounts")
    .select("id, refresh_token_encrypted, last_synced_at")
    .eq("provider", "strava")
    .maybeSingle();
  if (!account) return { error: "Connect Strava first." };

  let refreshed;
  try {
    refreshed = await refreshStravaToken(decryptToken(account.refresh_token_encrypted));
  } catch {
    return { error: "Couldn't refresh your Strava connection -- try reconnecting." };
  }

  await supabase
    .from("connected_accounts")
    .update({
      access_token_encrypted: encryptToken(refreshed.accessToken),
      refresh_token_encrypted: encryptToken(refreshed.refreshToken),
    })
    .eq("id", account.id);

  const afterUnixSeconds = account.last_synced_at
    ? Math.floor(new Date(account.last_synced_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - DEFAULT_LOOKBACK_DAYS * 86_400;

  let activities;
  try {
    activities = await fetchRecentActivities(refreshed.accessToken, afterUnixSeconds);
  } catch {
    return { error: "Couldn't fetch activities from Strava right now -- try again in a moment." };
  }

  // A team-connected athlete's schedule lives in group_plan_workouts, not
  // workouts (the self-serve individual-plan table) -- this account may
  // have neither, one, or (rarely, from a self-serve history predating a
  // team join) both. Looked up once per sync, not per activity.
  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  let groupPlanId: string | null = null;
  if (membership) {
    const { data: groupPlan } = await supabase
      .from("group_plans")
      .select("id")
      .eq("group_id", membership.group_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    groupPlanId = groupPlan?.id ?? null;
  }

  // v1 only matches training runs to an existing scheduled workout by date
  // -- races and unscheduled runs are a deliberate scope cut for now, not
  // silently dropped: the schema (and this dedup column) already supports
  // extending this later.
  let syncedCount = 0;
  for (const activity of activities.filter(isRunningActivity)) {
    const { data: existing } = await supabase
      .from("workout_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("strava_activity_id", activity.id)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const date = activityLocalDate(activity);

    const { data: scheduledWorkouts } = await supabase
      .from("workouts")
      .select("id")
      .eq("user_id", userId)
      .eq("scheduled_date", date)
      .limit(1);
    const workout = scheduledWorkouts?.[0];

    let groupWorkout: { id: string } | undefined;
    if (!workout && groupPlanId) {
      // Only matches published entries -- an athlete can't see an
      // unpublished one yet, so auto-matching a run to it would surface
      // something the coach hasn't released.
      const { data: groupWorkouts } = await supabase
        .from("group_plan_workouts")
        .select("id")
        .eq("group_plan_id", groupPlanId)
        .eq("scheduled_date", date)
        .not("published_at", "is", null)
        .limit(1);
      groupWorkout = groupWorkouts?.[0];
    }

    if (!workout && !groupWorkout) continue;

    const { error } = await supabase.from("workout_completions").insert({
      ...(workout ? { workout_id: workout.id } : { group_plan_workout_id: groupWorkout!.id }),
      user_id: userId,
      ...mapToWorkoutCompletion(activity),
    });
    if (!error) syncedCount += 1;
  }

  await supabase
    .from("connected_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", account.id);

  revalidatePath("/plan");
  return { syncedCount };
}

export async function disconnectStrava() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return;

  const { data: existing } = await supabase
    .from("connected_accounts")
    .select("access_token_encrypted")
    .eq("provider", "strava")
    .maybeSingle();

  if (existing?.access_token_encrypted) {
    try {
      const accessToken = decryptToken(existing.access_token_encrypted);
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken }),
      });
    } catch {
      // Best-effort revoke with Strava -- still remove our own record below
      // even if this fails (e.g. token already invalid).
    }
  }

  await supabase.from("connected_accounts").delete().eq("provider", "strava");
  revalidatePath("/dashboard");
}
