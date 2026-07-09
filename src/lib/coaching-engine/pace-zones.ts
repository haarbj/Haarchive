import { distanceBucket, type DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
import { predictRaceTime } from "@/lib/coaching-engine/race-prediction";
import type { PaceZoneKey, PaceZones, WorkoutType } from "@/lib/coaching-engine/types";

const METERS_PER_MILE = 1609.34;

// Marathon-bucket zones stay a flat percentage-of-goal-pace table: the
// marathon guidelines describe structure and effort (durability,
// specificity, "run primarily by effort rather than pace") rather than a
// crisp anchored formula the way the short/middle-bucket guidelines do, so
// there's no more-authoritative source to replace this v1 model with.
// Multipliers applied to goal pace (sec/km): below 1.0 runs faster than goal
// pace, above 1.0 slower.
const LONG_BUCKET_MULTIPLIERS: Record<PaceZoneKey, [number, number]> = {
  interval: [0.85, 0.9],
  tempo: [0.92, 0.96],
  steady: [0.98, 1.04],
  easy: [1.12, 1.22],
};

// Short/middle-bucket zones are anchored to an equivalent-5K pace and this
// program's own XC guidelines, which give exact formulas rather than an
// invented percentage table:
//   - Easy: goal 5K pace + 1:30-2:30 per mile.
//   - Tempo/threshold: goal 5K pace / 0.93.
//   - VO2/interval: goal 5K pace itself.
// A tight +/-2.5% band replaces each point formula (tempo, interval) so
// every zone stays a [fast, slow] range, matching PaceZones' shape and
// mirroring how wide the old flat-percentage bands already were.
const XC_BAND_PCT = 0.025;
const XC_EASY_OFFSET_SEC_PER_MILE: [number, number] = [90, 150];
// Structural floor only: at extremely slow equivalent-5K paces the fixed
// mile-based easy offset and the proportional tempo offset can otherwise
// converge, so easy is never allowed closer than this to tempo's slow end.
const MIN_ZONE_GAP_SEC_PER_KM = 5;

function secPerMileOffsetToSecPerKm(secPerMile: number): number {
  return secPerMile / (METERS_PER_MILE / 1000);
}

function band(centerSecPerKm: number, pct: number): [number, number] {
  return [centerSecPerKm * (1 - pct), centerSecPerKm * (1 + pct)];
}

function deriveXcAnchoredZones(goalDistanceM: number, goalTimeS: number): PaceZones {
  // Riegel is most reliable 5K-through-marathon; bridging down from a
  // shorter goal (mile, 3200m) is less precise but still the best available
  // anchor for formulas that are themselves defined in terms of 5K pace.
  const fiveKSeconds = predictRaceTime(goalDistanceM, goalTimeS, 5000);
  const fiveKSecPerKm = fiveKSeconds / 5;

  const interval = band(fiveKSecPerKm, XC_BAND_PCT);
  const tempo = band(fiveKSecPerKm / 0.93, XC_BAND_PCT);

  const [minOffsetMi, maxOffsetMi] = XC_EASY_OFFSET_SEC_PER_MILE;
  const easyBandWidthSecPerKm = secPerMileOffsetToSecPerKm(maxOffsetMi - minOffsetMi);
  const easyFastEndRaw = fiveKSecPerKm + secPerMileOffsetToSecPerKm(minOffsetMi);
  const easyFastEnd = Math.max(easyFastEndRaw, tempo[1] + MIN_ZONE_GAP_SEC_PER_KM);
  const easy: [number, number] = [easyFastEnd, easyFastEnd + easyBandWidthSecPerKm];

  // Long runs at this level are run "relaxed, good rhythm... time on your
  // feet rather than pace" -- the same effort as an easy day, not a
  // distinct harder zone -- so steady sits in the gap between tempo and
  // easy rather than from its own independent formula. The gap is always
  // positive by construction (easy is clamped above to stay past tempo).
  const gapStart = tempo[1];
  const gapSize = easy[0] - gapStart;
  const steady: [number, number] = [gapStart + gapSize * 0.25, gapStart + gapSize * 0.75];

  return { interval, tempo, steady, easy };
}

function deriveLongBucketZones(goalDistanceM: number, goalTimeS: number): PaceZones {
  const goalPaceSecPerKm = goalTimeS / (goalDistanceM / 1000);
  const zone = ([lo, hi]: [number, number]): [number, number] => [goalPaceSecPerKm * lo, goalPaceSecPerKm * hi];
  return {
    interval: zone(LONG_BUCKET_MULTIPLIERS.interval),
    tempo: zone(LONG_BUCKET_MULTIPLIERS.tempo),
    steady: zone(LONG_BUCKET_MULTIPLIERS.steady),
    easy: zone(LONG_BUCKET_MULTIPLIERS.easy),
  };
}

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
  const bucket: DistanceBucket = distanceBucket(goalDistanceM);
  return bucket === "long" ? deriveLongBucketZones(goalDistanceM, goalTimeS) : deriveXcAnchoredZones(goalDistanceM, goalTimeS);
}
