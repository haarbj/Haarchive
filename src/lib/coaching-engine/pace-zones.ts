import { distanceBucket, type DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
import type { PaceZoneKey, PaceZones, WorkoutType } from "@/lib/coaching-engine/types";

// Multipliers applied to goal pace (sec/km): below 1.0 runs faster than goal
// pace, above 1.0 slower. Bucketed by the goal race's own distance because
// "goal pace" sits at a different point on the effort spectrum depending on
// the goal itself -- for a marathon goal it's a moderate aerobic effort with
// real room to run intervals faster; for a 5K/mile goal it's already close
// to VO2max effort, so even interval work only pulls a little faster than
// it, and long/easy running drops off further below it than it does for a
// marathon goal. Each zone gets consistently faster than the last moving
// interval -> tempo -> steady -> easy, in every bucket -- a simple,
// reviewable v1 model, not a per-philosophy (polarized/pyramidal) one.
const ZONE_MULTIPLIERS: Record<DistanceBucket, Record<PaceZoneKey, [number, number]>> = {
  short: {
    interval: [0.9, 0.95],
    tempo: [1.08, 1.14],
    steady: [1.2, 1.3],
    easy: [1.35, 1.5],
  },
  middle: {
    interval: [0.93, 0.97],
    tempo: [1.05, 1.1],
    steady: [1.15, 1.24],
    easy: [1.28, 1.42],
  },
  long: {
    interval: [0.85, 0.9],
    tempo: [0.92, 0.96],
    steady: [0.98, 1.04],
    easy: [1.12, 1.22],
  },
};

// Which pace zone a given workout type draws its pace range from. `race` and
// `strength` have no pace zone: race day runs at goal pace itself, and
// strength work isn't a running pace at all.
export const WORKOUT_TYPE_PACE_ZONE: Partial<Record<WorkoutType, PaceZoneKey>> = {
  easy: "easy",
  recovery: "easy",
  long: "steady",
  tempo: "tempo",
  vo2: "interval",
};

export function derivePaceZones(goalDistanceM: number, goalTimeS: number): PaceZones {
  const goalPaceSecPerKm = goalTimeS / (goalDistanceM / 1000);
  const table = ZONE_MULTIPLIERS[distanceBucket(goalDistanceM)];

  const zone = ([lo, hi]: [number, number]): [number, number] => [
    goalPaceSecPerKm * lo,
    goalPaceSecPerKm * hi,
  ];

  return {
    interval: zone(table.interval),
    tempo: zone(table.tempo),
    steady: zone(table.steady),
    easy: zone(table.easy),
  };
}
