import { describe, expect, it } from "vitest";

import { buildDisplaySplits } from "@/lib/marathon-pacing/pace-rounding";
import type { MileSplit } from "@/lib/marathon-pacing/split-generator";

function fakeSplit(mile: number, paceSecPerMile: number): MileSplit {
  return {
    mile,
    paceSecPerMile,
    elapsedSeconds: 0, // unused by buildDisplaySplits
    grade: 0,
    targetEffortFraction: 0.8,
    fatigueState: {
      elapsedSeconds: 0,
      distanceM: 0,
      wPrimeBalanceM: 0,
      wPrimeBalanceFraction: 1,
      glycogenRemainingGrams: 0,
      glycogenRemainingFraction: 1,
      cardiacDriftFraction: 0,
      cumulativeEccentricDamageScore: 0,
    },
    costBreakdown: { mile, grade: 0, headingDeg: null, terrainSeconds: 0, heatSeconds: 0, humiditySeconds: 0, windSeconds: 0, totalSeconds: 0 },
    explanation: "",
  };
}

describe("buildDisplaySplits", () => {
  it("rounds cumulative elapsed time at each mile marker, not each mile's pace independently", () => {
    // 6:23/mi (383s) exactly -- the reported case: independently rounding
    // every mile to the nearest 5s would round EVERY mile up to 6:25
    // (since 383 is closer to 385 than 380), compounding into a real drift.
    const splits = [fakeSplit(1, 383), fakeSplit(2, 383), fakeSplit(3, 383)];
    const display = buildDisplaySplits(splits);

    // Cumulative: 383, 766, 1149 -> rounded to nearest 5: 385, 765, 1150.
    expect(display.map((d) => d.displayElapsedSeconds)).toEqual([385, 765, 1150]);
    // Paces are the differences between consecutive rounded cumulative
    // times -- self-correcting (6:25 then 6:20 then 6:25), not three 6:25s in a row.
    expect(display.map((d) => d.displayPaceSecPerMile)).toEqual([385, 380, 385]);
  });

  it("keeps the displayed total within half the rounding granularity of the true total, over a full marathon -- not compounding", () => {
    const paceSecPerMile = 383; // 6:23/mi
    const mileCount = 26;
    const splits = Array.from({ length: mileCount }, (_, i) => fakeSplit(i + 1, paceSecPerMile));
    const display = buildDisplaySplits(splits);

    const trueTotal = paceSecPerMile * mileCount;
    const displayedTotal = display[display.length - 1].displayElapsedSeconds;
    // Independent per-mile rounding would drift by up to mileCount * 2.5s
    // (~65s here); cumulative rounding never drifts more than 2.5s total.
    expect(Math.abs(displayedTotal - trueTotal)).toBeLessThanOrEqual(2.5);
  });

  it("every displayed cumulative elapsed time is a multiple of the rounding granularity", () => {
    const splits = [fakeSplit(1, 382), fakeSplit(2, 376.3), fakeSplit(3, 371.8), fakeSplit(4, 390.1)];
    const display = buildDisplaySplits(splits);
    for (const d of display) {
      expect(d.displayElapsedSeconds % 5).toBe(0);
    }
  });

  it("each mile's displayed pace is exactly the difference between consecutive displayed elapsed times -- internally consistent", () => {
    const splits = [fakeSplit(1, 382), fakeSplit(2, 376), fakeSplit(3, 371), fakeSplit(4, 405)];
    const display = buildDisplaySplits(splits);
    let runningTotal = 0;
    for (const d of display) {
      runningTotal += d.displayPaceSecPerMile;
      expect(runningTotal).toBe(d.displayElapsedSeconds);
    }
  });

  it("supports a custom rounding granularity", () => {
    const display = buildDisplaySplits([fakeSplit(1, 383)], 10);
    expect(display[0].displayPaceSecPerMile).toBe(380);
    expect(display[0].displayElapsedSeconds).toBe(380);
  });

  it("returns an empty array for an empty input", () => {
    expect(buildDisplaySplits([])).toEqual([]);
  });
});
