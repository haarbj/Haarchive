// Metabolic-cost model for wind on a 400m track, ported from the physics
// in johnjdavisiv/track-wind-calc (MIT license). Reuses the road model's
// primitives from wind-physics.ts (treadmill cost, frontal area, drag
// force, the wind-profile power law) and adds what a track specifically
// needs on top:
//
//   - The runner's heading rotates continuously through the curves, so
//     "how much headwind am I fighting" isn't one number for a whole rep
//     -- it's integrated numerically around each bend (a Riemann sum:
//     each curve sliced into many tiny straight segments, evaluated
//     individually, then summed).
//   - Non-standard rep distances (200/600/1000m) cover a specific,
//     different combination of curves and straights depending on where
//     they start -- which is exactly why an "alt" starting line can be a
//     real, exploitable choice on a windy day.
//   - A second, independent question beyond "actual pace vs. calm-air
//     effort": did the wind-affected rep hold constant speed (like
//     following a pacing light) or constant effort (like most runners
//     actually do, letting splits drift with the wind)? These produce
//     different average times, so both are modeled as distinct cases.

import { dragForceN, frontalAreaM2, metabolicCostPctFromForwardDragN, treadmillCostWPerKg, windAtChestHeightMS, type WindProfile } from "@/lib/wind-physics";

export const TRACK_RADIUS_M = 36.5; // World Athletics standard, to the actual running line
const TRACK_DISTANCE_M = 400;
export const CURVE_DISTANCE_M = Math.PI * TRACK_RADIUS_M; // ~114.7m per curve
export const STRAIGHT_DISTANCE_M = 0.5 * (TRACK_DISTANCE_M - 2 * CURVE_DISTANCE_M); // ~85.3m per straight

export type RepType = "200m" | "200m-alt" | "400m" | "600m" | "600m-alt" | "1000m" | "1000m-alt";

export type RepSegments = {
  distanceM: number;
  firstCurveLaps: number;
  backstretchLaps: number;
  secondCurveLaps: number;
  homestretchLaps: number;
};

// How many times each rep covers each of the track's four segments.
// Non-integer-lap reps (200/600/1000m) necessarily start partway around,
// so the "alt" variants exist because *which* segment you skip is a real
// choice: a 600m covers the homestretch twice but the backstretch once,
// while a 600m-alt does the reverse.
export const REP_SEGMENTS: Record<RepType, RepSegments> = {
  "200m": { distanceM: 200, firstCurveLaps: 0, backstretchLaps: 0, secondCurveLaps: 1, homestretchLaps: 1 },
  "200m-alt": { distanceM: 200, firstCurveLaps: 1, backstretchLaps: 1, secondCurveLaps: 0, homestretchLaps: 0 },
  "400m": { distanceM: 400, firstCurveLaps: 1, backstretchLaps: 1, secondCurveLaps: 1, homestretchLaps: 1 },
  "600m": { distanceM: 600, firstCurveLaps: 1, backstretchLaps: 1, secondCurveLaps: 2, homestretchLaps: 2 },
  "600m-alt": { distanceM: 600, firstCurveLaps: 2, backstretchLaps: 2, secondCurveLaps: 1, homestretchLaps: 1 },
  "1000m": { distanceM: 1000, firstCurveLaps: 2, backstretchLaps: 2, secondCurveLaps: 3, homestretchLaps: 3 },
  "1000m-alt": { distanceM: 1000, firstCurveLaps: 3, backstretchLaps: 3, secondCurveLaps: 2, homestretchLaps: 2 },
};

export const REP_TYPE_OPTIONS: { value: RepType; label: string }[] = [
  { value: "200m", label: "200m" },
  { value: "200m-alt", label: "200m (other start)" },
  { value: "400m", label: "400m" },
  { value: "600m", label: "600m" },
  { value: "600m-alt", label: "600m (other start)" },
  { value: "1000m", label: "1000m" },
  { value: "1000m-alt", label: "1000m (other start)" },
];

// Which rep type is the "other starting line" for the same distance --
// used to auto-compare and recommend whichever actually spends less time
// fighting the wind today. 400m has no alt: a full lap covers every
// segment once regardless of where it starts.
export const ALT_PAIR: Partial<Record<RepType, RepType>> = {
  "200m": "200m-alt",
  "200m-alt": "200m",
  "600m": "600m-alt",
  "600m-alt": "600m",
  "1000m": "1000m-alt",
  "1000m-alt": "1000m",
};

// Plain-language description of which segments a rep actually covers --
// this is what "(other start)" means in practice, since a non-integer
// number of laps has to start partway around the track. Written out by
// hand rather than generated from REP_SEGMENTS, since the numbers alone
// don't read as a clean sentence.
export const REP_DESCRIPTIONS: Record<RepType, string> = {
  "200m": "Covers the far curve and the home straight only.",
  "200m-alt": "Covers the near curve and the back straight only — the other half of the lap from the standard 200m.",
  "400m": "A full lap — every curve and straight, once each.",
  "600m": "A lap and a half: two trips down the home straight, one down the back straight.",
  "600m-alt": "A lap and a half the other way: two trips down the back straight, one down the home straight.",
  "1000m": "Two and a half laps: three trips down the home straight, two down the back straight.",
  "1000m-alt": "Two and a half laps the other way: three trips down the back straight, two down the home straight.",
};

export type PaceOrEffort = "actual-pace" | "calm-day-effort";
export type SpeedOrEffort = "constant-speed" | "constant-effort";

const CURVE_DISCRETE_N = 180; // Riemann-sum slices per curve
const BISECT_N = 24;
const SOLVE_MIN_MS = 0.2;
const SOLVE_MAX_MS = 14; // higher than the road model's 12 -- short/fast reps can exceed it

/**
 * The % change in metabolic cost at one instant on the track: running at
 * `speedMS` while facing `headingRad` (0 = around the first curve/
 * homestretch direction, increasing the way a runner actually travels the
 * track), in a true wind blowing from `windAngleDeg` (this module's
 * convention: 0 = a wind blowing in from straight up the home straight).
 * Uses a direct dot product between the relative-airflow vector and the
 * runner's heading vector to get the forward component of drag -- this
 * sidesteps the atan(y/|x|)-based angle math the road model needs (there,
 * the "angle" is relative to the runner by construction; here, the
 * runner's own heading is already an explicit, continuously-varying input).
 */
function windPctMultiplierAt(speedMS: number, headingRad: number, windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const windAngleRad = (windAngleDeg * Math.PI) / 180;

  // Total relative airflow the runner experiences: their own forward
  // motion plus the true wind vector. Positive x/y here just needs to be
  // an internally consistent 2D frame -- only the angle between this
  // vector and the heading vector below actually matters.
  const airflow = {
    x: -speedMS * Math.cos(headingRad) - trueWindMS * Math.sin(windAngleRad),
    y: -speedMS * Math.sin(headingRad) - trueWindMS * Math.cos(windAngleRad),
  };
  const airflowMagnitude = Math.sqrt(airflow.x ** 2 + airflow.y ** 2);
  if (airflowMagnitude < 1e-9) return 0;

  const heading = { x: Math.cos(headingRad), y: Math.sin(headingRad) };
  const totalDragN = dragForceN(airflowMagnitude, frontalAreaM2(weightKg));

  // Component of the (unit) relative-airflow direction along the runner's
  // heading -- this is what dragForceN's magnitude gets multiplied by to
  // get the actual opposing (or assisting) force along the direction of
  // travel, then sign-flipped since drag opposes the airflow direction.
  const airflowUnit = { x: airflow.x / airflowMagnitude, y: airflow.y / airflowMagnitude };
  const headOnDragN = -1 * totalDragN * (airflowUnit.x * heading.x + airflowUnit.y * heading.y);

  return metabolicCostPctFromForwardDragN(headOnDragN, weightKg);
}

function calmAirRepMetPowerWPerKg(speedMS: number, weightKg: number): number {
  // Calm air is just the zero-true-wind case of windPctMultiplierAt: the
  // runner's own motion is still the only "wind" they experience (a
  // straight-ahead, self-generated headwind equal to their own speed),
  // and any fixed heading works since there's no true wind to be at an
  // angle to.
  const pct = windPctMultiplierAt(speedMS, 0, 0, 0, weightKg);
  return treadmillCostWPerKg(speedMS) * (1 + pct);
}

function straightawayEnergyWPerKgS(headingRad: number, speedMS: number, windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const treadmill = treadmillCostWPerKg(speedMS);
  const pct = windPctMultiplierAt(speedMS, headingRad, windAngleDeg, trueWindMS, weightKg);
  const totalPower = treadmill * (1 + pct);
  const straightTimeS = STRAIGHT_DISTANCE_M / speedMS;
  return straightTimeS * totalPower;
}

function curveEnergyWPerKgS(which: "first" | "second", speedMS: number, windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const thetaStart = which === "first" ? Math.PI : 0;
  const thetaEnd = which === "first" ? 2 * Math.PI : Math.PI;
  const thetaRange = thetaEnd - thetaStart;
  const n = CURVE_DISCRETE_N / 2;
  const dtChord = (thetaRange * TRACK_RADIUS_M) / (n * speedMS);
  const treadmill = treadmillCostWPerKg(speedMS);

  let energy = 0;
  for (let i = 0; i < n; i++) {
    const heading = thetaStart + ((i + 0.5) / n) * thetaRange;
    const pct = windPctMultiplierAt(speedMS, heading, windAngleDeg, trueWindMS, weightKg);
    energy += treadmill * (1 + pct) * dtChord;
  }
  return energy;
}

function avgMetPowerInWindWPerKg(speedMS: number, rep: RepSegments, windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const totalEnergy =
    rep.firstCurveLaps * curveEnergyWPerKgS("first", speedMS, windAngleDeg, trueWindMS, weightKg) +
    rep.backstretchLaps * straightawayEnergyWPerKgS(Math.PI, speedMS, windAngleDeg, trueWindMS, weightKg) +
    rep.secondCurveLaps * curveEnergyWPerKgS("second", speedMS, windAngleDeg, trueWindMS, weightKg) +
    rep.homestretchLaps * straightawayEnergyWPerKgS(0, speedMS, windAngleDeg, trueWindMS, weightKg);
  const repTimeS = rep.distanceM / speedMS;
  return totalEnergy / repTimeS;
}

function bisect(costAt: (v: number) => number, target: number, lo = SOLVE_MIN_MS, hi = SOLVE_MAX_MS): number {
  let low = lo;
  let high = hi;
  for (let i = 0; i < BISECT_N; i++) {
    const mid = (low + high) / 2;
    if (costAt(mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function calmDayEquivalentSpeedMS(targetMetPowerWPerKg: number, weightKg: number): number {
  return bisect((v) => calmAirRepMetPowerWPerKg(v, weightKg), targetMetPowerWPerKg);
}

function speedAtHeadingForPowerMS(targetPowerWPerKg: number, headingRad: number, windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  return bisect((v) => treadmillCostWPerKg(v) * (1 + windPctMultiplierAt(v, headingRad, windAngleDeg, trueWindMS, weightKg)), targetPowerWPerKg);
}

function straightawayTimeAtConstantEffortS(targetPowerWPerKg: number, which: "backstretch" | "homestretch", windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const headingRad = which === "backstretch" ? Math.PI : 0;
  const speed = speedAtHeadingForPowerMS(targetPowerWPerKg, headingRad, windAngleDeg, trueWindMS, weightKg);
  return STRAIGHT_DISTANCE_M / speed;
}

function curveTimeAtConstantEffortS(targetPowerWPerKg: number, which: "first" | "second", windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const thetaStart = which === "first" ? 0 : Math.PI;
  const thetaEnd = which === "first" ? Math.PI : 2 * Math.PI;
  const thetaRange = thetaEnd - thetaStart;
  const n = CURVE_DISCRETE_N / 2;
  const ds = (thetaRange * TRACK_RADIUS_M) / n;

  let totalTimeS = 0;
  for (let i = 0; i < n; i++) {
    const heading = thetaStart + ((i + 0.5) / n) * thetaRange;
    const speed = speedAtHeadingForPowerMS(targetPowerWPerKg, heading, windAngleDeg, trueWindMS, weightKg);
    totalTimeS += ds / speed;
  }
  return totalTimeS;
}

function repTimeInWindAtConstantEffortS(targetPowerWPerKg: number, rep: RepSegments, windAngleDeg: number, trueWindMS: number, weightKg: number): number {
  const tFirstCurve = curveTimeAtConstantEffortS(targetPowerWPerKg, "first", windAngleDeg, trueWindMS, weightKg);
  const tSecondCurve = curveTimeAtConstantEffortS(targetPowerWPerKg, "second", windAngleDeg, trueWindMS, weightKg);
  const tBackstretch = straightawayTimeAtConstantEffortS(targetPowerWPerKg, "backstretch", windAngleDeg, trueWindMS, weightKg);
  const tHomestretch = straightawayTimeAtConstantEffortS(targetPowerWPerKg, "homestretch", windAngleDeg, trueWindMS, weightKg);
  return (
    rep.firstCurveLaps * tFirstCurve +
    rep.backstretchLaps * tBackstretch +
    rep.secondCurveLaps * tSecondCurve +
    rep.homestretchLaps * tHomestretch
  );
}

export type TrackWindInput = {
  /** The speed named by `paceOrEffort` -- either the pace actually run in the wind, or the calm-day goal effort. */
  speedMS: number;
  repType: RepType;
  /** True wind speed at chest height (m/s) -- already adjusted for terrain, e.g. via windAtChestHeightMS. */
  trueWindMS: number;
  /** Wind direction relative to the track, this module's convention: 0 = blowing in from straight up the home straight. */
  windAngleDeg: number;
  weightKg: number;
  paceOrEffort: PaceOrEffort;
  speedOrEffort: SpeedOrEffort;
};

/**
 * Solves one of the four cases (actual-pace/calm-day-effort crossed with
 * constant-speed/constant-effort) and returns the other speed: given an
 * actual pace, the calm-air-equivalent effort it was worth (or vice
 * versa). Returns the average speed (m/s) over the whole rep.
 */
export function solveTrackWindEquivalentSpeedMS(input: TrackWindInput): number {
  const rep = REP_SEGMENTS[input.repType];
  const { speedMS, trueWindMS, windAngleDeg, weightKg, paceOrEffort, speedOrEffort } = input;

  if (paceOrEffort === "actual-pace" && speedOrEffort === "constant-speed") {
    // Case 1: ran this pace, held constant speed through the wind -- what calm-air effort was that?
    const avgPower = avgMetPowerInWindWPerKg(speedMS, rep, windAngleDeg, trueWindMS, weightKg);
    return calmDayEquivalentSpeedMS(avgPower, weightKg);
  }

  if (paceOrEffort === "calm-day-effort" && speedOrEffort === "constant-speed") {
    // Case 2: this calm-day effort, held constant speed in the wind -- what pace does that produce?
    const targetPower = calmAirRepMetPowerWPerKg(speedMS, weightKg);
    return bisect((v) => avgMetPowerInWindWPerKg(v, rep, windAngleDeg, trueWindMS, weightKg), targetPower);
  }

  if (paceOrEffort === "actual-pace" && speedOrEffort === "constant-effort") {
    // Case 3 (the common real-world case): ran this pace, but effort (not speed) was
    // what stayed constant through the wind -- what calm-air effort matches the actual rep time?
    const targetRepTimeS = rep.distanceM / speedMS;
    const targetPower = bisect(
      (p) => -repTimeInWindAtConstantEffortS(p, rep, windAngleDeg, trueWindMS, weightKg),
      -targetRepTimeS,
      0.5,
      100,
    );
    return calmDayEquivalentSpeedMS(targetPower, weightKg);
  }

  // Case 4: this calm-day effort, held constant through the wind -- what actual rep time/pace results?
  const targetPower = calmAirRepMetPowerWPerKg(speedMS, weightKg);
  const repTimeS = repTimeInWindAtConstantEffortS(targetPower, rep, windAngleDeg, trueWindMS, weightKg);
  return rep.distanceM / repTimeS;
}

export { windAtChestHeightMS };
export type { WindProfile };
