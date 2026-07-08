import { distanceBucket, type DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
import type { WeekPlan } from "@/lib/coaching-engine/types";

const WEEKLY_INCREASE_CAP = 0.1; // the classic "10% rule"
const CUTBACK_REDUCTION = 0.25; // cutback weeks drop to 75% of the last ramp week
// Percent of peak mileage, ordered furthest-from-race first -- e.g. in a
// 3-week taper the first week runs at 80% of peak, the last (closest to
// race day) at 50%.
const TAPER_REDUCTIONS = [0.8, 0.65, 0.5];
const PEAK_MULTIPLIER: Record<DistanceBucket, number> = { short: 1.25, middle: 1.35, long: 1.5 };

// Builds one weekly mileage figure (in meters) per week in the plan. Ramps
// at most 10% week over week, drops to 75% of the prior ramp week on a
// cutback, and steps down through TAPER_REDUCTIONS as race day approaches --
// each derived from the athlete's own current mileage, never from a
// number the engine invents independent of what they reported.
export function buildWeeklyMileagePlan(
  weeks: WeekPlan[],
  startingWeeklyMeters: number,
  goalDistanceM: number,
): number[] {
  const ceiling = startingWeeklyMeters * PEAK_MULTIPLIER[distanceBucket(goalDistanceM)];
  const volumes: number[] = [];
  let lastRampWeek = startingWeeklyMeters;
  let peakReached = startingWeeklyMeters;

  weeks.forEach((week, i) => {
    let current: number;

    if (week.phase === "taper") {
      const weeksFromEnd = Math.min(weeks.length - i, TAPER_REDUCTIONS.length);
      const pct = TAPER_REDUCTIONS[TAPER_REDUCTIONS.length - weeksFromEnd];
      current = peakReached * pct;
    } else if (week.isCutback) {
      current = lastRampWeek * (1 - CUTBACK_REDUCTION);
    } else {
      current = Math.min(ceiling, lastRampWeek * (1 + WEEKLY_INCREASE_CAP));
      lastRampWeek = current;
      peakReached = current;
    }

    volumes.push(Math.round(current));
  });

  return volumes;
}
