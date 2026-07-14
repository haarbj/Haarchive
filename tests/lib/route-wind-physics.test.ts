import { describe, expect, it } from "vitest";

import {
  avgMetPowerOverRouteWPerKg,
  solveRouteCalmEquivalentSpeedMS,
  totalTimeAtConstantEffortS,
  type RouteHeadingSegment,
} from "@/lib/route-wind-physics";
import { metabolicCostInWindWPerKg, relativeAngleFromTrueBearing, windForwardLateral } from "@/lib/wind-physics";

const weightKg = 70;

describe("avgMetPowerOverRouteWPerKg", () => {
  it("matches the road model's single-heading cost exactly for a one-segment route", () => {
    // A route with just one long straight segment should reduce to
    // exactly the same physics the standalone road WindEngine already
    // uses -- this is the cross-check that justified building this
    // module on the road formulas rather than track-wind-physics.ts's
    // internal (headingRad, windAngleDeg) convention, which turned out
    // NOT to be equivalent to true bearings by simple substitution.
    const speedMS = 4.0;
    const headingBearingDeg = 90; // heading east
    const windFromBearingDeg = 90; // wind from the east -> pure headwind
    const trueWindMS = 5;

    const segments: RouteHeadingSegment[] = [{ headingBearingDeg, distanceM: 1000 }];
    const routeResult = avgMetPowerOverRouteWPerKg(speedMS, segments, windFromBearingDeg, trueWindMS, weightKg);

    const relativeAngle = relativeAngleFromTrueBearing(windFromBearingDeg, headingBearingDeg);
    const { forward, lateral } = windForwardLateral(trueWindMS, relativeAngle);
    const expected = metabolicCostInWindWPerKg(speedMS, forward, lateral, weightKg);

    expect(routeResult).toBeCloseTo(expected, 6);
  });

  it("time-weights multiple segments correctly", () => {
    // Two equal-distance segments at the same speed contribute equal time,
    // so the average should be the plain mean of their individual costs.
    const speedMS = 4.0;
    const windFromBearingDeg = 0;
    const trueWindMS = 4;
    const segments: RouteHeadingSegment[] = [
      { headingBearingDeg: 0, distanceM: 500 }, // headwind
      { headingBearingDeg: 180, distanceM: 500 }, // tailwind
    ];
    const result = avgMetPowerOverRouteWPerKg(speedMS, segments, windFromBearingDeg, trueWindMS, weightKg);

    const costA = metabolicCostInWindWPerKg(
      speedMS,
      windForwardLateral(trueWindMS, relativeAngleFromTrueBearing(windFromBearingDeg, 0)).forward,
      windForwardLateral(trueWindMS, relativeAngleFromTrueBearing(windFromBearingDeg, 0)).lateral,
      weightKg,
    );
    const costB = metabolicCostInWindWPerKg(
      speedMS,
      windForwardLateral(trueWindMS, relativeAngleFromTrueBearing(windFromBearingDeg, 180)).forward,
      windForwardLateral(trueWindMS, relativeAngleFromTrueBearing(windFromBearingDeg, 180)).lateral,
      weightKg,
    );
    expect(result).toBeCloseTo((costA + costB) / 2, 6);
  });

  it("ignores zero-distance segments", () => {
    const segments: RouteHeadingSegment[] = [
      { headingBearingDeg: 45, distanceM: 0 },
      { headingBearingDeg: 90, distanceM: 500 },
    ];
    const withZero = avgMetPowerOverRouteWPerKg(4, segments, 90, 5, weightKg);
    const withoutZero = avgMetPowerOverRouteWPerKg(4, [segments[1]], 90, 5, weightKg);
    expect(withZero).toBeCloseTo(withoutZero, 6);
  });
});

describe("solveRouteCalmEquivalentSpeedMS", () => {
  const headwindSegments: RouteHeadingSegment[] = [{ headingBearingDeg: 90, distanceM: 5000 }];

  it("costs time for a headwind, constant-speed mode", () => {
    const equivalentSpeedMS = solveRouteCalmEquivalentSpeedMS({
      speedMS: 4,
      segments: headwindSegments,
      totalDistanceM: 5000,
      windFromBearingDeg: 90,
      trueWindMS: 5,
      weightKg,
      speedOrEffort: "constant-speed",
    });
    // A headwind means the actual pace was harder than the same speed in
    // calm air, so the calm-equivalent speed should be faster.
    expect(equivalentSpeedMS).not.toBeNull();
    expect(equivalentSpeedMS!).toBeGreaterThan(4);
  });

  it("saves time for a tailwind, constant-speed mode", () => {
    const equivalentSpeedMS = solveRouteCalmEquivalentSpeedMS({
      speedMS: 4,
      segments: [{ headingBearingDeg: 90, distanceM: 5000 }],
      totalDistanceM: 5000,
      windFromBearingDeg: 270, // wind from the west -> tailwind for an eastward heading
      trueWindMS: 5,
      weightKg,
      speedOrEffort: "constant-speed",
    });
    expect(equivalentSpeedMS).not.toBeNull();
    expect(equivalentSpeedMS!).toBeLessThan(4);
  });

  it("constant-effort mode reproduces the actual total time when solved back", () => {
    const speedMS = 4;
    const totalDistanceM = 5000;
    const result = solveRouteCalmEquivalentSpeedMS({
      speedMS,
      segments: headwindSegments,
      totalDistanceM,
      windFromBearingDeg: 90,
      trueWindMS: 5,
      weightKg,
      speedOrEffort: "constant-effort",
    });
    expect(result).not.toBeNull();

    // Reconstruct the target power via calm-air cost at the solved
    // equivalent speed, then check it reproduces the actual total time
    // over the same segments.
    const calmPower = metabolicCostInWindWPerKg(result!, 0, 0, weightKg);
    const reconstructedTimeS = totalTimeAtConstantEffortS(calmPower, headwindSegments, 90, 5, weightKg);
    expect(reconstructedTimeS).toBeCloseTo(totalDistanceM / speedMS, 0);
  });

  it("returns roughly the same result for a route split into many small segments vs one long one", () => {
    const oneSegment: RouteHeadingSegment[] = [{ headingBearingDeg: 90, distanceM: 1000 }];
    const tenSegments: RouteHeadingSegment[] = Array.from({ length: 10 }, () => ({
      headingBearingDeg: 90,
      distanceM: 100,
    }));

    const resultOne = solveRouteCalmEquivalentSpeedMS({
      speedMS: 4,
      segments: oneSegment,
      totalDistanceM: 1000,
      windFromBearingDeg: 90,
      trueWindMS: 5,
      weightKg,
      speedOrEffort: "constant-speed",
    });
    const resultTen = solveRouteCalmEquivalentSpeedMS({
      speedMS: 4,
      segments: tenSegments,
      totalDistanceM: 1000,
      windFromBearingDeg: 90,
      trueWindMS: 5,
      weightKg,
      speedOrEffort: "constant-speed",
    });
    expect(resultOne).toBeCloseTo(resultTen!, 6);
  });
});
