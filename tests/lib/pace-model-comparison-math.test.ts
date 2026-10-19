import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { calculatePaceCalculatorTrainingPaces } from "@/lib/pace-calculator-math";
import {
  AGREEMENT_THRESHOLD_SEC_PER_MILE,
  buildPaceModelComparison,
  COMPARISON_ZONES,
  MODEL_IDS,
} from "@/lib/pace-model-comparison-math";
import {
  predictSpeeds,
  uncertaintyRangeMS,
  type CvPiecesModel,
} from "@/lib/cv-threshold-math";
import {
  calculateTinmanFitness,
  calculateTrainingPaces,
  calculateVVO2,
  TRAINING_PACE_COLUMNS,
} from "@/lib/tinman-calculator-math";
import { MILE_METERS } from "@/lib/race-distances";

const cvModel: CvPiecesModel = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/cv-threshold-pieces-v2026-09-05.json"), "utf8"),
);

const FIVE_K_METERS = 5000;
const FIVE_K_SECONDS = 18 * 60; // 18:00 5k

describe("buildPaceModelComparison -- zero calculation drift against each standalone calculator", () => {
  it("matches the Pace & Heart Rate Calculator's own Easy/Tempo/VO2/Marathon numbers exactly", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, cvModel);
    // Same course/difficulty default the standalone calculator itself uses
    // for a non-XC input -- see pace-model-comparison-math.ts's own
    // RIEGEL_COURSE/RIEGEL_DEFAULT_XC_ADJUSTMENT comment.
    const standalone = calculatePaceCalculatorTrainingPaces(FIVE_K_METERS, FIVE_K_SECONDS, "track", 0.95);

    const easy = rows.find((r) => r.zone === "Easy")!;
    expect(easy.cells.riegel).toEqual({
      fastSecPerMile: standalone.easyPaceRange[0],
      slowSecPerMile: standalone.easyPaceRange[1],
    });

    const marathon = rows.find((r) => r.zone === "Marathon")!;
    expect(marathon.cells.riegel).toEqual({
      fastSecPerMile: standalone.marathonPaceRange[0],
      slowSecPerMile: standalone.marathonPaceRange[1],
    });

    const threshold = rows.find((r) => r.zone === "Tempo / Threshold")!;
    expect(threshold.cells.riegel).toEqual({
      fastSecPerMile: standalone.tempoThresholdPaceSecPerMile,
      slowSecPerMile: standalone.tempoThresholdPaceSecPerMile,
    });

    const vo2 = rows.find((r) => r.zone === "VO2max")!;
    expect(vo2.cells.riegel).toEqual({
      fastSecPerMile: standalone.vo2OrientedPaceSecPerMile,
      slowSecPerMile: standalone.vo2OrientedPaceSecPerMile,
    });

    // Riegel has no critical-velocity concept at all.
    const cv = rows.find((r) => r.zone === "CV")!;
    expect(cv.cells.riegel).toBeNull();
  });

  it("matches the Tinman Running Calculator's own Easy/MLSS-Threshold/CV/VO2max Mile-column numbers exactly", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, cvModel);
    const time3k = calculateTinmanFitness(FIVE_K_METERS, FIVE_K_SECONDS);
    const vvo2 = calculateVVO2(time3k);
    const standaloneRows = calculateTrainingPaces(vvo2);
    const mileIndex = TRAINING_PACE_COLUMNS.findIndex((c) => c.label === "Mile");

    const expectCellMatchesZone = (comparisonZone: string, tinmanZone: string) => {
      const row = rows.find((r) => r.zone === comparisonZone)!;
      const standaloneCell = standaloneRows.find((r) => r.zone === tinmanZone)!.cells[mileIndex]!;
      // This module flips Tinman's {low: slower, high: faster} into this
      // module's fast-first convention -- see tinmanCells's own comment.
      expect(row.cells.tinman).toEqual({
        fastSecPerMile: standaloneCell.high,
        slowSecPerMile: standaloneCell.low,
      });
    };

    expectCellMatchesZone("Easy", "Easy");
    expectCellMatchesZone("Tempo / Threshold", "MLSS/Threshold");
    expectCellMatchesZone("CV", "CV");
    expectCellMatchesZone("VO2max", "VO2 max");

    // Tinman's 13-zone system has no marathon-specific zone.
    const marathon = rows.find((r) => r.zone === "Marathon")!;
    expect(marathon.cells.tinman).toBeNull();
  });

  it("matches the Threshold/CV/VO2max statistical calculator's own 90% safe-mode range exactly", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, cvModel);
    const prediction = predictSpeeds(cvModel, FIVE_K_METERS, FIVE_K_SECONDS);
    const ranges = uncertaintyRangeMS(prediction, 90);

    const threshold = rows.find((r) => r.zone === "Tempo / Threshold")!;
    expect(threshold.cells.statistical).toEqual({
      fastSecPerMile: MILE_METERS / ranges.threshold.fastMS,
      slowSecPerMile: MILE_METERS / ranges.threshold.slowMS,
    });

    const cv = rows.find((r) => r.zone === "CV")!;
    expect(cv.cells.statistical).toEqual({
      fastSecPerMile: MILE_METERS / ranges.cv.fastMS,
      slowSecPerMile: MILE_METERS / ranges.cv.slowMS,
    });

    const vo2 = rows.find((r) => r.zone === "VO2max")!;
    expect(vo2.cells.statistical).toEqual({
      fastSecPerMile: MILE_METERS / ranges.vo2max.fastMS,
      slowSecPerMile: MILE_METERS / ranges.vo2max.slowMS,
    });

    // The statistical model has no easy-pace or marathon-specific output.
    expect(rows.find((r) => r.zone === "Easy")!.cells.statistical).toBeNull();
    expect(rows.find((r) => r.zone === "Marathon")!.cells.statistical).toBeNull();
  });

  it("renders every zone's dash convention when the statistical model hasn't loaded yet", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, null);
    for (const row of rows) {
      expect(row.cells.statistical).toBeNull();
    }
  });

  it("covers exactly the five zones the product spec calls for, in that order", () => {
    expect(COMPARISON_ZONES).toEqual(["Easy", "Marathon", "Tempo / Threshold", "CV", "VO2max"]);
  });

  it("always returns all three model ids per row, even when a model has no value", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, cvModel);
    for (const row of rows) {
      expect(Object.keys(row.cells).sort()).toEqual([...MODEL_IDS].sort());
    }
  });
});

describe("agreement/divergence marking", () => {
  it("marks a row 'insufficient' when fewer than two models produce a value", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, null);
    // With no statistical model loaded, Marathon only has Riegel's own number.
    const marathon = rows.find((r) => r.zone === "Marathon")!;
    expect(marathon.agreement).toBe("insufficient");
    expect(marathon.spreadSecPerMile).toBeNull();
  });

  it("marks a row 'agree' only when every present model's midpoint is within the threshold", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, cvModel);
    for (const row of rows) {
      if (row.agreement !== "agree") continue;
      expect(row.spreadSecPerMile).not.toBeNull();
      expect(row.spreadSecPerMile!).toBeLessThanOrEqual(AGREEMENT_THRESHOLD_SEC_PER_MILE);
    }
  });

  it("marks a row 'diverge' whenever the spread exceeds the threshold", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, cvModel);
    for (const row of rows) {
      if (row.agreement !== "diverge") continue;
      expect(row.spreadSecPerMile!).toBeGreaterThan(AGREEMENT_THRESHOLD_SEC_PER_MILE);
    }
  });

  it("never claims agreement or divergence for a row only one model produces", () => {
    const rows = buildPaceModelComparison(FIVE_K_METERS, FIVE_K_SECONDS, null);
    for (const row of rows) {
      const presentCount = Object.values(row.cells).filter((c) => c !== null).length;
      if (presentCount < 2) expect(row.agreement).toBe("insufficient");
    }
  });
});
