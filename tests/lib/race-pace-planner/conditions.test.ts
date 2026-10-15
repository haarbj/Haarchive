import { describe, expect, it } from "vitest";

import { evaluateConditions } from "@/lib/race-pace-planner/conditions";

const COOL_CALM = { tempF: 50, humidityPct: 40, windMph: 3, altitudeDiffFt: 0 };

describe("evaluateConditions", () => {
  it("returns no flags for cool, calm, low-altitude conditions", () => {
    expect(evaluateConditions(COOL_CALM)).toEqual([]);
  });

  it("flags heat above 60F with a conservative-opening recommendation", () => {
    const flags = evaluateConditions({ ...COOL_CALM, tempF: 70 });
    const heatFlag = flags.find((f) => f.tone === "heat");
    expect(heatFlag).toBeDefined();
    expect(heatFlag!.note).toMatch(/conservative/i);
  });

  it("calls out humidity amplifying heat when both temp and humidity are high", () => {
    const flags = evaluateConditions({ ...COOL_CALM, tempF: 75, humidityPct: 80 });
    const heatFlag = flags.find((f) => f.tone === "heat");
    expect(heatFlag!.note).toMatch(/humidity/i);
  });

  it("does not raise a heat flag at or below the threshold", () => {
    const flags = evaluateConditions({ ...COOL_CALM, tempF: 60 });
    expect(flags.find((f) => f.tone === "heat")).toBeUndefined();
  });

  it("flags strong wind", () => {
    const flags = evaluateConditions({ ...COOL_CALM, windMph: 20 });
    expect(flags.find((f) => f.tone === "wind")).toBeDefined();
  });

  it("flags a meaningful altitude increase", () => {
    const flags = evaluateConditions({ ...COOL_CALM, altitudeDiffFt: 3000 });
    const altitudeFlag = flags.find((f) => f.tone === "altitude");
    expect(altitudeFlag).toBeDefined();
    expect(altitudeFlag!.note).toMatch(/higher/i);
  });

  it("flags a meaningful altitude decrease as an advantage", () => {
    const flags = evaluateConditions({ ...COOL_CALM, altitudeDiffFt: -3000 });
    const altitudeFlag = flags.find((f) => f.tone === "altitude");
    expect(altitudeFlag).toBeDefined();
    expect(altitudeFlag!.note).toMatch(/lower/i);
  });

  it("does not flag altitude within the tolerance", () => {
    const flags = evaluateConditions({ ...COOL_CALM, altitudeDiffFt: 500 });
    expect(flags.find((f) => f.tone === "altitude")).toBeUndefined();
  });
});
