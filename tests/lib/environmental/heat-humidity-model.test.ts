import { describe, expect, it } from "vitest";

import { logspeedAdjustment } from "@/lib/environmental/heat-humidity-model";

describe("logspeedAdjustment", () => {
  it("matches known exact grid points", () => {
    // Spot-checked directly against the source JSON.
    expect(logspeedAdjustment(10, 30)).toBeCloseTo(0, 6);
    expect(logspeedAdjustment(30, 80)).toBeCloseTo(-0.0629, 6);
    expect(logspeedAdjustment(45, 100)).toBeCloseTo(-0.2116, 6);
  });

  it("interpolates between grid points", () => {
    // 30.5°C at 30% RH should fall between the 30°C and 31°C values.
    const at30 = logspeedAdjustment(30, 30);
    const at31 = logspeedAdjustment(31, 30);
    const between = logspeedAdjustment(30.5, 30);
    expect(between).toBeGreaterThan(Math.min(at30, at31));
    expect(between).toBeLessThan(Math.max(at30, at31));
  });

  it("gets worse (more negative) as temperature rises past the optimum", () => {
    expect(logspeedAdjustment(30, 50)).toBeLessThan(logspeedAdjustment(15, 50));
  });

  it("gets worse (more negative) as humidity rises at a fixed hot temperature", () => {
    expect(logspeedAdjustment(30, 90)).toBeLessThan(logspeedAdjustment(30, 10));
  });

  it("linearly extrapolates beyond the grid's edges rather than throwing", () => {
    expect(() => logspeedAdjustment(-10, 50)).not.toThrow();
    expect(() => logspeedAdjustment(60, 50)).not.toThrow();
    expect(() => logspeedAdjustment(30, -10)).not.toThrow();
    expect(() => logspeedAdjustment(30, 150)).not.toThrow();
    // Extrapolating further into worse conditions should keep getting worse.
    expect(logspeedAdjustment(60, 100)).toBeLessThan(logspeedAdjustment(45, 100));
  });
});
