import type { StravaActivity } from "@/lib/strava/types";

// Thin wrappers around Strava's REST API -- all the actual I/O, deliberately
// kept separate from map-activity.ts's pure logic. This part can't be
// verified without a real connected Strava account exercising it; the
// mapping/filtering logic it feeds into is unit-tested independently.

export type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function refreshStravaToken(refreshToken: string): Promise<RefreshedTokens> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed with status ${res.status}`);
  }
  const data: { access_token: string; refresh_token: string } = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

const PER_PAGE = 50;
const MAX_PAGES = 10; // safety cap: 500 activities per sync, plenty for a "since last sync" window

export async function fetchRecentActivities(accessToken: string, afterUnixSeconds: number): Promise<StravaActivity[]> {
  const activities: StravaActivity[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${afterUnixSeconds}&per_page=${PER_PAGE}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new Error(`Strava activities fetch failed with status ${res.status}`);
    }
    const batch: StravaActivity[] = await res.json();
    activities.push(...batch);
    if (batch.length < PER_PAGE) break;
  }

  return activities;
}

export type StravaStreamSet = {
  latlng?: [number, number][];
  altitude?: number[];
  /** Seconds elapsed since the start of the activity. */
  time?: number[];
};

type StravaStreamsResponse = {
  latlng?: { data: [number, number][] };
  altitude?: { data: number[] };
  time?: { data: number[] };
};

// GPS + elevation + time for one specific activity -- unlike
// fetchRecentActivities, which only ever returns summaries. Needs the same
// activity:read_all scope already requested during the OAuth connect flow,
// so no re-authorization is needed for existing connected accounts.
export async function fetchActivityStreams(accessToken: string, activityId: number): Promise<StravaStreamSet> {
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng,altitude,time&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Strava streams fetch failed with status ${res.status}`);
  }
  const data: StravaStreamsResponse = await res.json();
  return {
    latlng: data.latlng?.data,
    altitude: data.altitude?.data,
    time: data.time?.data,
  };
}
