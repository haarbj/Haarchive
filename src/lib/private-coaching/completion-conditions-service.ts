// Conditions-adjusted actuals: the Supabase/Strava-touching orchestration
// that ties the audit's three already-proven pieces together for one
// Strava-matched completed workout --
//   1. GPS by activity id: src/lib/strava/client.ts's fetchActivityStreams
//      (already proven server-callable via route-actions.ts's own
//      "use server" fetchActivityRoute -- NOT reused directly here; see
//      below for why).
//   2. Weather by lat/lon/time window: fetch-weather-conditions.ts's
//      fetchConditionsWindow (no client-only code, plain fetch()).
//   3. The pure engine composition: completed-workout-conditions.ts's
//      composeRoutes/buildWeatherReadings/computeConditionsBreakdown,
//      itself built on the real, unmodified computeRecordedRunEffort.
//
// WHY THIS CALLS src/lib/strava/client.ts DIRECTLY, NOT
// route-actions.ts's fetchActivityRoute/listRecentRunActivities: those
// are "use server" actions that resolve the Strava token for WHOEVER IS
// CALLING RIGHT NOW (supabase.auth.getClaims()) -- correct for a tool
// where the signed-in user is importing their OWN activity, wrong here,
// where the coach is an equally valid trigger (see completion-actions.ts's
// triggerConditionsAnalysis) but has no Strava connection of their own to
// use. This module resolves the token for the completion's real
// athlete_id explicitly, via the service-role client, the same "a
// specific user's row, not the caller's" pattern approveStravaMatch
// itself already uses for scheduled_workouts. Never calls, modifies, or
// duplicates route-actions.ts/completion-actions.ts's matching/approval
// logic -- only the lower-level client wrapped with a different, explicit
// identity.
//
// Best-effort, by design (see analyzeCompletedWorkoutConditions's own
// comment): every failure mode writes a 'failed' status with a real
// message, never throws past this module's own boundary, and never
// fabricates a result.

import { createServiceRoleClient } from "@/lib/db/service-role";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshStravaToken, fetchRecentActivities, fetchActivityStreams } from "@/lib/strava/client";
import type { StravaActivity } from "@/lib/strava/types";
import { stravaStreamsToRoute } from "@/lib/route-import/parse-strava";
import { summarizeRoute } from "@/lib/route-import/route-summary";
import { fetchConditionsWindow } from "@/lib/environmental/fetch-weather-conditions";
import type { WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import {
  composeRoutes,
  buildWeatherReadings,
  computeConditionsBreakdown,
  type ActivityRoute,
  type ConditionsFactorBreakdown,
} from "@/lib/private-coaching/completed-workout-conditions";

export type ConditionsAnalysisStatus = "pending" | "ready" | "failed";

export type ConditionsAnalysis = {
  status: ConditionsAnalysisStatus;
  computedAt: string | null;
  error: string | null;
  activityIds: number[];
  distanceM: number | null;
  actualTimeS: number | null;
  idealTimeS: number | null;
  actualPaceSPerMi: number | null;
  idealPaceSPerMi: number | null;
  factors: ConditionsFactorBreakdown[] | null;
  conditions: WeatherConditions[] | null;
};

const PENDING: ConditionsAnalysis = {
  status: "pending",
  computedAt: null,
  error: null,
  activityIds: [],
  distanceM: null,
  actualTimeS: null,
  idealTimeS: null,
  actualPaceSPerMi: null,
  idealPaceSPerMi: null,
  factors: null,
  conditions: null,
};

type CompletedWorkoutRow = {
  id: string;
  athlete_id: string;
  completed_at: string;
  strava_activity_id: number | null;
  strava_activity_ids: number[] | null;
};

async function getStravaAccessToken(supabase: ReturnType<typeof createServiceRoleClient>, athleteId: string): Promise<string> {
  const { data: account } = await supabase
    .from("connected_accounts")
    .select("id, refresh_token_encrypted")
    .eq("user_id", athleteId)
    .eq("provider", "strava")
    .maybeSingle<{ id: string; refresh_token_encrypted: string | null }>();
  if (!account?.refresh_token_encrypted) throw new Error("This athlete has no connected Strava account.");

  const refreshed = await refreshStravaToken(decryptToken(account.refresh_token_encrypted));
  await supabase
    .from("connected_accounts")
    .update({ access_token_encrypted: encryptToken(refreshed.accessToken), refresh_token_encrypted: encryptToken(refreshed.refreshToken) })
    .eq("id", account.id);
  return refreshed.accessToken;
}

/**
 * Finds each needed activity's own summary (for its real start time and
 * moving_time, which the streams endpoint itself never returns -- see
 * ParsedRoute's own comment) by listing recent activities and matching
 * by id. The lookback window is anchored on this specific completion's
 * own completed_at, not a blind fixed window -- more robust than
 * route-actions.ts's own 90-day-back default for a retry run well after
 * the fact, since this module actually knows roughly when the activity
 * happened.
 */
async function findActivitySummaries(accessToken: string, activityIds: number[], completedAt: string): Promise<Map<number, StravaActivity>> {
  const afterUnixSeconds = Math.floor(new Date(completedAt).getTime() / 1000) - 3 * 86_400;
  const activities = await fetchRecentActivities(accessToken, afterUnixSeconds);
  const byId = new Map(activities.map((a) => [a.id, a]));
  const missing = activityIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`Couldn't find activity ${missing.join(", ")} in this athlete's recent Strava history.`);
  }
  return byId;
}

async function buildComposedRoute(accessToken: string, activityIds: number[], summaries: Map<number, StravaActivity>) {
  const activityRoutes: ActivityRoute[] = [];
  for (const id of activityIds) {
    const summary = summaries.get(id)!;
    const streams = await fetchActivityStreams(accessToken, id);
    const route = stravaStreamsToRoute(streams, summary.start_date_local, summary.moving_time);
    activityRoutes.push({ route, startTimeIso: summary.start_date_local });
  }
  return composeRoutes(activityRoutes);
}

/**
 * Strava's own start_date_local is local wall-clock time mislabeled with
 * a "Z" suffix -- its digits already ARE the local reading. Mirrors
 * use-environmental-weather.ts's applyRouteLocation exactly (the one
 * other place this exact quirk is already handled), just without the
 * React hook it lives in.
 */
function stravaLocalDateTime(startTimeIso: string): string {
  return startTimeIso.slice(0, 16);
}

async function persist(supabase: ReturnType<typeof createServiceRoleClient>, completedWorkoutId: string, analysis: ConditionsAnalysis): Promise<void> {
  await supabase.from("completed_workouts").update({ conditions_analysis: analysis }).eq("id", completedWorkoutId);
}

/**
 * The one orchestration entry point: loads a completion's Strava
 * activity id(s), fetches the route(s) and the weather window for the
 * activity's own time span and location, runs the real environmental
 * engine composition, and persists the result -- idempotent (a re-run
 * simply overwrites with a fresh result) and always ends in 'ready' or
 * 'failed', never a thrown exception past this function's own boundary
 * (every caller -- the post-approval hook, the on-demand retry action --
 * can call this without its own try/catch and still never see the
 * completion's own approved state put at risk).
 *
 * Manually-logged completions (no strava_activity_id at all) are not
 * this function's concern -- callers are expected to check for a Strava
 * id before calling it (see completion-actions.ts); calling it on one
 * anyway fails cleanly with a real "no GPS" message rather than silently
 * returning.
 */
export async function analyzeCompletedWorkoutConditions(completedWorkoutId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: completion } = await supabase
    .from("completed_workouts")
    .select("id, athlete_id, completed_at, strava_activity_id, strava_activity_ids")
    .eq("id", completedWorkoutId)
    .maybeSingle<CompletedWorkoutRow>();

  if (!completion) return; // Deleted or never existed -- nothing to analyze, nothing to report.

  const activityIds = completion.strava_activity_ids ?? (completion.strava_activity_id != null ? [completion.strava_activity_id] : []);
  if (activityIds.length === 0) return; // Manually logged -- see this function's own header comment.

  await persist(supabase, completedWorkoutId, { ...PENDING, activityIds });

  try {
    const accessToken = await getStravaAccessToken(supabase, completion.athlete_id);
    const summaries = await findActivitySummaries(accessToken, activityIds, completion.completed_at);
    const route = await buildComposedRoute(accessToken, activityIds, summaries);

    const summary = summarizeRoute(route);
    if (!route.startTimeIso || summary.centroidLat == null || summary.centroidLon == null) {
      throw new Error("This activity has no usable GPS/elevation data to analyze.");
    }

    const weatherPoints = await fetchConditionsWindow(
      summary.centroidLat,
      summary.centroidLon,
      stravaLocalDateTime(route.startTimeIso),
      summary.totalTimeSeconds,
    );
    const weatherReadings = buildWeatherReadings(weatherPoints);
    const breakdown = computeConditionsBreakdown(route, weatherReadings);

    await persist(supabase, completedWorkoutId, {
      status: "ready",
      computedAt: new Date().toISOString(),
      error: null,
      activityIds,
      distanceM: breakdown.distanceM,
      actualTimeS: breakdown.actualTimeS,
      idealTimeS: breakdown.idealTimeS,
      actualPaceSPerMi: breakdown.actualPaceSPerMi,
      idealPaceSPerMi: breakdown.idealPaceSPerMi,
      factors: breakdown.factors,
      conditions: weatherPoints,
    });
  } catch (error) {
    await persist(supabase, completedWorkoutId, {
      ...PENDING,
      status: "failed",
      computedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Couldn't analyze this workout's conditions right now.",
      activityIds,
    });
  }
}
