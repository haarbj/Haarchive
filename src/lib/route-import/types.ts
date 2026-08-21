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
  /**
   * Strava's own `moving_time` for this activity (seconds), when the
   * source is Strava -- null for every other source. Strava's stream data
   * only carries elapsed-seconds-since-start per point, which includes any
   * time stopped at a light, water stop, etc. that the recording device
   * didn't auto-pause through; `moving_time` is Strava's own, more
   * accurate accounting of actual running time, already used the same way
   * for logging a completed workout (see map-activity.ts's own comment on
   * why elapsed_time is deliberately avoided there). route-summary.ts
   * prefers this over the elapsed-time stream when it's present.
   */
  movingTimeS: number | null;
};
