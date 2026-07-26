// Rounds the engine's precise per-mile paces to numbers a runner can
// actually hold in their head on race day -- "6:20, 6:15, 6:10" is a plan;
// "6:22, 6:16, 6:11" reads as false precision nobody can execute anyway.
// No road marathon has the mile-marker accuracy of a track, so splitting to
// the exact second was never real precision to begin with, just precision
// theater. The underlying engine (split-generator.ts etc.) still computes
// and tracks everything at full precision internally -- physiology state,
// fueling timing, and course analysis all need that -- this is purely a
// final display-layer transform, applied only to what's shown in the table.
//
// Each mile's pace is NOT independently rounded -- rounding every mile on
// its own compounds: a runner averaging 6:23/mi would see every single mile
// round up to 6:25, a 2s/mi error that adds up to nearly a minute over a
// marathon (a real report). Instead, the CUMULATIVE elapsed time at each
// mile marker is rounded to the nearest 5s, and each mile's displayed pace
// is the difference between consecutive rounded cumulative times -- the
// same error-diffusion technique used for apportionment/dithering problems
// generally. This bounds the drift between the true total and the
// displayed total to at most half the rounding granularity (2.5s) at
// EVERY mile marker, not just the end, and it self-corrects every couple
// of miles (alternating slightly-long/slightly-short splits) rather than
// drifting in one direction for the whole race.

import type { MileSplit } from "@/lib/marathon-pacing/split-generator";

const DISPLAY_ROUNDING_SECONDS = 5;

export type DisplayMileSplit = {
  mile: number;
  displayPaceSecPerMile: number;
  displayElapsedSeconds: number;
};

function roundToNearest(value: number, nearest: number): number {
  return Math.round(value / nearest) * nearest;
}

export function buildDisplaySplits(splits: MileSplit[], roundingSeconds: number = DISPLAY_ROUNDING_SECONDS): DisplayMileSplit[] {
  let preciseCumulativeSeconds = 0;
  let previousRoundedCumulativeSeconds = 0;

  return splits.map((split) => {
    preciseCumulativeSeconds += split.paceSecPerMile;
    const roundedCumulativeSeconds = roundToNearest(preciseCumulativeSeconds, roundingSeconds);
    const displayPaceSecPerMile = roundedCumulativeSeconds - previousRoundedCumulativeSeconds;
    previousRoundedCumulativeSeconds = roundedCumulativeSeconds;
    return { mile: split.mile, displayPaceSecPerMile, displayElapsedSeconds: roundedCumulativeSeconds };
  });
}
