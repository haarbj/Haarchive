export type AcwrWorkout = {
  completedAt: string;
  distanceM: number;
};

export type AcwrZone = "undertrained" | "sweet-spot" | "caution" | "high-risk";

export type AcwrResult = {
  acuteDailyAvgM: number;
  chronicDailyAvgM: number;
  ratio: number | null;
  zone: AcwrZone | null;
};

const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The classic "coupled" rolling-average ACWR (Gabbett 2016): a trailing
// 7-day average load over a trailing 28-day average load, using true
// rolling time windows (not calendar-day-aligned) to avoid any timezone
// handling -- comparing raw instants against "now" is both simpler and
// arguably more correct for a continuous rolling ratio than snapping to
// midnight boundaries. Distance is the load metric here (not session-RPE x
// duration), since workout_completions almost always has actual_distance_m
// from Strava sync but RPE is optional and frequently missing -- this
// mirrors the plain "don't ramp weekly mileage too fast" guidance already
// common in running coaching, just computed continuously instead of
// week-over-week.
//
// Worth being upfront about a real limitation: the acute window is a
// subset of the chronic window in this "coupled" method, which
// mathematically correlates the two and has drawn real methodological
// criticism (e.g. Impellizzeri et al. 2020) versus an "uncoupled"
// alternative that excludes the most recent week from the chronic
// baseline. Shown here as a directional signal, not a precise risk score.
export function computeAcwr(workouts: AcwrWorkout[], now: Date = new Date()): AcwrResult {
  const nowMs = now.getTime();
  const acuteStartMs = nowMs - ACUTE_WINDOW_DAYS * MS_PER_DAY;
  const chronicStartMs = nowMs - CHRONIC_WINDOW_DAYS * MS_PER_DAY;

  let acuteTotalM = 0;
  let chronicTotalM = 0;

  for (const workout of workouts) {
    const completedAtMs = new Date(workout.completedAt).getTime();
    if (completedAtMs > nowMs || completedAtMs < chronicStartMs) continue;
    chronicTotalM += workout.distanceM;
    if (completedAtMs >= acuteStartMs) acuteTotalM += workout.distanceM;
  }

  const acuteDailyAvgM = acuteTotalM / ACUTE_WINDOW_DAYS;
  const chronicDailyAvgM = chronicTotalM / CHRONIC_WINDOW_DAYS;
  const ratio = chronicDailyAvgM > 0 ? acuteDailyAvgM / chronicDailyAvgM : null;

  return {
    acuteDailyAvgM,
    chronicDailyAvgM,
    ratio,
    zone: ratio === null ? null : zoneForRatio(ratio),
  };
}

// Gabbett's commonly-cited bands. Real, published, and widely used in
// practice -- also genuinely contested in more recent literature on
// exactly where the boundaries should sit, so treat 1.5 and 0.8 as
// approximate, not precise cutoffs.
function zoneForRatio(ratio: number): AcwrZone {
  if (ratio > 1.5) return "high-risk";
  if (ratio > 1.3) return "caution";
  if (ratio < 0.8) return "undertrained";
  return "sweet-spot";
}
