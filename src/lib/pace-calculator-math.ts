// Riegel's power-law race-time prediction (exponent 1.06) and the training-
// pace zones (Easy, Tempo/Threshold, VO2-oriented reps, Marathon) the Pace &
// Heart Rate Calculator derives from it. Extracted out of
// pace-calculator.tsx -- previously the one calculator on this site whose
// prediction math lived entirely inline -- so the interactive pace-model
// comparison on choosing-a-pace-calculator can reuse these exact functions
// with zero risk of drifting from what the standalone calculator displays,
// matching the pure/testable-math-module split every other calculator here
// already follows (Tinman, Threshold/CV/VO2max, the HR model).

import { metersFor } from "@/lib/race-distances";

export const RIEGEL_EXPONENT = 1.06;
const MARATHON_METERS = metersFor("marathon");
const MILE_METERS = metersFor("mile");

export function predictSeconds(knownMeters: number, knownSeconds: number, targetMeters: number): number {
  return knownSeconds * Math.pow(targetMeters / knownMeters, RIEGEL_EXPONENT);
}

// A recent race predicts marathon fitness less reliably the further it sits
// from marathon distance, since it has to bridge fatigue resistance and
// fueling demands a shorter race never tests. This is a rough, illustrative
// widening -- not a statistically derived confidence interval.
export function marathonRangeSeconds(pointSeconds: number, fromMeters: number): [number, number] {
  const gap = Math.log2(MARATHON_METERS / Math.max(fromMeters, 1500));
  const pct = Math.min(0.1, Math.max(0.02, gap * 0.012));
  return [pointSeconds * (1 - pct), pointSeconds * (1 + pct)];
}

export type Course = "track" | "xc";

export type PaceCalculatorTrainingPaces = {
  /** sec/mile */
  easyPaceRange: [number, number];
  /** sec/mile */
  tempoThresholdPaceSecPerMile: number;
  /** sec/mile */
  vo2OrientedPaceSecPerMile: number;
  /** sec/mile */
  marathonPaceRange: [number, number];
  /** sec/mile */
  marathonPaceMidSecPerMile: number;
  /** Raw finish-time seconds over the full marathon distance (not a pace). */
  marathonFinishRangeSeconds: [number, number];
};

// Easy/Tempo/VO2-oriented are anchored to cross country 5K effort
// specifically (the benchmark the underlying training system is built
// around) -- `xcAdjustment` converts between the input race's surface and
// that XC benchmark in whichever direction `course` requires. Marathon
// instead predicts directly off the input's own effort (`course === "xc"`
// normalizes a muddy/hilly XC time toward its flat-effort equivalent before
// the marathon projection; a non-XC input needs no such normalization).
export function calculatePaceCalculatorTrainingPaces(
  distanceMeters: number,
  raceSeconds: number,
  course: Course,
  xcAdjustment: number,
): PaceCalculatorTrainingPaces {
  const effectiveSeconds = course === "xc" ? raceSeconds * xcAdjustment : raceSeconds;
  const xcAnchorSeconds = course === "xc" ? raceSeconds : raceSeconds / xcAdjustment;

  const xcFiveKSeconds = predictSeconds(distanceMeters, xcAnchorSeconds, 5000);
  const xcFiveKPace = xcFiveKSeconds / (5000 / MILE_METERS);

  const marathonSeconds = predictSeconds(distanceMeters, effectiveSeconds, MARATHON_METERS);
  const marathonFinishRangeSeconds = marathonRangeSeconds(marathonSeconds, distanceMeters);
  const marathonPaceRange: [number, number] = [
    marathonFinishRangeSeconds[0] / (MARATHON_METERS / MILE_METERS),
    marathonFinishRangeSeconds[1] / (MARATHON_METERS / MILE_METERS),
  ];

  return {
    easyPaceRange: [xcFiveKPace + 90, xcFiveKPace + 150],
    tempoThresholdPaceSecPerMile: xcFiveKPace / 0.93,
    vo2OrientedPaceSecPerMile: xcFiveKPace,
    marathonPaceRange,
    marathonPaceMidSecPerMile: (marathonPaceRange[0] + marathonPaceRange[1]) / 2,
    marathonFinishRangeSeconds,
  };
}
