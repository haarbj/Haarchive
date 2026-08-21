import { describe, expect, it } from "vitest";

import { preciseElevationEngine } from "@/lib/environmental/precise-elevation-engine";
import { elevationEngine } from "@/lib/environmental/elevation-engine";
import { gradeAddedCostJPerKgM } from "@/lib/grade-pace-physics";
import type { PerformanceContext } from "@/lib/environmental/types";

const tenKContext: PerformanceContext = {
  distanceMeters: 10000,
  actualTimeSeconds: 2400,
  paceMS: 10000 / 2400,
};

const MILE_METERS = 1609.344;

/** Builds a perMileTerrainCostJPerKg array as if every mile ran at one constant grade -- the same shape course-analysis.ts produces for a smooth, unidirectional mile. */
function costForConstantGradePerMile(grades: number[]): number[] {
  return grades.map((grade) => gradeAddedCostJPerKgM(grade) * MILE_METERS);
}

describe("preciseElevationEngine.isApplicable", () => {
  it("is not applicable on a perfectly flat course", () => {
    expect(preciseElevationEngine.isApplicable({ perMileGrade: [0, 0, 0], perMileTerrainCostJPerKg: [0, 0, 0] })).toBe(false);
  });

  it("is not applicable with no mile data at all", () => {
    expect(preciseElevationEngine.isApplicable({ perMileGrade: [], perMileTerrainCostJPerKg: [] })).toBe(false);
  });

  it("is applicable with any nonzero terrain cost", () => {
    const perMileTerrainCostJPerKg = costForConstantGradePerMile([0, 0.03, 0]);
    expect(preciseElevationEngine.isApplicable({ perMileGrade: [0, 0.03, 0], perMileTerrainCostJPerKg })).toBe(true);
  });

  it("is applicable for a rolling mile whose net grade is zero but whose real terrain cost isn't", () => {
    // A mile that climbs and descends within itself nets to grade 0, but
    // buildPerMileTerrainCostJPerKg (course-analysis.ts) still sums real,
    // nonzero cost from its local up/down segments -- this is exactly the
    // shape a real rolling route produces and isApplicable must not treat
    // it as flat just because perMileGrade reads as 0.
    expect(
      preciseElevationEngine.isApplicable({ perMileGrade: [0], perMileTerrainCostJPerKg: [500] }),
    ).toBe(true);
  });
});

describe("preciseElevationEngine.compute", () => {
  it("costs time for a course that's entirely net-uphill", () => {
    const perMileTerrainCostJPerKg = costForConstantGradePerMile([0.03, 0.03, 0.03]);
    const result = preciseElevationEngine.compute({ perMileGrade: [0.03, 0.03, 0.03], perMileTerrainCostJPerKg }, tenKContext);
    expect(result.adjustmentSeconds).toBeGreaterThan(0);
  });

  it("saves time for a course that's entirely net-downhill", () => {
    const perMileTerrainCostJPerKg = costForConstantGradePerMile([-0.03, -0.03, -0.03]);
    const result = preciseElevationEngine.compute({ perMileGrade: [-0.03, -0.03, -0.03], perMileTerrainCostJPerKg }, tenKContext);
    expect(result.adjustmentSeconds).toBeLessThan(0);
  });

  it("nets out to a smaller benefit than the cost of the same-magnitude climb, for an out-and-back profile", () => {
    const climbOnly = preciseElevationEngine.compute(
      { perMileGrade: [0.06, 0.06], perMileTerrainCostJPerKg: costForConstantGradePerMile([0.06, 0.06]) },
      tenKContext,
    );
    const outAndBack = preciseElevationEngine.compute(
      { perMileGrade: [0.06, -0.06], perMileTerrainCostJPerKg: costForConstantGradePerMile([0.06, -0.06]) },
      tenKContext,
    );
    // Same Minetti asymmetry as the coarse engine: descending doesn't recover the full climb cost.
    expect(outAndBack.adjustmentSeconds).toBeGreaterThan(0);
    expect(outAndBack.adjustmentSeconds).toBeLessThan(climbOnly.adjustmentSeconds);
  });

  it("has a tighter confidence band than the coarse, assumed-grade engine for a comparable course", () => {
    const precise = preciseElevationEngine.compute(
      { perMileGrade: [0.06, -0.06], perMileTerrainCostJPerKg: costForConstantGradePerMile([0.06, -0.06]) },
      tenKContext,
    );
    const coarse = elevationEngine.compute({ elevationGainM: 100, elevationLossM: 100 }, tenKContext);
    const preciseBandWidth = precise.confidenceHighSeconds - precise.confidenceLowSeconds;
    const coarseBandWidth = coarse.confidenceHighSeconds - coarse.confidenceLowSeconds;
    expect(preciseBandWidth).toBeLessThan(coarseBandWidth);
  });

  it("distinguishes a short steep pitch from a long gentle rise of the same net grade differently than a flat total would", () => {
    // Two "courses" with the same overall average grade but different real
    // per-mile shapes -- Minetti's curve is convex, so concentrating the
    // same net climb into fewer, steeper miles costs more than spreading
    // it evenly. This is exactly the distinction the coarse engine (total
    // gain/loss only) cannot make.
    const evenlySpread = preciseElevationEngine.compute(
      { perMileGrade: [0.02, 0.02, 0.02, 0.02], perMileTerrainCostJPerKg: costForConstantGradePerMile([0.02, 0.02, 0.02, 0.02]) },
      tenKContext,
    );
    const concentrated = preciseElevationEngine.compute(
      { perMileGrade: [0.08, 0, 0, 0], perMileTerrainCostJPerKg: costForConstantGradePerMile([0.08, 0, 0, 0]) },
      tenKContext,
    );
    expect(concentrated.adjustmentSeconds).toBeGreaterThan(evenlySpread.adjustmentSeconds);
  });

  it("REGRESSION: a mile that climbs then descends back to net-zero still costs real time, unlike a per-mile-net-grade-only model would predict", () => {
    // A mile that climbs a steep 40m over 200m then descends the same 40m
    // over the next 200m nets to grade 0 (net start-to-finish) -- a
    // net-grade-only model reads this as a flat, free mile. The real cost
    // (each 200m leg costed at its own real 20% grade via Minetti's
    // polynomial, matching course-analysis.ts's buildPerMileTerrainCostJPerKg)
    // is strictly positive.
    const legM = 200;
    const climbGrade = 40 / legM;
    const descentGrade = -40 / legM;
    const realCost = gradeAddedCostJPerKgM(climbGrade) * legM + gradeAddedCostJPerKgM(descentGrade) * legM;
    expect(realCost).toBeGreaterThan(0);

    const rolling = preciseElevationEngine.compute({ perMileGrade: [0], perMileTerrainCostJPerKg: [realCost] }, tenKContext);
    const netOnly = preciseElevationEngine.compute({ perMileGrade: [0], perMileTerrainCostJPerKg: [0] }, tenKContext);

    expect(rolling.adjustmentSeconds).toBeGreaterThan(0);
    expect(netOnly.adjustmentSeconds).toBe(0);
  });
});
