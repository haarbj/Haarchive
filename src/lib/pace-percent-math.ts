// Core math behind percentage-based interval training (the method Renato
// Canova and other coaches use to prescribe workout paces as a percentage
// of a reference race pace) -- adapted from John Davis's pace-percents
// calculator (github.com/johnjdavisiv/pace-percents, MIT licensed), whose
// README explains the reasoning behind these formulas in more depth.
//
// PaceUnit and its parse/format helpers below are also reused by
// cv-threshold-calculator.tsx -- both tools need the same "mi/km parse as
// mm:ss, 400m/200m parse as a bare-or-decimal track split" behavior, so it
// lives here once rather than being copy-pasted into each tool.

import { formatClock, formatTrackTime, parseTimeToSeconds, parseTrackTime } from "@/lib/running-format";

export type PercentBasis = "pace" | "speed";

// Percent of PACE is not the same as percent of speed, and the difference
// is the whole reason this tool (and Canova's own convention) exists: pace
// and speed are inverses of each other, so a naive "multiply the pace by
// the percentage" is actually percent-of-speed math, not percent-of-pace.
//
// Percent of pace is instead defined to be linear and symmetric in PACE
// units -- each 10% step is a fixed number of seconds/mile regardless of
// the reference pace (90% of 5:00 is 5:30, 80% of 5:00 is 6:00: each step
// down is +30s). That symmetry is why Canova prefers it: a given percentage
// gap feels like a consistent effort jump whether the reference pace is
// fast or slow. The formula that produces it: resultPace = refPace * (2 - x),
// where x = percent/100 -- equivalent to refPace + refPace * (1 - x), i.e.
// "add back the complement of the percentage, in pace units."
//
// Percent of speed is the more intuitive inverse-proportion version:
// resultPace = refPace / x. This is what most people guess percent-of-pace
// means, and it's genuinely useful too (it's what exercise-science research
// typically means by "percent of velocity"), which is why this tool
// supports both rather than picking one silently.
export function computeWorkoutPaceSeconds(
  referenceSeconds: number,
  percent: number,
  basis: PercentBasis,
): number {
  const x = percent / 100;
  return basis === "pace" ? referenceSeconds * (2 - x) : referenceSeconds / x;
}

// The inverse of computeWorkoutPaceSeconds -- given a pace you actually ran
// (or want to run) at a known percentage, solve for what reference pace
// that implies. Useful when a workout went better or worse than planned:
// "I ran 5:24/mi at what I intended to be 90% effort -- what does that say
// my current reference pace actually is?"
export function computeReferencePaceSeconds(
  resultSeconds: number,
  percent: number,
  basis: PercentBasis,
): number {
  const x = percent / 100;
  return basis === "pace" ? resultSeconds / (2 - x) : resultSeconds * x;
}

export type PaceUnit = "mi" | "km" | "400m" | "200m";
export type SpeedUnit = "mph" | "kph" | "mps";

export const PACE_UNIT_METERS: Record<PaceUnit, number> = {
  mi: 1609.344,
  km: 1000,
  "400m": 400,
  "200m": 200,
};

export const PACE_UNIT_LABEL: Record<PaceUnit, string> = {
  mi: "/mi",
  km: "/km",
  "400m": "/400m",
  "200m": "/200m",
};

export const SPEED_UNIT_LABEL: Record<SpeedUnit, string> = {
  mph: "mph",
  kph: "km/h",
  mps: "m/s",
};

// Every pace unit (mi/km/400m) is just seconds per some number of meters,
// so any pace-to-pace conversion is one division and one multiplication
// through meters-per-second -- no per-pair lookup table needed (the
// original tool hand-wrote a 15-entry dictionary keyed by string-joined
// unit pairs; this covers the same ground with three constants).
export function convertPaceSeconds(seconds: number, fromUnit: PaceUnit, toUnit: PaceUnit): number {
  const secondsPerMeter = seconds / PACE_UNIT_METERS[fromUnit];
  return secondsPerMeter * PACE_UNIT_METERS[toUnit];
}

export function paceSecondsToSpeed(seconds: number, unit: PaceUnit, speedUnit: SpeedUnit): number {
  const metersPerSecond = PACE_UNIT_METERS[unit] / seconds;
  switch (speedUnit) {
    case "mph":
      return (metersPerSecond * 3600) / 1609.344;
    case "kph":
      return (metersPerSecond * 3600) / 1000;
    case "mps":
      return metersPerSecond;
  }
}

// 400m/200m paces are commonly sub-60-second track splits (e.g. "68.4"),
// which mm:ss parsing/formatting can't represent -- mi/km paces never are.
function isTrackSplitUnit(unit: PaceUnit): boolean {
  return unit === "400m" || unit === "200m";
}

export function parsePaceInput(input: string, unit: PaceUnit): number | null {
  return isTrackSplitUnit(unit) ? parseTrackTime(input) : parseTimeToSeconds(input);
}

export function formatPaceOutput(seconds: number, unit: PaceUnit): string {
  return isTrackSplitUnit(unit) ? formatTrackTime(seconds) : formatClock(seconds);
}
