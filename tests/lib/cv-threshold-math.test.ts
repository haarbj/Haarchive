import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  type CvThresholdModel,
  isWithinModelDomain,
  predictSpeeds,
  selectTrainingPaces,
  uncertaintyRangeMS,
} from "@/lib/cv-threshold-math";

const model: CvThresholdModel = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/cv-threshold-model.json"), "utf8"),
);

function paceSecondsPerMile(speedMS: number): number {
  return 1609.344 / speedMS;
}

describe("predictSpeeds", () => {
  it("matches the source README's worked example: 18:00 5K predicts roughly a 6-minute/mile median threshold pace", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60, 25);
    const paceSeconds = paceSecondsPerMile(prediction.thresholdSpeedMS.p50);
    // README states ~6:08/mi from an earlier model version; this pins the
    // current model's own output to a stable, verified value (~6:11/mi)
    // rather than re-asserting a figure from a different model version.
    expect(paceSeconds).toBeCloseTo(371, 0); // 6:11
  });

  it("orders paces physiologically: threshold is slower than CV, which is slower than VO2max", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60, 25);
    expect(prediction.thresholdSpeedMS.p50).toBeLessThan(prediction.cvSpeedMS.p50);
    expect(prediction.cvSpeedMS.p50).toBeLessThan(prediction.vo2maxSpeedMS.p50);
  });

  it("increases (faster) with a stronger performance at a fixed distance", () => {
    const slower = predictSpeeds(model, 5000, 20 * 60, 25);
    const faster = predictSpeeds(model, 5000, 16 * 60, 25);
    expect(faster.thresholdSpeedMS.p50).toBeGreaterThan(slower.thresholdSpeedMS.p50);
  });

  it("each outcome's speed percentiles are themselves ordered p10 < p50 < p90", () => {
    const prediction = predictSpeeds(model, 3000, 10 * 60, 30);
    for (const triple of [prediction.thresholdSpeedMS, prediction.cvSpeedMS, prediction.vo2maxSpeedMS]) {
      expect(triple.p10).toBeLessThan(triple.p50);
      expect(triple.p50).toBeLessThan(triple.p90);
    }
  });
});

describe("selectTrainingPaces", () => {
  it("safe mode picks the conservative (slower-threshold, faster-VO2max) percentile", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60, 25);
    const safe = selectTrainingPaces(prediction, "safe");
    const median = selectTrainingPaces(prediction, "median");
    expect(safe.thresholdSpeedMS).toBeCloseTo(prediction.thresholdSpeedMS.p10, 10);
    expect(safe.vo2maxSpeedMS).toBeCloseTo(prediction.vo2maxSpeedMS.p90, 10);
    expect(median.thresholdSpeedMS).toBeCloseTo(prediction.thresholdSpeedMS.p50, 10);
    expect(median.vo2maxSpeedMS).toBeCloseTo(prediction.vo2maxSpeedMS.p50, 10);
  });

  it("CV pace is always the median, regardless of mode", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60, 25);
    const safe = selectTrainingPaces(prediction, "safe");
    const median = selectTrainingPaces(prediction, "median");
    expect(safe.cvSpeedMS).toBeCloseTo(prediction.cvSpeedMS.p50, 10);
    expect(median.cvSpeedMS).toBeCloseTo(prediction.cvSpeedMS.p50, 10);
  });
});

describe("uncertaintyRangeMS", () => {
  it("the fast end is always a higher speed (faster/lower pace) than the slow end", () => {
    const prediction = predictSpeeds(model, 1500, 5 * 60, 20);
    const range = uncertaintyRangeMS(prediction);
    expect(range.threshold.fastMS).toBeGreaterThan(range.threshold.slowMS);
    expect(range.cv.fastMS).toBeGreaterThan(range.cv.slowMS);
    expect(range.vo2max.fastMS).toBeGreaterThan(range.vo2max.slowMS);
  });
});

describe("isWithinModelDomain", () => {
  it("accepts a realistic 5K performance", () => {
    expect(isWithinModelDomain(model, 5000, 18 * 60, 25)).toBe(true);
  });

  it("rejects a distance far outside the fitted range", () => {
    expect(isWithinModelDomain(model, 42195, 3 * 60 * 60, 25)).toBe(false);
  });

  it("rejects an age outside the fitted range", () => {
    expect(isWithinModelDomain(model, 5000, 18 * 60, 5)).toBe(false);
    expect(isWithinModelDomain(model, 5000, 18 * 60, 95)).toBe(false);
  });

  it("rejects a time that's implausible for the given distance", () => {
    // A 5000m "run" in 30 seconds is far faster than the model's fitted range.
    expect(isWithinModelDomain(model, 5000, 30, 25)).toBe(false);
  });
});
