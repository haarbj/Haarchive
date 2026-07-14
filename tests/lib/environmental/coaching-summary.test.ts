import { describe, expect, it } from "vitest";

import { buildCoachingSummary, buildCoachNotes, rankByImpact } from "@/lib/environmental/coaching-summary";
import type { EngineResult } from "@/lib/environmental/types";

function result(factor: string, adjustmentSeconds: number): EngineResult {
  return {
    factor,
    adjustmentSeconds,
    confidenceLowSeconds: adjustmentSeconds - 1,
    confidenceHighSeconds: adjustmentSeconds + 1,
    summary: `${factor} summary`,
  };
}

describe("rankByImpact", () => {
  it("sorts by absolute magnitude, largest first, regardless of sign", () => {
    const ranked = rankByImpact([result("Heat", 2), result("Elevation", -14), result("Wind", 5), result("Humidity", 0)]);
    expect(ranked.map((r) => r.factor)).toEqual(["Elevation", "Wind", "Heat", "Humidity"]);
  });
});

describe("buildCoachingSummary", () => {
  it("says conditions were close to ideal when every effect is tiny", () => {
    const summary = buildCoachingSummary([result("Heat", 1), result("Humidity", 0), result("Wind", -1), result("Elevation", 0)]);
    expect(summary).toMatch(/close to ideal/i);
  });

  it("names the dominant factor when one factor accounts for most of the effect", () => {
    const summary = buildCoachingSummary([result("Heat", 1), result("Humidity", 0), result("Wind", 1), result("Elevation", 14)]);
    expect(summary).toMatch(/elevation/i);
    expect(summary).toMatch(/slowdown/i);
  });

  it("frames a dominant negative-adjustment factor as a boost, not a slowdown", () => {
    const summary = buildCoachingSummary([result("Wind", -20), result("Heat", 1)]);
    expect(summary).toMatch(/boost/i);
    expect(summary).toMatch(/wind/i);
  });

  it("mentions two factors when no single one dominates", () => {
    const summary = buildCoachingSummary([result("Heat", 8), result("Wind", 7)]);
    expect(summary).toMatch(/heat/i);
    expect(summary).toMatch(/wind/i);
  });

  it("returns a fallback message for an empty result set", () => {
    expect(buildCoachingSummary([])).toMatch(/not enough information/i);
  });
});

describe("buildCoachNotes", () => {
  it("says the performance is a fair read on fitness when conditions were close to ideal", () => {
    const notes = buildCoachNotes([result("Heat", 1), result("Wind", 0)]);
    expect(notes).toMatch(/fair.*read on your current fitness/i);
  });

  it("frames a dominant weather factor as understating fitness when it cost time", () => {
    const notes = buildCoachNotes([result("Heat", 30), result("Wind", 1)]);
    expect(notes).toMatch(/heat/i);
    expect(notes).toMatch(/understate/i);
  });

  it("frames a dominant terrain factor distinctly from weather factors", () => {
    const notes = buildCoachNotes([result("Elevation", 30), result("Heat", 1)]);
    expect(notes).toMatch(/terrain/i);
  });

  it("frames a favorable dominant factor as flattering rather than understating", () => {
    const notes = buildCoachNotes([result("Wind", -30), result("Heat", 1)]);
    expect(notes).toMatch(/flattering/i);
  });

  it("returns an empty string for an empty result set", () => {
    expect(buildCoachNotes([])).toBe("");
  });
});
