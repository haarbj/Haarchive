import { describe, expect, it } from "vitest";

import {
  decimalToGradeDegrees,
  decimalToGradePercent,
  equivalentFlatSpeedForGradeMS,
  equivalentFlatSpeedForVerticalSpeedMS,
  equivalentFlatSpeedMS,
  equivalentGradeSpeedMS,
  flatCostJPerKgM,
  flatPowerWPerKg,
  gradeAddedCostJPerKgM,
  gradeAlert,
  gradeDegreesToDecimal,
  gradePercentToDecimal,
  solveForVerticalSpeed,
  totalCostJPerKgM,
} from "@/lib/grade-pace-physics";

describe("flatCostJPerKgM", () => {
  it("matches known Black-GAM grid values", () => {
    // Spot-checked directly against the source JSON / original tool's own output.
    expect(flatCostJPerKgM(3.83)).toBeCloseTo(3.7782, 3);
    expect(flatCostJPerKgM(4.0)).toBeCloseTo(3.791, 3);
  });

  it("extrapolates gracefully beyond the table's edges rather than throwing", () => {
    expect(() => flatCostJPerKgM(-1)).not.toThrow();
    expect(() => flatCostJPerKgM(15)).not.toThrow();
  });
});

describe("flatPowerWPerKg / equivalentFlatSpeedMS", () => {
  it("round-trips: the equivalent speed for a speed's own power is itself", () => {
    const speedMS = 4.2;
    const power = flatPowerWPerKg(speedMS);
    expect(equivalentFlatSpeedMS(power)).toBeCloseTo(speedMS, 2);
  });

  it("increases with speed", () => {
    expect(flatPowerWPerKg(5)).toBeGreaterThan(flatPowerWPerKg(3));
  });
});

describe("gradeAddedCostJPerKgM", () => {
  it("is zero on flat ground", () => {
    expect(gradeAddedCostJPerKgM(0)).toBeCloseTo(0, 6);
  });

  it("is positive uphill and negative downhill at moderate grades", () => {
    expect(gradeAddedCostJPerKgM(0.08)).toBeGreaterThan(0);
    expect(gradeAddedCostJPerKgM(-0.08)).toBeLessThan(0);
  });
});

describe("totalCostJPerKgM", () => {
  it("is flat cost plus the grade's added cost", () => {
    expect(totalCostJPerKgM(3.83, 0.08)).toBeCloseTo(flatCostJPerKgM(3.83) + gradeAddedCostJPerKgM(0.08), 6);
  });
});

describe("equivalentFlatSpeedForGradeMS (pace mode)", () => {
  it("matches the original tool's output for a known uphill case", () => {
    // 3.83 m/s (7:00/mi) actually run at an 8% grade -> ~5.424 m/s flat-equivalent effort.
    expect(equivalentFlatSpeedForGradeMS(3.83, 0.08)).toBeCloseTo(5.4244, 2);
  });

  it("matches the original tool's output for a known downhill case", () => {
    // 3.83 m/s actually run at a -10% grade -> ~1.935 m/s flat-equivalent effort.
    expect(equivalentFlatSpeedForGradeMS(3.83, -0.1)).toBeCloseTo(1.9349, 2);
  });
});

describe("equivalentGradeSpeedMS (effort mode)", () => {
  it("matches the original tool's output for a known case", () => {
    // A 4.0 m/s flat-ground goal effort, targeted at a 5% grade -> ~3.069 m/s hill pace.
    expect(equivalentGradeSpeedMS(4.0, 0.05)).toBeCloseTo(3.0689, 2);
  });

  it("is the inverse of equivalentFlatSpeedForGradeMS at the same grade", () => {
    const grade = 0.06;
    const actualSpeedMS = 3.5;
    const flatEquivalent = equivalentFlatSpeedForGradeMS(actualSpeedMS, grade);
    const roundTrip = equivalentGradeSpeedMS(flatEquivalent!, grade);
    expect(roundTrip).toBeCloseTo(actualSpeedMS, 2);
  });
});

describe("equivalentFlatSpeedForVerticalSpeedMS", () => {
  it("derives the grade implied by a slope speed and vertical speed via the Pythagorean decomposition", () => {
    // A 4 m/s along-slope speed climbing at 0.4 m/s vertical implies a
    // horizontal speed of sqrt(16 - 0.16) and grade = vertical/horizontal.
    const result = equivalentFlatSpeedForVerticalSpeedMS(4, 0.4, "uphill");
    const expectedHorizontal = Math.sqrt(4 ** 2 - 0.4 ** 2);
    expect(result.grade).toBeCloseTo(0.4 / expectedHorizontal, 6);
    expect(result.flatSpeedMS).not.toBeNull();
  });

  it("gives a negative grade for downhill", () => {
    const result = equivalentFlatSpeedForVerticalSpeedMS(4, 0.4, "downhill");
    expect(result.grade).toBeLessThan(0);
  });
});

describe("solveForVerticalSpeed", () => {
  it("finds a grade/speed whose vertical component matches the target", () => {
    const targetFlatSpeedMS = 3.5;
    const verticalSpeedMS = 0.15; // ~1770 ft/hr
    const result = solveForVerticalSpeed(targetFlatSpeedMS, verticalSpeedMS, "uphill");
    expect(result).not.toBeNull();
    if (result) {
      const horizontalSpeedMS = Math.sqrt(result.speedMS ** 2 - verticalSpeedMS ** 2);
      expect(verticalSpeedMS / horizontalSpeedMS).toBeCloseTo(result.grade, 3);
      // Sanity: the resulting metabolic power should be close to the flat-ground target.
      const powerAtSolution = totalCostJPerKgM(result.speedMS, result.grade) * result.speedMS;
      const targetPower = flatPowerWPerKg(targetFlatSpeedMS);
      expect(Math.abs(powerAtSolution - targetPower) / targetPower).toBeLessThan(0.05);
    }
  });

  it("returns a positive grade for uphill and negative for downhill", () => {
    const uphill = solveForVerticalSpeed(3.5, 0.15, "uphill");
    const downhill = solveForVerticalSpeed(3.5, 0.15, "downhill");
    expect(uphill!.grade).toBeGreaterThan(0);
    expect(downhill!.grade).toBeLessThan(0);
  });
});

describe("gradeAlert", () => {
  it("flags steep downhills below -8%", () => {
    expect(gradeAlert(-0.09)).toBe("steep-downhill");
    expect(gradeAlert(-0.05)).toBeNull();
  });

  it("flags very steep uphills above 25%", () => {
    expect(gradeAlert(0.3)).toBe("steep-uphill");
    expect(gradeAlert(0.15)).toBeNull();
  });

  it("is silent for moderate grades", () => {
    expect(gradeAlert(0)).toBeNull();
    expect(gradeAlert(0.1)).toBeNull();
    expect(gradeAlert(-0.05)).toBeNull();
  });
});

describe("grade unit conversions", () => {
  it("round-trips percent and degrees", () => {
    expect(decimalToGradePercent(gradePercentToDecimal(8))).toBeCloseTo(8, 6);
    expect(decimalToGradeDegrees(gradeDegreesToDecimal(10))).toBeCloseTo(10, 6);
  });

  it("agrees that a 45 degree slope is a 100% grade", () => {
    expect(gradeDegreesToDecimal(45)).toBeCloseTo(1, 6);
  });
});
