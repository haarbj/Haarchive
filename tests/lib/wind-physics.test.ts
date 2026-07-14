import { describe, expect, it } from "vitest";

import {
  bodySurfaceAreaM2,
  classifyWindAngle,
  effortModeEquivalentSpeedMS,
  frontalAreaM2,
  metabolicCostInWindWPerKg,
  paceModeEquivalentSpeedMS,
  relativeAngleFromTrueBearing,
  solveSpeedForCost,
  treadmillCostWPerKg,
  windAtChestHeightMS,
  windForwardLateral,
} from "@/lib/wind-physics";

describe("bodySurfaceAreaM2", () => {
  it("matches known adult body surface area for a typical runner weight", () => {
    // A ~68kg adult has a BSA of roughly 1.8 m² by most clinical formulas.
    expect(bodySurfaceAreaM2(68)).toBeGreaterThan(1.6);
    expect(bodySurfaceAreaM2(68)).toBeLessThan(2.0);
  });

  it("increases with weight", () => {
    expect(bodySurfaceAreaM2(90)).toBeGreaterThan(bodySurfaceAreaM2(60));
  });
});

describe("frontalAreaM2", () => {
  it("is a fixed fraction of body surface area", () => {
    const weightKg = 70;
    expect(frontalAreaM2(weightKg)).toBeCloseTo(bodySurfaceAreaM2(weightKg) * 0.266, 6);
  });
});

describe("treadmillCostWPerKg", () => {
  it("increases with speed", () => {
    expect(treadmillCostWPerKg(5)).toBeGreaterThan(treadmillCostWPerKg(3));
  });

  it("stays within a physiologically plausible range for distance-running paces", () => {
    // ~7:00/mi (3.83 m/s) through ~5:00/mi (5.36 m/s)
    for (const speed of [3.83, 4.5, 5.36]) {
      expect(treadmillCostWPerKg(speed)).toBeGreaterThan(8);
      expect(treadmillCostWPerKg(speed)).toBeLessThan(25);
    }
  });
});

describe("windAtChestHeightMS", () => {
  it("leaves wind speed unchanged for the 'none' profile", () => {
    expect(windAtChestHeightMS(5, "none")).toBeCloseTo(5, 10);
  });

  it("reduces wind speed for any sheltered profile", () => {
    expect(windAtChestHeightMS(5, "rural")).toBeLessThan(5);
    expect(windAtChestHeightMS(5, "suburban")).toBeLessThan(5);
    expect(windAtChestHeightMS(5, "urban")).toBeLessThan(5);
  });

  it("shelters more wind in denser terrain", () => {
    const rural = windAtChestHeightMS(10, "rural");
    const suburban = windAtChestHeightMS(10, "suburban");
    const urban = windAtChestHeightMS(10, "urban");
    expect(suburban).toBeLessThan(rural);
    expect(urban).toBeLessThan(suburban);
  });
});

describe("windForwardLateral", () => {
  it("resolves a direct headwind (0deg) to pure forward component", () => {
    const { forward, lateral } = windForwardLateral(5, 0);
    expect(forward).toBeCloseTo(5, 10);
    expect(lateral).toBeCloseTo(0, 10);
  });

  it("resolves a direct tailwind (180deg) to negative forward component", () => {
    const { forward, lateral } = windForwardLateral(5, 180);
    expect(forward).toBeCloseTo(-5, 10);
    expect(lateral).toBeCloseTo(0, 10);
  });

  it("resolves a pure crosswind (90deg) to pure lateral component", () => {
    const { forward, lateral } = windForwardLateral(5, 90);
    expect(forward).toBeCloseTo(0, 10);
    expect(lateral).toBeCloseTo(5, 10);
  });
});

describe("classifyWindAngle", () => {
  it("classifies angles near 0 as headwind", () => {
    expect(classifyWindAngle(0)).toBe("headwind");
    expect(classifyWindAngle(10)).toBe("headwind");
    expect(classifyWindAngle(350)).toBe("headwind");
  });

  it("classifies angles near 180 as tailwind", () => {
    expect(classifyWindAngle(180)).toBe("tailwind");
    expect(classifyWindAngle(170)).toBe("tailwind");
  });

  it("classifies the quarter-points as crosswind", () => {
    expect(classifyWindAngle(90)).toBe("crosswind");
    expect(classifyWindAngle(270)).toBe("crosswind");
    expect(classifyWindAngle(45)).toBe("crosswind");
  });
});

describe("metabolicCostInWindWPerKg", () => {
  const weightKg = 68;

  it("matches calm-air treadmill-style cost scaling when wind is zero", () => {
    // Zero true wind still means the runner generates their own relative
    // headwind equal to their speed -- cost should still climb with speed.
    const slow = metabolicCostInWindWPerKg(3, 0, 0, weightKg);
    const fast = metabolicCostInWindWPerKg(5, 0, 0, weightKg);
    expect(fast).toBeGreaterThan(slow);
  });

  it("costs more to run a fixed speed into a headwind than in calm air", () => {
    const speed = 4;
    const calm = metabolicCostInWindWPerKg(speed, 0, 0, weightKg);
    const intoHeadwind = metabolicCostInWindWPerKg(speed, 3, 0, weightKg);
    expect(intoHeadwind).toBeGreaterThan(calm);
  });

  it("costs less to run a fixed speed with a tailwind than in calm air", () => {
    const speed = 4;
    const calm = metabolicCostInWindWPerKg(speed, 0, 0, weightKg);
    const withTailwind = metabolicCostInWindWPerKg(speed, -3, 0, weightKg);
    expect(withTailwind).toBeLessThan(calm);
  });
});

describe("solveSpeedForCost", () => {
  it("recovers the input speed for a monotonic cost function", () => {
    const weightKg = 68;
    const costFn = (v: number) => metabolicCostInWindWPerKg(v, 0, 0, weightKg);
    const target = costFn(4.2);
    const solved = solveSpeedForCost(costFn, target);
    expect(solved).not.toBeNull();
    expect(solved as number).toBeCloseTo(4.2, 2);
  });

  it("returns null for a target outside the bracket's range", () => {
    const costFn = (v: number) => metabolicCostInWindWPerKg(v, 0, 0, 68);
    expect(solveSpeedForCost(costFn, -1000)).toBeNull();
  });
});

describe("paceModeEquivalentSpeedMS", () => {
  const weightKg = 68;

  it("is a no-op round trip when there is no wind", () => {
    const result = paceModeEquivalentSpeedMS(4.2, 0, 0, weightKg);
    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(4.2, 2);
  });

  it("treats a real headwind-run pace as equivalent to a faster calm-air pace", () => {
    const actualSpeed = 3.83; // ~7:00/mi
    const windForward = 2.2352; // 5 mph headwind
    const result = paceModeEquivalentSpeedMS(actualSpeed, windForward, 0, weightKg);
    expect(result).not.toBeNull();
    expect(result as number).toBeGreaterThan(actualSpeed);
  });

  it("treats a real tailwind-run pace as equivalent to a slower calm-air pace", () => {
    const actualSpeed = 3.83;
    const windForward = -2.2352; // 5 mph tailwind
    const result = paceModeEquivalentSpeedMS(actualSpeed, windForward, 0, weightKg);
    expect(result).not.toBeNull();
    expect(result as number).toBeLessThan(actualSpeed);
  });

  it("returns 0 for a stationary runner", () => {
    expect(paceModeEquivalentSpeedMS(0, 2, 0, weightKg)).toBe(0);
  });
});

describe("effortModeEquivalentSpeedMS", () => {
  const weightKg = 68;

  it("is a no-op round trip when there is no wind", () => {
    const result = effortModeEquivalentSpeedMS(4.2, 0, 0, weightKg);
    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(4.2, 2);
  });

  it("is the inverse of pace mode for the same wind", () => {
    const actualSpeed = 3.83;
    const windForward = 2.2352;
    const calmEquivalent = paceModeEquivalentSpeedMS(actualSpeed, windForward, 0, weightKg) as number;
    const backToActual = effortModeEquivalentSpeedMS(calmEquivalent, windForward, 0, weightKg) as number;
    expect(backToActual).toBeCloseTo(actualSpeed, 2);
  });

  it("recommends a slower target pace into a headwind for the same calm-air effort", () => {
    const goalCalmSpeed = 3.83;
    const windForward = 2.2352;
    const result = effortModeEquivalentSpeedMS(goalCalmSpeed, windForward, 0, weightKg);
    expect(result).not.toBeNull();
    expect(result as number).toBeLessThan(goalCalmSpeed);
  });
});

describe("relativeAngleFromTrueBearing", () => {
  it("is a headwind when heading straight into a wind from the same true direction", () => {
    // Wind from the north (0deg), runner heading north (into it) -> headwind (0deg)
    expect(relativeAngleFromTrueBearing(0, 0)).toBeCloseTo(0, 6);
  });

  it("is a tailwind when heading away from where the wind is coming from", () => {
    // Wind from the north (0deg), runner heading south (180deg, with it) -> tailwind (180deg)
    expect(relativeAngleFromTrueBearing(0, 180)).toBeCloseTo(180, 6);
  });

  it("is a crosswind when heading perpendicular to the wind", () => {
    // Wind from the north (0deg), runner heading east (90deg) -> crosswind
    expect(relativeAngleFromTrueBearing(0, 90)).toBeCloseTo(270, 6);
  });

  it("wraps negative results into 0-360", () => {
    expect(relativeAngleFromTrueBearing(10, 350)).toBeCloseTo(20, 6);
  });
});
