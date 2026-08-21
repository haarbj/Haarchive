// A small starter set of well-known marathon courses, selectable without
// needing to find and upload your own GPX file -- the same convenience
// FindMyMarathon offers via its race dropdown.
//
// These are NOT surveyed GPS data. Each course is a short list of
// elevation waypoints at named, individually-sourced landmarks (a specific
// bridge, a specific named hill, a mile marker cited in published course
// guides), linearly interpolated between them and run through the exact
// same analyzeCourse() pipeline a real uploaded GPX file goes through.
// Lat/lon coordinates are synthetic (a straight path, not the course's
// real geography) -- they only exist to give the route pipeline correct
// cumulative distance and *a* heading for wind math, not to claim
// geographic accuracy. The elevation SHAPE (net change, where the hills
// are, roughly how big) is sourced from each course's own published
// facts (see each entry's `sourceNote`); the exact meter-by-meter profile
// between those landmarks is a straight-line approximation, not survey data.

import { haversineDistanceM } from "@/lib/route-import/route-summary";
import type { ParsedRoute, RoutePoint } from "@/lib/route-import/types";

const EARTH_RADIUS_M = 6371000;
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
const MARATHON_METERS = 42195;
const WAYPOINT_STEP_M = 25; // synthetic point spacing fed into analyzeCourse -- fine enough for its default 20m resample grid

export type PresetCourseId = "boston" | "chicago" | "nyc" | "berlin" | "london" | "tokyo";

export type PresetCourseWaypoint = {
  mile: number;
  elevationFt: number;
};

export type PresetCourse = {
  id: PresetCourseId;
  name: string;
  region: string;
  waypoints: PresetCourseWaypoint[];
  sourceNote: string;
};

export const PRESET_COURSES: PresetCourse[] = [
  {
    id: "boston",
    name: "Boston Marathon",
    region: "United States",
    sourceNote:
      "Net downhill, point-to-point Hopkinton -> Boston (~815ft total climb, ~1275ft total descent). The Newton Hills climbs (miles 16.3-20.7, including Heartbreak Hill) use the specific mile markers and elevation gains reported in published course guides; the rest of the profile is a straight-line approximation between the course's well-documented low/high points, not a survey.",
    waypoints: [
      { mile: 0, elevationFt: 490 },
      { mile: 3, elevationFt: 470 },
      { mile: 5, elevationFt: 420 },
      { mile: 7, elevationFt: 380 },
      { mile: 9, elevationFt: 350 },
      { mile: 11, elevationFt: 300 },
      { mile: 13, elevationFt: 250 },
      { mile: 16, elevationFt: 60 },
      { mile: 16.27, elevationFt: 60 },
      { mile: 16.47, elevationFt: 98 },
      { mile: 17.6, elevationFt: 100 },
      { mile: 17.91, elevationFt: 157 },
      { mile: 19.24, elevationFt: 145 },
      { mile: 19.45, elevationFt: 187 },
      { mile: 20.26, elevationFt: 175 },
      { mile: 20.67, elevationFt: 230 }, // Heartbreak Hill summit
      { mile: 22, elevationFt: 150 },
      { mile: 24, elevationFt: 80 },
      { mile: 26.2, elevationFt: 10 },
    ],
  },
  {
    id: "chicago",
    name: "Chicago Marathon",
    region: "United States",
    sourceNote:
      "One of the flattest World Marathon Majors (~200ft total elevation gain). The one notable bump is a short rise on Roosevelt Road around miles 22-23; otherwise essentially flat, per published course elevation data.",
    waypoints: [
      { mile: 0, elevationFt: 595 },
      { mile: 5, elevationFt: 600 },
      { mile: 10, elevationFt: 590 },
      { mile: 15, elevationFt: 585 },
      { mile: 18, elevationFt: 580 },
      { mile: 20, elevationFt: 585 },
      { mile: 22, elevationFt: 585 },
      { mile: 23, elevationFt: 610 },
      { mile: 24, elevationFt: 600 },
      { mile: 26.2, elevationFt: 595 },
    ],
  },
  {
    id: "nyc",
    name: "TCS New York City Marathon",
    region: "United States",
    sourceNote:
      "~870ft total elevation gain across five bridge crossings. The Verrazzano-Narrows Bridge climb (mile 1, the course's highest point), Queensboro Bridge climb (~mile 15.5, ~102ft), and the Fifth Avenue climb (~mile 22.5) use the specific gains reported in published course guides; the rest is a straight-line approximation.",
    waypoints: [
      { mile: 0, elevationFt: 40 },
      { mile: 1, elevationFt: 200 }, // Verrazzano-Narrows Bridge apex
      { mile: 2, elevationFt: 40 },
      { mile: 8, elevationFt: 60 },
      { mile: 13, elevationFt: 50 },
      { mile: 15, elevationFt: 30 },
      { mile: 15.5, elevationFt: 132 }, // Queensboro Bridge
      { mile: 16, elevationFt: 60 },
      { mile: 20, elevationFt: 55 },
      { mile: 22.5, elevationFt: 130 }, // Fifth Avenue climb
      { mile: 24, elevationFt: 100 }, // Central Park rolling hills
      { mile: 25, elevationFt: 130 },
      { mile: 26.2, elevationFt: 45 },
    ],
  },
  {
    id: "berlin",
    name: "Berlin Marathon",
    region: "Germany",
    sourceNote:
      "The flattest World Marathon Major -- average altitude stays roughly 35-50m (115-165ft) the whole way, with only minor rollers. No individually named hills to anchor to; this is a gently-varying approximation of a course widely described as pancake flat.",
    waypoints: [
      { mile: 0, elevationFt: 130 },
      { mile: 6, elevationFt: 145 },
      { mile: 13, elevationFt: 135 },
      { mile: 19, elevationFt: 150 },
      { mile: 24, elevationFt: 140 },
      { mile: 26.2, elevationFt: 125 },
    ],
  },
  {
    id: "london",
    name: "London Marathon",
    region: "United Kingdom",
    sourceNote:
      "Net downhill, ~85% flat (~127m/419ft total gain). Uses the published landmarks: the Blackheath descent (miles 1-3), the flat Cutty Sark section (~mile 6.5), the Tower Bridge rise (~mile 12), and a short Blackfriars hill (~miles 23-24).",
    waypoints: [
      { mile: 0, elevationFt: 148 },
      { mile: 3, elevationFt: 50 },
      { mile: 6.5, elevationFt: 40 },
      { mile: 12, elevationFt: 66 },
      { mile: 13, elevationFt: 33 },
      { mile: 20, elevationFt: 26 },
      { mile: 23, elevationFt: 50 },
      { mile: 26.2, elevationFt: 40 },
    ],
  },
  {
    id: "tokyo",
    name: "Tokyo Marathon",
    region: "Japan",
    sourceNote:
      "Net downhill start (~60m/198ft total gain, ~98m/322ft total descent): a gradual downhill first ~4 miles, then close to flat with only small bridge-crossing bumps in the second half, per published course descriptions.",
    waypoints: [
      { mile: 0, elevationFt: 148 },
      { mile: 4, elevationFt: 50 },
      { mile: 10, elevationFt: 45 },
      { mile: 16, elevationFt: 55 },
      { mile: 16.5, elevationFt: 40 },
      { mile: 20, elevationFt: 50 },
      { mile: 20.5, elevationFt: 35 },
      { mile: 24, elevationFt: 45 },
      { mile: 24.5, elevationFt: 30 },
      { mile: 26.2, elevationFt: 16 },
    ],
  },
];

export const presetCourseMap = new Map(PRESET_COURSES.map((c) => [c.id, c]));

function elevationAtMile(waypoints: PresetCourseWaypoint[], mile: number): number {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (mile >= a.mile && mile <= b.mile) {
      const t = b.mile === a.mile ? 0 : (mile - a.mile) / (b.mile - a.mile);
      return (a.elevationFt + (b.elevationFt - a.elevationFt) * t) / FEET_PER_METER;
    }
  }
  return waypoints[waypoints.length - 1].elevationFt / FEET_PER_METER;
}

/**
 * Builds a synthetic ParsedRoute from a preset's elevation waypoints, fed
 * through the exact same analyzeCourse() pipeline a real GPX upload uses.
 * Lat/lon walks due east along the equator (haversineDistanceM is exact
 * there for small steps) purely to give the route correct cumulative
 * distance and a heading for wind math -- not a claim about the course's
 * real geography, which is irrelevant to the terrain-cost math either way.
 */
export function buildPresetRoute(course: PresetCourse): ParsedRoute {
  const points: RoutePoint[] = [];
  for (let distanceM = 0; distanceM <= MARATHON_METERS; distanceM += WAYPOINT_STEP_M) {
    const mile = distanceM / METERS_PER_MILE;
    const lonDeg = (distanceM / EARTH_RADIUS_M) * (180 / Math.PI);
    points.push({ lat: 0, lon: lonDeg, elevationM: elevationAtMile(course.waypoints, mile), elapsedSeconds: null });
  }
  return { points, source: "gpx", startTimeIso: null, movingTimeS: null };
}

/** Sanity-checks that a preset's synthetic route resolves to a real marathon distance -- exported for tests, not used at runtime. */
export function totalDistanceOfPresetRoute(route: ParsedRoute): number {
  let total = 0;
  let previous: { lat: number; lon: number } | null = null;
  for (const point of route.points) {
    if (point.lat === null || point.lon === null) continue;
    if (previous) total += haversineDistanceM(previous.lat, previous.lon, point.lat, point.lon);
    previous = { lat: point.lat, lon: point.lon };
  }
  return total;
}
