// Builds the mile-by-mile idealized pace plan this tool's whole output is
// built from: a goal pace shaped into either a progressive or even opening,
// a fast finish in the closing miles, and a simplified grade adjustment on
// top of that.
//
// This is deliberately NOT the Marathon Pacing Calculator's physics engine
// (course-analysis.ts/mile-cost-model.ts's Minetti-polynomial terrain cost,
// solved against a GPS route at ~20m resolution). That tool answers "what
// does this specific course really cost, mile by mile, given my tracked
// fatigue state" -- this one answers a narrower, more approachable
// question: "given a goal pace and the handful of hills someone can name
// off a course map, roughly how should I shape my effort." A runner who
// wants the precise version already has that tool; this one is the
// read-the-course-map-and-go version, not a worse copy of it. See
// race-pace-planner.tsx's own links out to Marathon Pacing Calculator and
// GAP Calculator for the precise alternative.
//
// The grade heuristic below (roughly +12 sec/mi per 100ft of climb,
// -6 sec/mi per 100ft of descent, net change under NOISE_THRESHOLD_FT_PER_MILE
// ignored) is a commonly-cited rough rule of thumb for marathon-pace
// effort, not a fitted physical model -- it deliberately trades precision
// for something a runner can sanity-check by eye. It also only ever sees
// the climbs a runner names explicitly (see RaceClimb below): it has no
// way to "discover" a mid-mile hill that isn't named, which is a real
// known limitation of working from a course description instead of a GPS
// track -- stated explicitly in the tool's own copy, not hidden.

import { formatClock } from "@/lib/running-format";

export const MARATHON_MILES = 26; // full miles only -- see the module doc above and split-generator.ts's own precedent for not splitting out the final partial 0.2mi
const FEET_PER_MILE_NOISE_THRESHOLD = 15; // a net per-mile elevation change at or below this is ~5 sec of noise, not worth adjusting for
const UPHILL_SEC_PER_MILE_PER_100FT = 12;
const DOWNHILL_SEC_PER_MILE_PER_100FT = -6; // smaller magnitude than uphill -- downhill gives back less than an equivalent climb costs, the same uphill/downhill asymmetry the GAP Calculator's real physics shows

const PROGRESSIVE_OPENING_MILE1_DELTA_SEC = 18; // mile 1 runs ~18s/mi slower than goal pace under a progressive start
const PROGRESSIVE_CONVERGE_BY_MILE = 5; // and has fully converged to goal pace by this mile

const FINISH_KICK_WINDOW_MILES = 5; // final N miles get the fast-finish treatment
const FINISH_KICK_SEC_PER_MILE = -4; // ~4s/mi faster than goal pace during that window, ramped in rather than a step

export type StartStrategy = "progressive" | "even";

export type RaceClimb = {
  /** The mile this climb/descent starts at (1-indexed). */
  atMile: number;
  /** How many miles the grade change spans. */
  lengthMiles: number;
  /** Total elevation change over that span, in feet (always positive -- direction is separate). */
  feet: number;
  direction: "climb" | "descent";
};

export type CourseInput = {
  /** Total elevation gain for the full course, in feet -- used only for the summary card's "hills changed your pace by" framing; the per-mile adjustment itself comes from `climbs`. */
  totalGainFt: number;
  totalLossFt: number;
  climbs: RaceClimb[];
};

export const FLAT_COURSE: CourseInput = { totalGainFt: 0, totalLossFt: 0, climbs: [] };

export type EffortLabel = "Relaxed" | "Settling in" | "Marathon effort" | "Comfortably hard" | "Strong finish";

export type PlanMile = {
  mile: number;
  /** Idealized pace before any grade adjustment, in seconds/mile. */
  flatPaceSecPerMile: number;
  /** Net elevation change this mile, in feet (positive = net climb). */
  netGradeFt: number;
  /** Grade adjustment actually applied, in seconds/mile (0 if within the noise threshold). */
  gradeAdjustSecPerMile: number;
  /** Final target pace a runner should actually watch for, in seconds/mile. */
  watchPaceSecPerMile: number;
  elapsedSeconds: number;
  effort: EffortLabel;
};

export type RacePacePlan = {
  miles: PlanMile[];
  goalPaceSecPerMile: number;
  totalElapsedSeconds: number;
  finishKickStartMile: number;
};

/** Marathon goal time -> idealized flat goal pace, seconds/mile. */
export function goalPaceSecPerMileFromGoalTime(goalTimeSeconds: number): number {
  return goalTimeSeconds / MARATHON_MILES;
}

function flatPaceDeltaForMile(mile: number, strategy: StartStrategy): number {
  const inFinishKick = mile > MARATHON_MILES - FINISH_KICK_WINDOW_MILES;
  if (inFinishKick) {
    // Ramp the kick in rather than snapping to it on the first finish-kick
    // mile -- a runner can't execute an instant pace change any more than
    // the split-generator.ts strategies this mirrors can.
    const milesIntoKick = mile - (MARATHON_MILES - FINISH_KICK_WINDOW_MILES);
    const rampFraction = milesIntoKick / FINISH_KICK_WINDOW_MILES;
    return FINISH_KICK_SEC_PER_MILE * rampFraction;
  }
  if (strategy === "even") return 0;
  if (mile >= PROGRESSIVE_CONVERGE_BY_MILE) return 0;
  // Linear converge from the mile-1 delta down to 0 by PROGRESSIVE_CONVERGE_BY_MILE.
  const rampFraction = 1 - (mile - 1) / (PROGRESSIVE_CONVERGE_BY_MILE - 1);
  return PROGRESSIVE_OPENING_MILE1_DELTA_SEC * rampFraction;
}

/** Net elevation change (feet) for one mile, from the named climbs that cover it. */
function netGradeFtForMile(mile: number, climbs: RaceClimb[]): number {
  let net = 0;
  for (const climb of climbs) {
    const start = climb.atMile;
    const end = climb.atMile + climb.lengthMiles;
    if (mile >= start && mile < end) {
      const perMileFt = climb.feet / Math.max(climb.lengthMiles, 1);
      net += climb.direction === "climb" ? perMileFt : -perMileFt;
    }
  }
  return net;
}

function gradeAdjustSecPerMile(netGradeFt: number): number {
  if (Math.abs(netGradeFt) <= FEET_PER_MILE_NOISE_THRESHOLD) return 0;
  const magnitudeHundredFt = Math.abs(netGradeFt) / 100;
  return netGradeFt > 0
    ? magnitudeHundredFt * UPHILL_SEC_PER_MILE_PER_100FT
    : magnitudeHundredFt * DOWNHILL_SEC_PER_MILE_PER_100FT;
}

function effortForMile(mile: number, netGradeFt: number, strategy: StartStrategy): EffortLabel {
  const inFinishKick = mile > MARATHON_MILES - FINISH_KICK_WINDOW_MILES;
  const inOpening = strategy === "progressive" && mile < PROGRESSIVE_CONVERGE_BY_MILE;
  let base: EffortLabel = inFinishKick ? "Strong finish" : inOpening ? "Relaxed" : "Marathon effort";
  if (base === "Relaxed" && mile >= PROGRESSIVE_CONVERGE_BY_MILE - 2) base = "Settling in";
  // A real climb bumps the felt effort up a tier even though the pace
  // itself already slowed down for it -- the whole point of running
  // grade-adjusted is that the effort, not the pace, should stay level,
  // so a climb mile should still read as harder than a flat one at the
  // same nominal effort tier.
  if (Math.abs(netGradeFt) > FEET_PER_MILE_NOISE_THRESHOLD && netGradeFt > 0 && base !== "Strong finish") {
    return "Comfortably hard";
  }
  return base;
}

export function buildRacePacePlan(goalTimeSeconds: number, strategy: StartStrategy, course: CourseInput): RacePacePlan {
  const goalPaceSecPerMile = goalPaceSecPerMileFromGoalTime(goalTimeSeconds);
  const miles: PlanMile[] = [];
  let elapsed = 0;

  for (let mile = 1; mile <= MARATHON_MILES; mile += 1) {
    const flatPaceSecPerMile = goalPaceSecPerMile + flatPaceDeltaForMile(mile, strategy);
    const netGradeFt = netGradeFtForMile(mile, course.climbs);
    const adjust = gradeAdjustSecPerMile(netGradeFt);
    const watchPaceSecPerMile = flatPaceSecPerMile + adjust;
    elapsed += watchPaceSecPerMile;
    miles.push({
      mile,
      flatPaceSecPerMile,
      netGradeFt,
      gradeAdjustSecPerMile: adjust,
      watchPaceSecPerMile,
      elapsedSeconds: elapsed,
      effort: effortForMile(mile, netGradeFt, strategy),
    });
  }

  return {
    miles,
    goalPaceSecPerMile,
    totalElapsedSeconds: elapsed,
    finishKickStartMile: MARATHON_MILES - FINISH_KICK_WINDOW_MILES + 1,
  };
}

export type Checkpoint = { label: string; mile: number; elapsedSeconds: number };

/**
 * Checkpoint times at 5M, halfway, and 20M -- halfway (13.1mi) falls
 * between mile 13 and mile 14, so its time is interpolated across mile
 * 14's pace rather than rounded to the nearest full mile, since a "where
 * will I be at the half" checkpoint is exactly the kind of number a runner
 * actually checks against a race clock mid-run.
 */
export function buildCheckpoints(plan: RacePacePlan): Checkpoint[] {
  const mile5 = plan.miles[4];
  const mile13 = plan.miles[12];
  const mile14 = plan.miles[13];
  const mile20 = plan.miles[19];
  const halfwayElapsed = mile13.elapsedSeconds + mile14.watchPaceSecPerMile * 0.1;

  return [
    { label: "5 miles", mile: 5, elapsedSeconds: mile5.elapsedSeconds },
    { label: "Halfway (13.1mi)", mile: 13.1, elapsedSeconds: halfwayElapsed },
    { label: "20 miles", mile: 20, elapsedSeconds: mile20.elapsedSeconds },
  ];
}

/** The average grade-adjustment swing across any named climbs/descents -- the "roughly how much the hills change your pace" summary-card number, not a precise total. */
export function averageHillImpactSecPerMile(plan: RacePacePlan): number {
  const hillMiles = plan.miles.filter((m) => m.gradeAdjustSecPerMile !== 0);
  if (hillMiles.length === 0) return 0;
  const total = hillMiles.reduce((sum, m) => sum + m.gradeAdjustSecPerMile, 0);
  return total / hillMiles.length;
}

export function formatPace(secPerMile: number): string {
  return `${formatClock(Math.round(secPerMile))}/mi`;
}
