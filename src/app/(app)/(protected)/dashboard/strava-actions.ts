"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { fetchRecentActivities, refreshStravaToken } from "@/lib/strava/client";
import { activityLocalDate, clusterActivitiesByStartTime, combineActivities, isRunningActivity, mapToWorkoutCompletion } from "@/lib/strava/map-activity";
import type { StravaActivity } from "@/lib/strava/types";

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
  const leftoverActivities: StravaActivity[] = [];
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

    if (workout || groupWorkout) {
      const { error } = await supabase.from("workout_completions").insert({
        ...(workout ? { workout_id: workout.id } : { group_plan_workout_id: groupWorkout!.id }),
        user_id: userId,
        ...mapToWorkoutCompletion(activity),
      });
      if (!error) syncedCount += 1;
      continue;
    }

    // Not matched to a self-serve or team workout -- a private-coaching
    // candidate, processed below once grouped by date, so a warmup/main
    // set/cooldown split across several Strava recordings on the same day
    // can be combined into one suggestion instead of competing separately
    // (see clusterActivitiesByStartTime below). Collected here rather than
    // handled inline so that grouping can see every leftover activity on
    // a date together, not one at a time.
    leftoverActivities.push(activity);
  }

  // Private coaching (Phase 8): a third, independent pipeline from the two
  // above (see the Phase 1 migration -- scheduled_workouts is deliberately
  // decoupled from both workouts and group_plan_workouts). Reuses this same
  // sync/token/matching machinery rather than a separate Strava integration
  // -- the abstraction the product brief asks for already exists one level
  // up, at connected_accounts.provider (garmin/strava/coros/apple_health);
  // a real Garmin provider would plug in here as its own fetch+map module
  // without touching this matching logic's shape, just what feeds it.
  //
  // Grouped by calendar date (not processed per-activity) specifically so
  // multiple same-date activities can be clustered by start time and
  // considered together -- a lone 6am run and a lone 6pm run on the same
  // date land in the same date-group but, if they're more than
  // COMBINE_WINDOW_SECONDS apart, still end up as two separate one-activity
  // clusters (and therefore two separate pending-match candidates), not one
  // false combination.
  const leftoverByDate = new Map<string, StravaActivity[]>();
  for (const activity of leftoverActivities) {
    const date = activityLocalDate(activity);
    const list = leftoverByDate.get(date);
    if (list) list.push(activity);
    else leftoverByDate.set(date, [activity]);
  }

  for (const [date, dateActivities] of leftoverByDate) {
    const { data: privateCoachingWorkouts } = await supabase
      .from("scheduled_workouts")
      .select("id")
      .eq("athlete_id", userId)
      .eq("scheduled_date", date)
      .not("published_at", "is", null)
      .limit(1);
    const privateCoachingWorkout = privateCoachingWorkouts?.[0];
    if (!privateCoachingWorkout) continue;

    const { data: existingCompletion } = await supabase
      .from("completed_workouts")
      .select("id")
      .eq("scheduled_workout_id", privateCoachingWorkout.id)
      .limit(1);
    if (existingCompletion && existingCompletion.length > 0) continue;

    // Deliberately does NOT write to completed_workouts (and so is never
    // visible to the coach, who can only ever see completed_workouts rows)
    // -- a Strava match only ever suggests data. It lands in
    // strava_pending_matches for the athlete to review and explicitly
    // approve (or dismiss) on the workout's own page; see
    // completion-actions.ts's approveStravaMatch/dismissStravaMatch.
    // Upserted (not inserted) so a re-sync before the athlete has acted
    // just refreshes an existing candidate's own data rather than erroring.
    // Keyed on (workout, the cluster's earliest activity) rather than
    // workout alone -- two unrelated runs on the same day both matching
    // the same scheduled workout used to collapse into a single row here
    // (whichever this loop processed last silently overwrote the other's
    // data before the athlete ever saw it); each distinct cluster now gets
    // to coexist as its own real candidate. dismissed_at is deliberately
    // never part of this payload, so ON CONFLICT DO UPDATE never
    // resurrects a candidate the athlete already said "not this one" to.
    for (const cluster of clusterActivitiesByStartTime(dateActivities)) {
      const combined = combineActivities(cluster);
      const { error: pendingError } = await supabase.from("strava_pending_matches").upsert(
        {
          scheduled_workout_id: privateCoachingWorkout.id,
          athlete_id: userId,
          strava_activity_id: combined.strava_activity_id,
          activity_name: combined.combinedActivities ? `${cluster.length} activities combined` : cluster[0].name,
          activity_distance_m: combined.actual_distance_m,
          activity_duration_s: combined.actual_time_s,
          activity_avg_hr: combined.avg_hr,
          activity_started_at: cluster[0].start_date_local,
          combined_activities: combined.combinedActivities,
        },
        { onConflict: "scheduled_workout_id,strava_activity_id" },
      );
      if (!pendingError) syncedCount += 1;
    }
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
