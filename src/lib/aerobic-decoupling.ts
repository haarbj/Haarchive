export type DecouplingStream = {
  /** Seconds elapsed since the start of the activity, one entry per sample. */
  timeS: number[];
  /** Cumulative meters from the start of the activity, same length as timeS. */
  distanceM: number[];
  /** Beats per minute, same length as timeS. */
  heartrateBpm: number[];
};

export type DecouplingResult = {
  decouplingPct: number;
  firstHalfPaceMS: number;
  secondHalfPaceMS: number;
  firstHalfAvgHr: number;
  secondHalfAvgHr: number;
};

// Aerobic decoupling ("Pw:HR" or "EF drift") -- how much a runner's pace:HR
// efficiency falls off between the first and second half of a continuous
// effort. A well-developed aerobic base holds efficiency flat through a
// long steady run; a rising HR for the same pace (or a falling pace for
// the same HR) as the run goes on reflects cardiac drift, heat, fueling,
// or under-conditioning -- a genuinely useful, widely-used training signal
// (popularized by TrainingPeaks/Joe Friel), not a novel metric invented
// here. Requires a real HR stream, which Strava only returns for
// activities recorded with a heart-rate monitor -- absent for the rest,
// hence the nullable outputs everywhere a stream might not exist.
const MIN_DURATION_SECONDS = 20 * 60;
const MIN_SAMPLES = 20;

export function computeAerobicDecoupling(stream: DecouplingStream): DecouplingResult | null {
  const { timeS, distanceM, heartrateBpm } = stream;
  if (timeS.length < MIN_SAMPLES || distanceM.length !== timeS.length || heartrateBpm.length !== timeS.length) {
    return null;
  }

  const totalDurationS = timeS[timeS.length - 1] - timeS[0];
  if (!Number.isFinite(totalDurationS) || totalDurationS < MIN_DURATION_SECONDS) return null;

  const midpointS = timeS[0] + totalDurationS / 2;
  const midpointIndex = timeS.findIndex((t) => t >= midpointS);
  if (midpointIndex < 1 || midpointIndex >= timeS.length - 1) return null;

  function halfStats(startIndex: number, endIndex: number): { paceMS: number; avgHr: number } | null {
    const durationS = timeS[endIndex] - timeS[startIndex];
    const distanceCoveredM = distanceM[endIndex] - distanceM[startIndex];
    if (durationS <= 0 || distanceCoveredM <= 0) return null;

    const hrSamples = heartrateBpm.slice(startIndex, endIndex + 1).filter((hr) => Number.isFinite(hr) && hr > 0);
    if (hrSamples.length === 0) return null;
    const avgHr = hrSamples.reduce((sum, hr) => sum + hr, 0) / hrSamples.length;

    return { paceMS: distanceCoveredM / durationS, avgHr };
  }

  const firstHalf = halfStats(0, midpointIndex);
  const secondHalf = halfStats(midpointIndex, timeS.length - 1);
  if (!firstHalf || !secondHalf) return null;

  const firstEfficiency = firstHalf.paceMS / firstHalf.avgHr;
  const secondEfficiency = secondHalf.paceMS / secondHalf.avgHr;
  const decouplingPct = ((firstEfficiency - secondEfficiency) / firstEfficiency) * 100;

  return {
    decouplingPct,
    firstHalfPaceMS: firstHalf.paceMS,
    secondHalfPaceMS: secondHalf.paceMS,
    firstHalfAvgHr: firstHalf.avgHr,
    secondHalfAvgHr: secondHalf.avgHr,
  };
}
