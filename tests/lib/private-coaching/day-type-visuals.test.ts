import { describe, expect, it } from "vitest";

import { getDayTypeAccent, splitDayLabel, abbreviateDayLabel, isXtLabel, isBareXt } from "@/lib/private-coaching/day-type-visuals";

describe("getDayTypeAccent", () => {
  it("matches a suggested label case- and whitespace-insensitively", () => {
    expect(getDayTypeAccent("Threshold")).toBe("warning");
    expect(getDayTypeAccent("  threshold  ")).toBe("warning");
    expect(getDayTypeAccent("THRESHOLD")).toBe("warning");
  });

  it("groups related day types under the same accent", () => {
    expect(getDayTypeAccent("Easy")).toBe(getDayTypeAccent("Shakeout"));
    expect(getDayTypeAccent("Long Run")).toBe(getDayTypeAccent("MLR"));
  });

  it("falls back to neutral for a free-typed label not in the suggested list", () => {
    expect(getDayTypeAccent("Bike commute")).toBe("neutral");
  });

  it("falls back to neutral for null", () => {
    expect(getDayTypeAccent(null)).toBe("neutral");
  });

  it("never returns an error/red accent -- reserved for actual problems elsewhere", () => {
    for (const label of ["Easy", "Threshold", "Long Run", "XT", "Fartlek", "Strength", "Bike commute"]) {
      expect(getDayTypeAccent(label)).not.toBe("error");
    }
  });

  it("matches the base label even when a modality is composed onto it (e.g. 'XT (Bike)')", () => {
    expect(getDayTypeAccent("XT (Bike)")).toBe(getDayTypeAccent("XT"));
  });
});

describe("splitDayLabel", () => {
  it("splits a base label with a composed parenthetical detail", () => {
    expect(splitDayLabel("XT (Bike)")).toEqual({ base: "XT", detail: "Bike" });
  });

  it("returns an empty detail for a plain label with no parenthetical", () => {
    expect(splitDayLabel("XT")).toEqual({ base: "XT", detail: "" });
  });

  it("trims whitespace around both parts", () => {
    expect(splitDayLabel("XT  ( Bike )")).toEqual({ base: "XT", detail: "Bike" });
  });
});

describe("abbreviateDayLabel", () => {
  it("abbreviates the full suggested names for the calendar's compact views", () => {
    expect(abbreviateDayLabel("Long Run")).toBe("LR");
    expect(abbreviateDayLabel("Medium Long Run")).toBe("MLR");
    expect(abbreviateDayLabel("Cross Training")).toBe("XT");
  });

  it("is case-insensitive", () => {
    expect(abbreviateDayLabel("medium long run")).toBe("MLR");
  });

  it("preserves a composed parenthetical detail", () => {
    expect(abbreviateDayLabel("Cross Training (Bike)")).toBe("XT (Bike)");
  });

  it("passes through an already-abbreviated or unrecognized label unchanged", () => {
    expect(abbreviateDayLabel("MLR")).toBe("MLR");
    expect(abbreviateDayLabel("XT")).toBe("XT");
    expect(abbreviateDayLabel("Threshold")).toBe("Threshold");
  });
});

describe("isXtLabel / isBareXt", () => {
  it("recognizes both the full name and the bare abbreviation as XT", () => {
    expect(isXtLabel("Cross Training")).toBe(true);
    expect(isXtLabel("XT")).toBe(true);
    expect(isXtLabel("cross training")).toBe(true);
    expect(isXtLabel("Threshold")).toBe(false);
  });

  it("isBareXt is true only when XT has no modality attached yet", () => {
    expect(isBareXt("Cross Training")).toBe(true);
    expect(isBareXt("XT")).toBe(true);
    expect(isBareXt("Cross Training (Bike)")).toBe(false);
    expect(isBareXt("Threshold")).toBe(false);
    expect(isBareXt(null)).toBe(false);
  });
});
