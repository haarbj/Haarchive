import { describe, expect, it } from "vitest";

import { buildConfidenceReasons, overallConfidenceLevel } from "@/lib/environmental/confidence-explanation";

describe("buildConfidenceReasons", () => {
  it("credits an imported GPS route and measured elevation", () => {
    const reasons = buildConfidenceReasons({
      courseType: "route",
      hasGpsRoute: true,
      weatherSource: "auto",
      terrainSource: "auto-detected",
    });
    expect(reasons.some((r) => r.label.includes("GPS route imported") && r.strengthensConfidence)).toBe(true);
    expect(reasons.some((r) => r.label.includes("measured") && r.strengthensConfidence)).toBe(true);
  });

  it("flags manual course entry as not strengthening confidence", () => {
    const reasons = buildConfidenceReasons({
      courseType: "road",
      hasGpsRoute: false,
      weatherSource: "manual",
      terrainSource: "manual",
    });
    expect(reasons.find((r) => r.label.includes("manually"))?.strengthensConfidence).toBe(false);
  });

  it("treats even an auto-detected terrain estimate as not strengthening confidence", () => {
    const reasons = buildConfidenceReasons({
      courseType: "route",
      hasGpsRoute: true,
      weatherSource: "auto",
      terrainSource: "auto-detected",
    });
    const terrainReason = reasons.find((r) => r.label.toLowerCase().includes("terrain"));
    expect(terrainReason?.strengthensConfidence).toBe(false);
  });

  it("credits retrieved historical weather over manual entry", () => {
    const auto = buildConfidenceReasons({ courseType: "road", hasGpsRoute: false, weatherSource: "auto", terrainSource: "manual" });
    const manual = buildConfidenceReasons({ courseType: "road", hasGpsRoute: false, weatherSource: "manual", terrainSource: "manual" });
    expect(auto.find((r) => /weather/i.test(r.label))?.strengthensConfidence).toBe(true);
    expect(manual.find((r) => /weather/i.test(r.label))?.strengthensConfidence).toBe(false);
  });
});

describe("overallConfidenceLevel", () => {
  it("is high when nearly everything strengthens confidence", () => {
    const level = overallConfidenceLevel([
      { label: "a", strengthensConfidence: true },
      { label: "b", strengthensConfidence: true },
      { label: "c", strengthensConfidence: true },
    ]);
    expect(level).toBe("high");
  });

  it("is low when nearly everything is estimated or manual", () => {
    const level = overallConfidenceLevel([
      { label: "a", strengthensConfidence: false },
      { label: "b", strengthensConfidence: false },
      { label: "c", strengthensConfidence: true },
    ]);
    expect(level).toBe("low");
  });

  it("defaults to medium for an empty reason list", () => {
    expect(overallConfidenceLevel([])).toBe("medium");
  });
});
