// Derives what the environmental calculator's engines actually need --
// total distance/time, elevation gain/loss, and per-segment true-bearing
// headings for route-wind-physics.ts -- from a parsed GPX/TCX/FIT/Strava
// route. One derivation shared by every source format, since they all
// normalize into the same ParsedRoute shape first.

import type { RouteHeadingSegment } from "@/lib/route-wind-physics";
import type { ParsedRoute, RoutePoint, RouteSource } from "@/lib/route-import/types";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Standard haversine great-circle distance -- accurate enough at running
// scale (the earth's non-spherical shape introduces well under 0.5% error
// at these distances, negligible next to GPS noise itself).
export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Standard initial bearing (true compass degrees, 0-360) from point 1 to point 2.
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

// Raw GPS/barometric elevation readings are noisy -- summing every tick
// between consecutive points wildly overstates total gain/loss. Ignoring
// changes below this threshold is a standard, simple denoising heuristic
// (not a substitute for real smoothing, but a meaningful improvement over
// naive summation).
const ELEVATION_NOISE_THRESHOLD_M = 1;

export type RouteSummary = {
  totalDistanceM: number;
  totalTimeSeconds: number;
  elevationGainM: number;
  elevationLossM: number;
  headingSegments: RouteHeadingSegment[];
  source: RouteSource;
  /**
   * The activity's real start time, when the source format provides one --
   * see ParsedRoute.startTimeIso. NOTE its meaning differs by source:
   * Strava's own start_date_local is local wall-clock time mislabeled with
   * a "Z" suffix (a known Strava API quirk), while GPX/TCX/FIT timestamps
   * are genuine UTC instants -- callers converting this to a local
   * wall-clock reading (e.g. for a weather lookup) need to branch on
   * `source` rather than treating it uniformly.
   */
  startTimeIso: string | null;
  /** Average of all valid GPS points -- a representative "where" for this route, used for automatic weather/terrain lookups. */
  centroidLat: number | null;
  centroidLon: number | null;
};

export function summarizeRoute(route: ParsedRoute): RouteSummary {
  const { points } = route;

  let totalDistanceM = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  const headingSegments: RouteHeadingSegment[] = [];

  let previousGpsPoint: { lat: number; lon: number } | null = null;
  let previousElevationM: number | null = null;
  let latSum = 0;
  let lonSum = 0;
  let gpsPointCount = 0;

  for (const point of points) {
    if (point.lat !== null && point.lon !== null) {
      if (previousGpsPoint) {
        const distanceM = haversineDistanceM(previousGpsPoint.lat, previousGpsPoint.lon, point.lat, point.lon);
        if (distanceM > 0) {
          const headingBearingDeg = bearingDeg(previousGpsPoint.lat, previousGpsPoint.lon, point.lat, point.lon);
          headingSegments.push({ headingBearingDeg, distanceM });
          totalDistanceM += distanceM;
        }
      }
      previousGpsPoint = { lat: point.lat, lon: point.lon };
      latSum += point.lat;
      lonSum += point.lon;
      gpsPointCount += 1;
    }

    if (point.elevationM !== null) {
      if (previousElevationM !== null) {
        const deltaM = point.elevationM - previousElevationM;
        if (Math.abs(deltaM) >= ELEVATION_NOISE_THRESHOLD_M) {
          if (deltaM > 0) elevationGainM += deltaM;
          else elevationLossM += -deltaM;
          previousElevationM = point.elevationM;
        }
      } else {
        previousElevationM = point.elevationM;
      }
    }
  }

  const totalTimeSeconds = lastElapsedSeconds(points) ?? 0;

  return {
    totalDistanceM,
    totalTimeSeconds,
    elevationGainM,
    elevationLossM,
    headingSegments,
    source: route.source,
    startTimeIso: route.startTimeIso,
    centroidLat: gpsPointCount > 0 ? latSum / gpsPointCount : null,
    centroidLon: gpsPointCount > 0 ? lonSum / gpsPointCount : null,
  };
}

function lastElapsedSeconds(points: RoutePoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].elapsedSeconds !== null) return points[i].elapsedSeconds;
  }
  return null;
}
