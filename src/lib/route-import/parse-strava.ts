// Converts a Strava activity's raw stream data into the same ParsedRoute
// shape every file-based parser produces, so route-summary.ts and the
// import UI don't need to know or care whether a route came from an
// uploaded file or a connected Strava account.

import type { StravaStreamSet } from "@/lib/strava/client";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

export function stravaStreamsToRoute(streams: StravaStreamSet, startTimeIso: string | null = null): ParsedRoute {
  const pointCount = streams.time?.length ?? streams.latlng?.length ?? streams.altitude?.length ?? 0;
  if (pointCount === 0) {
    throw new Error("This activity doesn't have GPS or elevation data to import.");
  }

  const points: RoutePoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const latlng = streams.latlng?.[i];
    points.push({
      lat: latlng ? latlng[0] : null,
      lon: latlng ? latlng[1] : null,
      elevationM: streams.altitude?.[i] ?? null,
      elapsedSeconds: streams.time?.[i] ?? null,
    });
  }

  // Strava's stream data is elapsed-seconds-only (no per-point absolute
  // timestamp), unlike GPX/TCX/FIT -- the activity's own start time is
  // passed in from the summary Strava already returned when listing
  // activities, rather than being derivable from the streams themselves.
  return { points, source: "strava", startTimeIso };
}
