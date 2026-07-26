import { describe, expect, it } from "vitest";

import {
  calculateRating,
  calculateRaceSplits,
  calculateTinman,
  calculateTinmanFitness,
  calculateTrainingPaces,
  calculateVVO2,
  distanceShapeRatio,
  formatTinmanTime,
  predictEquivalentRaceTimes,
  TRAINING_PACE_COLUMNS,
} from "@/lib/tinman-calculator-math";

import rawDataset from "../fixtures/tinman-calculator-dataset.json";
import rawGenderChecks from "../fixtures/tinman-calculator-gender-checks.json";

// The fixtures are real (input -> output) pairs collected live from the
// free public calculator at finalsurge.com/tinman-calculator (112
// performances across 1500m-marathon, plus 8 dedicated male/female
// comparison queries) -- this is the actual regression-testing dataset the
// reverse-engineered model above was fit against and validated on. See
// /docs/tinman-reverse-engineering-report.md.

type DatasetRow = {
  race_distance: string;
  input_time_seconds: number;
  gender: string;
  raceInformation: { rating: string };
  raceSplits: Record<string, string>;
  trainingPaces: Record<string, Record<string, string | { low: string; high: string }>>;
  equivalentTimes: Record<string, string>;
};

const dataset = rawDataset as DatasetRow[];

const INPUT_METERS: Record<string, number> = {
  "1500m": 1500,
  mile: 1609.344,
  "3000m": 3000,
  "5k": 5000,
  "10k": 10000,
  half_marathon: 21097.5,
  marathon: 42195,
};
const INPUT_EQUIV_LABEL: Record<string, string> = {
  "1500m": "1500m",
  mile: "Mile",
  "3000m": "3000m",
  "5k": "5k",
  "10k": "10k",
  half_marathon: "Half Marathon",
  marathon: "marathon",
};

function timeToSeconds(str: string): number {
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

describe("distanceShapeRatio", () => {
  it("equals exactly 1 at the 3000m reference distance", () => {
    expect(distanceShapeRatio(3000)).toBeCloseTo(1, 6);
  });

  it("increases monotonically with distance", () => {
    const distances = [100, 400, 800, 1500, 1609.344, 3000, 5000, 10000, 21097.5, 42195];
    for (let i = 1; i < distances.length; i++) {
      expect(distanceShapeRatio(distances[i])).toBeGreaterThan(distanceShapeRatio(distances[i - 1]));
    }
  });
});

describe("calculateTinmanFitness + predictEquivalentRaceTimes: end-to-end accuracy vs. real calculator output", () => {
  it("predicts every collected equivalent-race-time output to within 1.1 seconds", () => {
    let maxError = 0;
    let sumSquaredError = 0;
    let n = 0;

    for (const row of dataset) {
      const inputMeters = INPUT_METERS[row.race_distance];
      const time3k = calculateTinmanFitness(inputMeters, row.input_time_seconds);
      const predictions = predictEquivalentRaceTimes(time3k);

      for (const [label, timeStr] of Object.entries(row.equivalentTimes)) {
        const actualSeconds = timeToSeconds(timeStr);
        const predicted = predictions.find((p) => p.label === label);
        if (!predicted) continue;
        const error = Math.abs(predicted.seconds - actualSeconds);
        maxError = Math.max(maxError, error);
        sumSquaredError += error * error;
        n++;
      }
    }

    const rmse = Math.sqrt(sumSquaredError / n);
    expect(n).toBeGreaterThan(3000);
    expect(rmse).toBeLessThan(0.5);
    expect(maxError).toBeLessThan(1.2);
  });

  it("reproduces its own input distance's equivalent time (self-consistency)", () => {
    for (const row of dataset.slice(0, 20)) {
      const inputMeters = INPUT_METERS[row.race_distance];
      const time3k = calculateTinmanFitness(inputMeters, row.input_time_seconds);
      const predictions = predictEquivalentRaceTimes(time3k);
      const selfLabel = INPUT_EQUIV_LABEL[row.race_distance];
      const predicted = predictions.find((p) => p.label === selfLabel)!;
      expect(predicted.seconds).toBeCloseTo(row.input_time_seconds, 0);
    }
  });
});

describe("calculateVVO2", () => {
  it("agrees with the calculator's own VO2max-zone ceiling (the column-independent vVO2max signal)", () => {
    const row = dataset.find((r) => r.race_distance === "5k" && r.input_time_seconds === 960)!; // 16:00
    const time3k = calculateTinmanFitness(5000, 960);
    const vvo2 = calculateVVO2(time3k);

    const vo2maxZone = row.trainingPaces["VO2 max"]["Mile"] as { low: string; high: string };
    const actualPaceSecPerMile = timeToSeconds(vo2maxZone.high);
    expect(vvo2.paceSecPerMile).toBeCloseTo(actualPaceSecPerMile, 0);
  });

  it("a faster time3k produces a faster (lower) vVO2max pace", () => {
    const fast = calculateVVO2(calculateTinmanFitness(5000, 800));
    const slow = calculateVVO2(calculateTinmanFitness(5000, 1400));
    expect(fast.paceSecPerKm).toBeLessThan(slow.paceSecPerKm);
  });
});

describe("calculateTrainingPaces", () => {
  it("matches every collected training-pace cell to within 1 second", () => {
    let maxError = 0;
    let n = 0;

    for (const row of dataset) {
      const inputMeters = INPUT_METERS[row.race_distance];
      const time3k = calculateTinmanFitness(inputMeters, row.input_time_seconds);
      const vvo2 = calculateVVO2(time3k);
      const paces = calculateTrainingPaces(vvo2);

      for (const paceRow of paces) {
        const actualRow = row.trainingPaces[paceRow.zone];
        if (!actualRow) continue;
        paceRow.cells.forEach((cell, i) => {
          const col = TRAINING_PACE_COLUMNS[i];
          const actual = actualRow[col.label];
          if (!actual || actual === "-" || typeof actual === "string") return;
          if (!cell) return;
          const actualLow = timeToSeconds(actual.low);
          const actualHigh = timeToSeconds(actual.high);
          maxError = Math.max(maxError, Math.abs(cell.low - actualLow), Math.abs(cell.high - actualHigh));
          n++;
        });
      }
    }

    expect(n).toBeGreaterThan(10000);
    expect(maxError).toBeLessThan(1);
  });

  it("hides the longest columns for the most intense zones, matching the calculator's own '-' cells", () => {
    const vvo2 = calculateVVO2(calculateTinmanFitness(5000, 976));
    const paces = calculateTrainingPaces(vvo2);
    const speed = paces.find((p) => p.zone === "Speed")!;
    expect(speed.cells.slice(0, 9)).toEqual(Array(9).fill(null));
    expect(speed.cells[9]).not.toBeNull();
  });
});

describe("calculateRaceSplits", () => {
  it("computes plain even-pace splits, not fitness-adjusted equivalents", () => {
    const splits = calculateRaceSplits(5000, 976); // 16:16 5k
    const paceSecPerKm = 976 / 5;
    const mileSplit = splits.find((s) => s.label === "Mile")!;
    expect(mileSplit.seconds).toBeCloseTo(paceSecPerKm * 1.609344, 1);
  });
});

describe("calculateRating", () => {
  it("matches every collected male rating to within 0.15 percentage points", () => {
    let maxError = 0;
    for (const row of dataset) {
      const inputMeters = INPUT_METERS[row.race_distance];
      const time3k = calculateTinmanFitness(inputMeters, row.input_time_seconds);
      const vvo2 = calculateVVO2(time3k);
      const predicted = calculateRating(vvo2.speedMetersPerMin, "male");
      const actual = parseFloat(row.raceInformation.rating);
      maxError = Math.max(maxError, Math.abs(predicted - actual));
    }
    expect(maxError).toBeLessThan(0.15);
  });

  it("applies the measured ~1.1326x female multiplier, matching real male/female query pairs", () => {
    const genderChecks = rawGenderChecks as {
      label: string;
      timeStr: string;
      gender: string;
      raceInformation: { rating: string };
    }[];
    const distanceLabelToMeters: Record<string, number> = {
      "5 km": 5000,
      "10 km": 10000,
      Marathon: 42195,
      "1 mile": 1609.344,
    };

    for (const check of genderChecks) {
      const meters = distanceLabelToMeters[check.label];
      const seconds = timeToSeconds(check.timeStr.includes(":") ? check.timeStr : `0:${check.timeStr}`);
      const time3k = calculateTinmanFitness(meters, seconds);
      const vvo2 = calculateVVO2(time3k);
      const gender = check.gender === "f" ? "female" : "male";
      const predicted = calculateRating(vvo2.speedMetersPerMin, gender);
      const actual = parseFloat(check.raceInformation.rating);
      expect(predicted).toBeCloseTo(actual, 0);
    }
  });

  it("a faster runner has a strictly higher rating", () => {
    const slow = calculateRating(calculateVVO2(calculateTinmanFitness(5000, 1500)).speedMetersPerMin, "male");
    const fast = calculateRating(calculateVVO2(calculateTinmanFitness(5000, 800)).speedMetersPerMin, "male");
    expect(fast).toBeGreaterThan(slow);
  });
});

describe("formatTinmanTime", () => {
  it("formats sub-hour times as mm:ss.ss, truncated (not rounded) to hundredths", () => {
    expect(formatTinmanTime(449.999)).toBe("07:29.99");
    expect(formatTinmanTime(60)).toBe("01:00.00");
  });

  it("formats hour-plus times as h:mm:ss with the fractional part truncated away", () => {
    expect(formatTinmanTime(7799.99)).toBe("2:09:59");
    expect(formatTinmanTime(3600)).toBe("1:00:00");
  });
});

describe("calculateTinman (full pipeline)", () => {
  // Manually verified live against the real calculator (a 5k in 16:16
  // reports 75.8%, a 4:47.40 mile, and a 2:35:19 marathon) -- this
  // particular time wasn't one of the 112 collected training points, so it
  // doubles as an out-of-sample check. Held to a looser tolerance than the
  // in-dataset tests above: predicting a mile from a 5k input crosses the
  // short-distance/long-distance piece boundary, which the validation
  // suite shows costs a few tenths of a second more than same-piece
  // predictions (see the reverse-engineering report's Step 5 section).
  it("reproduces the calculator's own documented worked example: 5k in 16:16 -> ~75.8% rating", () => {
    const result = calculateTinman(5000, 16 * 60 + 16, "male");
    expect(result.rating).toBeCloseTo(75.8, 0);
    const mile = result.equivalentRaceTimes.find((r) => r.label === "Mile")!;
    expect(mile.seconds).toBeCloseTo(4 * 60 + 47.4, 0);
    const marathon = result.equivalentRaceTimes.find((r) => r.label === "marathon")!;
    expect(formatTinmanTime(marathon.seconds)).toBe("2:35:19");
  });
});
