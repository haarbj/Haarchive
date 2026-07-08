// "Goal pace" means something physiologically different depending on how
// short or long the goal race itself is -- a marathon goal's pace is a
// moderate aerobic effort, a 5K goal's pace is already close to VO2max.
// Bucketing the goal distance lets pace-zones.ts and periodization.ts each
// use one simple percentage-offset table per bucket rather than one flat
// table that would only make sense for one kind of race.
export type DistanceBucket = "short" | "middle" | "long";

export function distanceBucket(distanceM: number): DistanceBucket {
  if (distanceM <= 7000) return "short"; // Mile, 5K
  if (distanceM <= 15000) return "middle"; // 8K, 10K
  return "long"; // Half, Marathon
}
