"use server";

// Server actions for on-demand, per-activity Strava lookups -- separate
// from dashboard/strava-actions.ts (which syncs activity summaries into
// the training plan in bulk) since these are read-only, athlete-initiated
// lookups callable from any page, not a dashboard-specific write flow.
// Originally just the Environmental Performance Calculator's "import from
// Strava" course source; now also backs the aerobic-decoupling check,
// since both need the same one-activity streams fetch and token-refresh
// pattern. Always refreshes the token first rather than tracking expiry
// separately, since either use is low-frequency either way.

import { createClient } from "@/lib/db/server";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { computeAerobicDecoupling, type DecouplingResult } from "@/lib/aerobic-decoupling";
import { fetchActivityStreams, fetchRecentActivities, refreshStravaToken } from "@/lib/strava/client";
import { activityLocalDate, isRunningActivity } from "@/lib/strava/map-activity";
import { stravaStreamsToRoute } from "@/lib/route-import/parse-strava";
import type { ParsedRoute } from "@/lib/route-import/types";

const ACTIVITY_LIST_LOOKBACK_DAYS = 90;

export type StravaActivitySummary = {
  id: number;
  name: string;
  date: string;
  /** Full local start time, ISO 8601 -- passed through to fetchActivityRoute so the imported route carries a real "when," not just elapsed seconds. */
  startTimeIso: string;
  distanceM: number;
  movingTimeS: number;
};

type ActionResult<T> = T | { error: string };

async function getRefreshedAccessToken(): Promise<ActionResult<{ accessToken: string }>> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Your session expired -- sign in again." };

  const { data: account } = await supabase
    .from("connected_accounts")
    .select("id, refresh_token_encrypted")
    .eq("provider", "strava")
    .maybeSingle();
  if (!account) return { error: "Connect Strava first, from your dashboard." };

  try {
    const refreshed = await refreshStravaToken(decryptToken(account.refresh_token_encrypted));
    await supabase
      .from("connected_accounts")
      .update({
        access_token_encrypted: encryptToken(refreshed.accessToken),
        refresh_token_encrypted: encryptToken(refreshed.refreshToken),
      })
      .eq("id", account.id);
    return { accessToken: refreshed.accessToken };
  } catch {
    return { error: "Couldn't refresh your Strava connection -- try reconnecting from your dashboard." };
  }
}

export async function listRecentRunActivities(): Promise<ActionResult<{ activities: StravaActivitySummary[] }>> {
  const tokenResult = await getRefreshedAccessToken();
  if ("error" in tokenResult) return tokenResult;

  const afterUnixSeconds = Math.floor(Date.now() / 1000) - ACTIVITY_LIST_LOOKBACK_DAYS * 86_400;
  try {
    const activities = await fetchRecentActivities(tokenResult.accessToken, afterUnixSeconds);
    const runs = activities
      .filter(isRunningActivity)
      .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
      .map((activity) => ({
        id: activity.id,
        name: activity.name,
        date: activityLocalDate(activity),
        startTimeIso: activity.start_date_local,
        distanceM: activity.distance,
        movingTimeS: activity.moving_time,
      }));
    return { activities: runs };
  } catch {
    return { error: "Couldn't fetch activities from Strava right now -- try again in a moment." };
  }
}

export async function fetchActivityRoute(
  activityId: number,
  startTimeIso: string | null = null,
): Promise<ActionResult<{ route: ParsedRoute }>> {
  const tokenResult = await getRefreshedAccessToken();
  if ("error" in tokenResult) return tokenResult;

  try {
    const streams = await fetchActivityStreams(tokenResult.accessToken, activityId);
    return { route: stravaStreamsToRoute(streams, startTimeIso) };
  } catch (error) {
    if (error instanceof Error && error.message.includes("GPS or elevation data")) {
      return { error: error.message };
    }
    return { error: "Couldn't fetch this activity's route from Strava right now -- try again in a moment." };
  }
}

export async function getActivityDecoupling(activityId: number): Promise<ActionResult<{ decoupling: DecouplingResult | null }>> {
  const tokenResult = await getRefreshedAccessToken();
  if ("error" in tokenResult) return tokenResult;

  try {
    const streams = await fetchActivityStreams(tokenResult.accessToken, activityId);
    if (!streams.time || !streams.distance || !streams.heartrate) {
      // Most commonly: recorded without a heart-rate monitor -- Strava
      // simply omits the key rather than erroring, so this isn't a fetch
      // failure, just "nothing to compute."
      return { decoupling: null };
    }
    return {
      decoupling: computeAerobicDecoupling({
        timeS: streams.time,
        distanceM: streams.distance,
        heartrateBpm: streams.heartrate,
      }),
    };
  } catch {
    return { error: "Couldn't fetch this activity's data from Strava right now -- try again in a moment." };
  }
}
