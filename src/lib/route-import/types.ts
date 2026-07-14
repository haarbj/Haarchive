// Shared shape every file/activity parser (GPX, TCX, FIT, and eventually a
// Strava activity stream) normalizes into, so the rest of the import
// pipeline -- route-summary.ts's distance/elevation/heading derivation,
// and route-wind-engine.ts's course integration -- only has to understand
// one representation instead of three source formats.

export type RoutePoint = {
  lat: number | null;
  lon: number | null;
  elevationM: number | null;
  /** Seconds since the first point in the route that had a timestamp. */
  elapsedSeconds: number | null;
};

export type RouteSource = "gpx" | "tcx" | "fit" | "strava";

export type ParsedRoute = {
  points: RoutePoint[];
  source: RouteSource;
  /**
   * The activity's absolute start time (ISO 8601), when the source format
   * provides one -- GPX/TCX/FIT all carry real timestamps per point, and
   * Strava activities carry a start time even though their stream data is
   * elapsed-seconds-only. Lets the calculator treat an imported activity
   * as the source of truth for "when," not just "how far/how long," so it
   * can fetch historical weather automatically instead of asking the user
   * to redo a location+date lookup.
   */
  startTimeIso: string | null;
};
