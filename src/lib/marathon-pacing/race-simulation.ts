import { computeMileResultsForEffort, type MileDurationInputs } from "@/lib/marathon-pacing/split-generator";

export type FitnessPercentiles = { p10: number; p50: number; p90: number };

export type RaceSimulationResult = {
  /** Ascending. */
  finishTimesSeconds: number[];
};

// Critical speed is the only fitness input that actually changes a mile's
// duration in computeMileResultsForEffort -- vo2maxSpeedMS only feeds
// physiology-engine.ts's fatigue-state tracking, which generatePacingPlan
// records for display but never feeds back into pace/duration. So
// resampling vo2maxSpeedMS here would add simulation cost for zero effect
// on the actual output; only criticalSpeedMS uncertainty is worth
// resampling for a finish-time distribution.
//
// A split-normal (two-piece Gaussian) fit to the model's own p10/p50/p90,
// not an independent assumption: the CV-Threshold model's quantile
// regression can (and often does) produce an asymmetric spread around the
// median, so this uses a different standard deviation above versus below
// p50 rather than forcing symmetry, while still only ever encoding the
// three numbers the model actually gave us -- no more precision than
// that. Sigma is derived from the 10th/90th percentile via the standard
// normal's z = 1.2816 at those percentiles.
const Z_AT_P10_P90 = 1.2816;

export function sampleCriticalSpeedMS(percentiles: FitnessPercentiles, standardNormalZ: number): number {
  const sigmaUpper = Math.max(0, percentiles.p90 - percentiles.p50) / Z_AT_P10_P90;
  const sigmaLower = Math.max(0, percentiles.p50 - percentiles.p10) / Z_AT_P10_P90;
  const sigma = standardNormalZ >= 0 ? sigmaUpper : sigmaLower;
  return percentiles.p50 + standardNormalZ * sigma;
}

// Box-Muller, using the injected `random` only so this stays deterministic
// and testable -- production call sites just use the default Math.random.
export function sampleStandardNormal(random: () => number = Math.random): number {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const DEFAULT_ITERATIONS = 400;

// Holds the actual planned effort curve fixed (goalEffortFraction and every
// other input to computeMileResultsForEffort came from one already-solved
// plan) and re-runs it many times with the runner's true race-day critical
// speed resampled from the fitness model's own uncertainty -- this answers
// "if my fitness on the day differs from my estimate, but I execute the
// same plan, what does that produce," not "what if I re-planned for a
// different fitness" (which is a different, less useful question: see
// split-generator.ts's own module doc on why the effort solve is terrain-
// only and never re-targets a goal against fitness).
export function simulateFinishTimes(
  goalEffortFraction: number,
  baseInputs: MileDurationInputs,
  criticalSpeedPercentiles: FitnessPercentiles,
  iterations: number = DEFAULT_ITERATIONS,
  random: () => number = Math.random,
): RaceSimulationResult {
  const finishTimesSeconds: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const z = sampleStandardNormal(random);
    const sampledCriticalSpeedMS = sampleCriticalSpeedMS(criticalSpeedPercentiles, z);
    const mileResults = computeMileResultsForEffort(
      goalEffortFraction,
      { ...baseInputs, criticalSpeedMS: sampledCriticalSpeedMS },
      true,
    );
    finishTimesSeconds.push(mileResults.reduce((sum, r) => sum + r.durationSeconds, 0));
  }
  finishTimesSeconds.sort((a, b) => a - b);
  return { finishTimesSeconds };
}

export function percentileFinishTime(result: RaceSimulationResult, percentile: number): number {
  const { finishTimesSeconds } = result;
  const index = Math.min(
    finishTimesSeconds.length - 1,
    Math.max(0, Math.round((percentile / 100) * (finishTimesSeconds.length - 1))),
  );
  return finishTimesSeconds[index];
}

export function probabilityUnder(result: RaceSimulationResult, seconds: number): number {
  const countUnder = result.finishTimesSeconds.filter((t) => t <= seconds).length;
  return countUnder / result.finishTimesSeconds.length;
}
