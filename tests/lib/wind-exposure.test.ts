import { describe, expect, it } from "vitest";

import {
  EXPOSURE_LABEL_SCORE,
  exposureLabelFor,
  windProfileAlphaFromExposure,
} from "@/lib/wind-exposure";

describe("exposureLabelFor", () => {
  it("maps low scores to dense-urban and high scores to fully-exposed", () => {
    expect(exposureLabelFor(0)).toBe("dense-urban");
    expect(exposureLabelFor(100)).toBe("fully-exposed");
  });

  it("maps each label's representative score back to that same label", () => {
    for (const [label, score] of Object.entries(EXPOSURE_LABEL_SCORE)) {
      expect(exposureLabelFor(score)).toBe(label);
    }
  });

  it("clamps out-of-range scores instead of throwing", () => {
    expect(exposureLabelFor(-10)).toBe("dense-urban");
    expect(exposureLabelFor(150)).toBe("fully-exposed");
  });
});

describe("windProfileAlphaFromExposure", () => {
  it("decreases monotonically as exposure increases (more open -> less sheltering)", () => {
    const alphaAtLow = windProfileAlphaFromExposure(0);
    const alphaAtMid = windProfileAlphaFromExposure(50);
    const alphaAtHigh = windProfileAlphaFromExposure(100);
    expect(alphaAtLow).toBeGreaterThan(alphaAtMid);
    expect(alphaAtMid).toBeGreaterThan(alphaAtHigh);
  });

  it("clamps out-of-range scores instead of extrapolating", () => {
    expect(windProfileAlphaFromExposure(-20)).toBe(windProfileAlphaFromExposure(0));
    expect(windProfileAlphaFromExposure(200)).toBe(windProfileAlphaFromExposure(100));
  });
});
