import { describe, expect, it } from "vitest";

import { resolveVolumePercent, formatResolvedVolumeText, type WeekTarget } from "@/lib/private-coaching/volume-reference";

function week(overrides: Partial<WeekTarget> = {}): WeekTarget {
  return { targetVolumeMin: null, targetVolumeMax: null, targetVolumeUnit: null, ...overrides };
}

describe("resolveVolumePercent", () => {
  it("returns null when there's no week at all", () => {
    expect(resolveVolumePercent(20, null)).toBeNull();
  });

  it("returns null when the week has no target set", () => {
    expect(resolveVolumePercent(20, week())).toBeNull();
  });

  it("resolves a percent of a range target to a range", () => {
    const result = resolveVolumePercent(20, week({ targetVolumeMin: 35, targetVolumeMax: 40, targetVolumeUnit: "miles" }));
    expect(result).toEqual({ unit: "miles", minValue: 7, maxValue: 8, sourceLabel: "20% of 35-40mi target" });
  });

  it("resolves a percent of a point (min-only) target to a point value", () => {
    const result = resolveVolumePercent(50, week({ targetVolumeMin: 40, targetVolumeMax: null, targetVolumeUnit: "miles" }));
    expect(result).toEqual({ unit: "miles", minValue: 20, maxValue: null, sourceLabel: "50% of 40mi target" });
  });

  it("defaults the unit to miles when the week's target_volume_unit is unset", () => {
    const result = resolveVolumePercent(20, week({ targetVolumeMin: 35, targetVolumeMax: 40, targetVolumeUnit: null }));
    expect(result?.unit).toBe("miles");
  });

  it("resolves against a minutes-based target", () => {
    const result = resolveVolumePercent(25, week({ targetVolumeMin: 300, targetVolumeMax: 360, targetVolumeUnit: "minutes" }));
    expect(result).toEqual({ unit: "minutes", minValue: 75, maxValue: 90, sourceLabel: "25% of 300-360min target" });
  });

  it("rounds to whole numbers", () => {
    const result = resolveVolumePercent(33, week({ targetVolumeMin: 35, targetVolumeMax: 40, targetVolumeUnit: "miles" }));
    expect(result).toEqual({ unit: "miles", minValue: 12, maxValue: 13, sourceLabel: "33% of 35-40mi target" });
  });
});

describe("formatResolvedVolumeText", () => {
  it("shows the bare percent when resolution is omitted (a template's own athlete/week-agnostic list)", () => {
    expect(formatResolvedVolumeText(undefined, 20)).toBe("20% of week");
  });

  it("shows the no-target-set state when resolution was attempted and explicitly came back null", () => {
    expect(formatResolvedVolumeText(null, 20)).toBe("20% of week — no target set yet");
  });

  it("shows the resolved range + percent when resolved", () => {
    const resolved = { unit: "miles" as const, minValue: 7, maxValue: 8, sourceLabel: "20% of 35-40mi target" };
    expect(formatResolvedVolumeText(resolved, 20)).toBe("7-8mi (20% of week)");
  });

  it("shows a single figure when the resolved value has no max", () => {
    const resolved = { unit: "miles" as const, minValue: 20, maxValue: null, sourceLabel: "50% of 40mi target" };
    expect(formatResolvedVolumeText(resolved, 50)).toBe("20mi (50% of week)");
  });

  it("formats a minutes-unit resolution", () => {
    const resolved = { unit: "minutes" as const, minValue: 75, maxValue: 90, sourceLabel: "25% of 300-360min target" };
    expect(formatResolvedVolumeText(resolved, 25)).toBe("75-90min (25% of week)");
  });
});
