// Wind integrated segment-by-segment over an arbitrary route -- the same
// underlying idea as track-wind-physics.ts's curve-by-curve integration
// (a runner's heading changes continuously, so "how much headwind" isn't
// one number for the whole distance), generalized to any sequence of
// (true bearing, distance) segments rather than a fixed 400m oval. A
// GPX/TCX/FIT-derived route is naturally expressed this way already: one
// segment between each pair of consecutive GPS points, each with its own
// true compass bearing.
//
// Deliberately built on wind-physics.ts's road-model functions
// (relativeAngleFromTrueBearing, windForwardLateral,
// metabolicCostInWindWPerKg) rather than reusing track-wind-physics.ts's
// internal geometry -- those already take true bearings directly (exactly
// what's available from consecutive GPS points), and are the same
// already-tested functions the standalone Wind & Pace Calculator's engine
// uses for its own single fixed heading. Cross-checked numerically against
// track-wind-physics.ts's own coordinate convention while building this:
// they are NOT interchangeable (track's headingRad/windAngleDeg pair uses
// a track-relative frame that doesn't map onto true bearings by simple
// substitution), which is why this reuses the road formulas instead.

import {
  metabolicCostInWindWPerKg,
  relativeAngleFromTrueBearing,
  solveSpeedForCost,
  windForwardLateral,
} from "@/lib/wind-physics";

export type RouteHeadingSegment = {
  /** True compass bearing (0 = north) the runner traveled during this segment. */
  headingBearingDeg: number;
  distanceM: number;
};

export type SpeedOrEffort = "constant-speed" | "constant-effort";

export type RouteWindInput = {
  /** The pace actually run over the route, m/s. */
  speedMS: number;
  segments: RouteHeadingSegment[];
  totalDistanceM: number;
  /** Wind speed at chest height (m/s) -- already adjusted for terrain. */
  trueWindMS: number;
  /** Meteorological convention: the compass bearing the wind blows FROM. */
  windFromBearingDeg: number;
  weightKg: number;
  speedOrEffort: SpeedOrEffort;
};

function calmAirPowerWPerKg(speedMS: number, weightKg: number): number {
  return metabolicCostInWindWPerKg(speedMS, 0, 0, weightKg);
}

function segmentPowerWPerKg(
  speedMS: number,
  headingBearingDeg: number,
  windFromBearingDeg: number,
  trueWindMS: number,
  weightKg: number,
): number {
  const relativeAngle = relativeAngleFromTrueBearing(windFromBearingDeg, headingBearingDeg);
  const { forward, lateral } = windForwardLateral(trueWindMS, relativeAngle);
  return metabolicCostInWindWPerKg(speedMS, forward, lateral, weightKg);
}

/** Average metabolic power (W/kg) holding one constant speed over every segment. */
export function avgMetPowerOverRouteWPerKg(
  speedMS: number,
  segments: RouteHeadingSegment[],
  windFromBearingDeg: number,
  trueWindMS: number,
  weightKg: number,
): number {
  let totalEnergyJPerKg = 0;
  let totalTimeS = 0;
  for (const segment of segments) {
    if (segment.distanceM <= 0) continue;
    const segmentTimeS = segment.distanceM / speedMS;
    totalEnergyJPerKg += segmentPowerWPerKg(speedMS, segment.headingBearingDeg, windFromBearingDeg, trueWindMS, weightKg) * segmentTimeS;
    totalTimeS += segmentTimeS;
  }
  return totalTimeS > 0 ? totalEnergyJPerKg / totalTimeS : calmAirPowerWPerKg(speedMS, weightKg);
}

// A floor speed for segments where the target power falls below what's
// achievable even standing still in the wind (a real case: a strong
// headwind's drag on a stationary runner alone can exceed a low target
// power) -- not a realistic pace, just large enough that treating the
// segment as "very slow" rather than silently skipping it (contributing
// zero time) keeps totalTimeAtConstantEffortS monotonically decreasing in
// power, which the outer bisection in solveRouteCalmEquivalentSpeedMS
// depends on to bracket a solution correctly.
const UNREACHABLE_LOW_SPEED_MS = 0.1;
const SEGMENT_SOLVE_MAX_MS = 12; // matches wind-physics.ts's own SOLVE_MAX_MS bracket

/** Total time (s) to cover every segment holding one constant target metabolic power. */
export function totalTimeAtConstantEffortS(
  targetPowerWPerKg: number,
  segments: RouteHeadingSegment[],
  windFromBearingDeg: number,
  trueWindMS: number,
  weightKg: number,
): number {
  let totalTimeS = 0;
  for (const segment of segments) {
    if (segment.distanceM <= 0) continue;
    const relativeAngle = relativeAngleFromTrueBearing(windFromBearingDeg, segment.headingBearingDeg);
    const { forward, lateral } = windForwardLateral(trueWindMS, relativeAngle);
    const costFn = (v: number) => metabolicCostInWindWPerKg(v, forward, lateral, weightKg);
    const speed = solveSpeedForCost(costFn, targetPowerWPerKg);
    const effectiveSpeed = speed ?? (targetPowerWPerKg < costFn(0) ? UNREACHABLE_LOW_SPEED_MS : SEGMENT_SOLVE_MAX_MS);
    totalTimeS += segment.distanceM / effectiveSpeed;
  }
  return totalTimeS;
}

/**
 * The calm-air-equivalent speed for the pace actually run over this route
 * in this wind -- the same "find the equivalent pace" pattern used by
 * every other wind engine on this site. Returns null if the search never
 * brackets a solution (conditions too extreme relative to the pace).
 */
export function solveRouteCalmEquivalentSpeedMS(input: RouteWindInput): number | null {
  const { speedMS, segments, totalDistanceM, windFromBearingDeg, trueWindMS, weightKg, speedOrEffort } = input;

  if (speedOrEffort === "constant-speed") {
    const avgPower = avgMetPowerOverRouteWPerKg(speedMS, segments, windFromBearingDeg, trueWindMS, weightKg);
    return solveSpeedForCost((v) => calmAirPowerWPerKg(v, weightKg), avgPower);
  }

  // Constant effort: the actual pace held is the route's average pace, but
  // effort (not speed) was constant -- find the power level that reproduces
  // the actual total time over these segments (negating both sides of the
  // bisection to flip a decreasing function into an increasing one, the
  // same trick track-wind-physics.ts uses for its own constant-effort case).
  //
  // The search bounds are scaled off the route's own "constant speed" power
  // (always a reachable value for this exact route/wind, by construction)
  // rather than a fixed constant -- a fixed lower bound like 0.5 W/kg can
  // sit below what's achievable at v=0 once wind resistance is factored in
  // (a stationary runner in a strong headwind still has a nonzero minimum
  // cost), which made every per-segment solve inside the search return
  // null and silently corrupt the bisection until this was caught.
  const referencePowerWPerKg = avgMetPowerOverRouteWPerKg(speedMS, segments, windFromBearingDeg, trueWindMS, weightKg);
  const targetTotalTimeS = totalDistanceM / speedMS;
  const targetPower = solveSpeedForCost(
    (power) => -totalTimeAtConstantEffortS(power, segments, windFromBearingDeg, trueWindMS, weightKg),
    -targetTotalTimeS,
    referencePowerWPerKg * 0.3,
    referencePowerWPerKg * 2.5,
  );
  if (targetPower === null) return null;
  return solveSpeedForCost((v) => calmAirPowerWPerKg(v, weightKg), targetPower);
}
