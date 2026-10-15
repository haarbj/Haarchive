import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  type CvOutcome,
  type CvPiecesModel,
  type QuantileKey,
  extrapolationNote,
  hullStatusFor,
  isWithinModelDomain,
  predictOutcomeParams,
  predictSpeeds,
  quantileSpeed,
  selectTrainingPaces,
  uncertaintyRangeMS,
} from "@/lib/cv-threshold-math";

const model: CvPiecesModel = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/cv-threshold-pieces-v2026-09-05.json"), "utf8"),
);

type GoldenOutcome = {
  mu: number;
  sigma: number;
  eps: number;
  delta: number;
  speed_m_s: Record<QuantileKey, number>;
};

type GoldenCase = {
  id: string;
  dist_m: number;
  time_s: number;
  in_hull: boolean;
  outcomes: Record<CvOutcome, GoldenOutcome>;
};

const goldens: { n_cases: number; cases: GoldenCase[] } = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/cv-threshold-goldens.json"), "utf8"),
);

const OUTCOMES: CvOutcome[] = ["cs", "cs_minus", "cs_plus"];
const QUANTILE_KEYS: QuantileKey[] = ["q025", "q05", "q10", "q50", "q90", "q95", "q975"];

function paceSecondsPerMile(speedMS: number): number {
  return 1609.344 / speedMS;
}

describe("golden cases (source repo's own R predict() output)", () => {
  it("has the expected 429 real cases", () => {
    expect(goldens.n_cases).toBe(429);
    expect(goldens.cases).toHaveLength(429);
  });

  it("matches shash params and every quantile speed for every outcome, across all 429 cases", () => {
    for (const c of goldens.cases) {
      for (const outcome of OUTCOMES) {
        const params = predictOutcomeParams(model, outcome, c.dist_m, c.time_s);
        const golden = c.outcomes[outcome];
        expect(params.mu).toBeCloseTo(golden.mu, 9);
        expect(params.sigma).toBeCloseTo(golden.sigma, 9);
        expect(params.eps).toBeCloseTo(golden.eps, 9);
        expect(params.delta).toBeCloseTo(golden.delta, 9);
        for (const q of QUANTILE_KEYS) {
          expect(quantileSpeed(params, q)).toBeCloseTo(golden.speed_m_s[q], 9);
        }
      }
    }
  });

  it("predictSpeeds reproduces the same golden speeds via the public API", () => {
    for (const c of goldens.cases) {
      const prediction = predictSpeeds(model, c.dist_m, c.time_s);
      for (const outcome of OUTCOMES) {
        for (const q of QUANTILE_KEYS) {
          expect(prediction[outcome][q]).toBeCloseTo(c.outcomes[outcome].speed_m_s[q], 9);
        }
      }
    }
  });

  it("hullStatusFor agrees with the golden's own in_hull flag", () => {
    for (const c of goldens.cases) {
      const status = hullStatusFor(model, c.dist_m, c.time_s);
      expect(status === "inside").toBe(c.in_hull);
    }
  });
});

describe("predictSpeeds", () => {
  it("matches the source README's worked example: 18:00 5K predicts roughly a 6-minute/mile median threshold pace", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60);
    const paceSeconds = paceSecondsPerMile(prediction.cs_minus.q50);
    expect(paceSeconds).toBeCloseTo(372, 0); // ~6:12/mi under the v2 model
  });

  it("orders paces physiologically: threshold is slower than CV, which is slower than VO2max", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60);
    expect(prediction.cs_minus.q50).toBeLessThan(prediction.cs.q50);
    expect(prediction.cs.q50).toBeLessThan(prediction.cs_plus.q50);
  });

  it("increases (faster) with a stronger performance at a fixed distance", () => {
    const slower = predictSpeeds(model, 5000, 20 * 60);
    const faster = predictSpeeds(model, 5000, 16 * 60);
    expect(faster.cs_minus.q50).toBeGreaterThan(slower.cs_minus.q50);
  });

  it("each outcome's speed quantiles are themselves ordered from q025 up to q975", () => {
    const prediction = predictSpeeds(model, 3000, 10 * 60);
    for (const outcome of OUTCOMES) {
      const row = prediction[outcome];
      for (let i = 0; i < QUANTILE_KEYS.length - 1; i++) {
        expect(row[QUANTILE_KEYS[i]]).toBeLessThan(row[QUANTILE_KEYS[i + 1]]);
      }
    }
  });
});

describe("selectTrainingPaces", () => {
  it("safe mode picks the conservative (slower-threshold, faster-VO2max) percentile", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60);
    const safe = selectTrainingPaces(prediction, "safe");
    const median = selectTrainingPaces(prediction, "median");
    expect(safe.thresholdSpeedMS).toBeCloseTo(prediction.cs_minus.q10, 10);
    expect(safe.vo2maxSpeedMS).toBeCloseTo(prediction.cs_plus.q90, 10);
    expect(median.thresholdSpeedMS).toBeCloseTo(prediction.cs_minus.q50, 10);
    expect(median.vo2maxSpeedMS).toBeCloseTo(prediction.cs_plus.q50, 10);
  });

  it("CV pace is always the median, regardless of mode", () => {
    const prediction = predictSpeeds(model, 5000, 18 * 60);
    const safe = selectTrainingPaces(prediction, "safe");
    const median = selectTrainingPaces(prediction, "median");
    expect(safe.cvSpeedMS).toBeCloseTo(prediction.cs.q50, 10);
    expect(median.cvSpeedMS).toBeCloseTo(prediction.cs.q50, 10);
  });
});

describe("uncertaintyRangeMS", () => {
  it("the fast end is always a higher speed (faster/lower pace) than the slow end, at every range level", () => {
    const prediction = predictSpeeds(model, 1500, 5 * 60);
    for (const level of [80, 90, 95] as const) {
      const range = uncertaintyRangeMS(prediction, level);
      expect(range.threshold.fastMS).toBeGreaterThan(range.threshold.slowMS);
      expect(range.cv.fastMS).toBeGreaterThan(range.cv.slowMS);
      expect(range.vo2max.fastMS).toBeGreaterThan(range.vo2max.slowMS);
    }
  });

  it("defaults to the 90% range", () => {
    const prediction = predictSpeeds(model, 1500, 5 * 60);
    const defaultRange = uncertaintyRangeMS(prediction);
    const explicitRange = uncertaintyRangeMS(prediction, 90);
    expect(defaultRange).toEqual(explicitRange);
  });
});

describe("isWithinModelDomain / hullStatusFor", () => {
  it("accepts a realistic 5K performance", () => {
    expect(isWithinModelDomain(model, 5000, 18 * 60)).toBe(true);
    expect(hullStatusFor(model, 5000, 18 * 60)).toBe("inside");
  });

  it("rejects a distance far outside the fitted range as too long", () => {
    expect(isWithinModelDomain(model, 42195, 3 * 60 * 60)).toBe(false);
    expect(hullStatusFor(model, 42195, 3 * 60 * 60)).toBe("long");
  });

  it("rejects a distance far too short", () => {
    expect(hullStatusFor(model, 100, 20)).toBe("short");
  });

  it("rejects a time that's implausible for the given distance as too fast", () => {
    // A 5000m "run" in 30 seconds is far faster than the model's fitted range.
    expect(isWithinModelDomain(model, 5000, 30)).toBe(false);
    expect(hullStatusFor(model, 5000, 30)).toBe("fast");
  });

  it("rejects a time far too slow for the given distance", () => {
    expect(hullStatusFor(model, 5000, 3 * 60 * 60)).toBe("slow");
  });
});

describe("extrapolationNote", () => {
  it("returns null for a performance inside the data hull", () => {
    expect(extrapolationNote(model, 5000, 18 * 60, "the 5K")).toBeNull();
  });

  it("returns a real note for a performance outside the hull", () => {
    const note = extrapolationNote(model, 42195, 3 * 60 * 60, "the marathon");
    expect(note).toBeTruthy();
    expect(note).toMatch(/extrapolated/);
  });
});
