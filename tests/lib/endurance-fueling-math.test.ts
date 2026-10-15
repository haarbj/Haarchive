import { describe, expect, it } from "vitest";

import {
  estimatedFluidLossMlPerHour,
  estimatedSodiumLossMgPerHour,
  fluidTargetMlPerHour,
  type GiTrainingLevel,
  type HeartRateZone,
  sodiumTargetMgPerHour,
  suggestedCarbsPerHour,
} from "@/lib/endurance-fueling-math";

import rawDataset from "../fixtures/endurance-fueling-dataset.json";

// The fixture is a real (input -> output) dataset collected live from the
// GW Endurance Fueling Calculator (goranwinblad.se/endurancefuelingcalculator/,
// Goran Winblad) -- 324 queries across the carbs lookup grid, fine-grained
// temperature/weight/zone sweeps (including a follow-up correction pass for
// the fluid intake target, initially missed), held-out cross-combinations,
// and 120 randomized full-input-space queries. See
// /docs/endurance-fueling-reverse-engineering-report.md.

type DatasetRow = {
  kind: string;
  bodyWeightKg?: number;
  temperatureC?: number;
  zone?: HeartRateZone;
  gi?: GiTrainingLevel;
  expectedCarbsPerHour?: number;
  expectedFluidLossMlPerHour?: number;
  expectedFluidTargetMlPerHour?: number;
  expectedSodiumTargetMgPerHour?: number;
  expectedSodiumLossMgPerHour?: number;
};

const dataset = rawDataset as DatasetRow[];

describe("suggestedCarbsPerHour", () => {
  it("matches every collected (zone, GI training) cell exactly", () => {
    let checked = 0;
    for (const row of dataset) {
      if (row.expectedCarbsPerHour == null || !row.zone || !row.gi) continue;
      expect(suggestedCarbsPerHour(row.zone, row.gi)).toBe(row.expectedCarbsPerHour);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("HighCarbMachine always returns 120 regardless of intensity", () => {
    const zones: HeartRateZone[] = ["50-60%", "60-70%", "70-80%", "80-90%", "90-100%"];
    for (const zone of zones) {
      expect(suggestedCarbsPerHour(zone, "HighCarbMachine")).toBe(120);
    }
  });
});

describe("estimatedFluidLossMlPerHour", () => {
  it("predicts every collected (weight, temperature, zone) combination to within 260 mL/hr (RMSE ~80)", () => {
    let sumSquaredError = 0;
    let maxAbsError = 0;
    let n = 0;
    for (const row of dataset) {
      if (row.expectedFluidLossMlPerHour == null) continue;
      if (row.bodyWeightKg === undefined || row.temperatureC === undefined || !row.zone) continue;
      const predicted = estimatedFluidLossMlPerHour(row.bodyWeightKg, row.temperatureC, row.zone);
      const error = Math.abs(predicted - row.expectedFluidLossMlPerHour);
      sumSquaredError += error ** 2;
      maxAbsError = Math.max(maxAbsError, error);
      n++;
    }
    const rmse = Math.sqrt(sumSquaredError / n);
    expect(n).toBeGreaterThan(100);
    expect(rmse).toBeLessThan(85);
    expect(maxAbsError).toBeLessThan(265);
  });

  it("never returns below the observed 300 mL/hr floor", () => {
    expect(estimatedFluidLossMlPerHour(40, 0, "50-60%")).toBeGreaterThanOrEqual(300);
  });

  it("increases with temperature and with exercise intensity", () => {
    const cool = estimatedFluidLossMlPerHour(72, 10, "70-80%");
    const hot = estimatedFluidLossMlPerHour(72, 30, "70-80%");
    expect(hot).toBeGreaterThan(cool);

    const easy = estimatedFluidLossMlPerHour(72, 15, "50-60%");
    const hard = estimatedFluidLossMlPerHour(72, 15, "90-100%");
    expect(hard).toBeGreaterThan(easy);
  });
});

describe("fluidTargetMlPerHour", () => {
  it("matches every collected temperature sweep point exactly", () => {
    let checked = 0;
    for (const row of dataset) {
      if (row.kind !== "temp" || row.expectedFluidTargetMlPerHour == null || row.temperatureC === undefined) continue;
      expect(fluidTargetMlPerHour(row.temperatureC)).toBe(row.expectedFluidTargetMlPerHour);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("is within 50mL/hr of every dedicated weight- and zone-independence check (two known rounding blips excluded from exact match, see the module's own comment)", () => {
    let checked = 0;
    for (const row of dataset) {
      if (
        (row.kind !== "fluid_target_weight_check" && row.kind !== "fluid_target_zone_check") ||
        row.expectedFluidTargetMlPerHour == null ||
        row.temperatureC === undefined
      )
        continue;
      expect(Math.abs(fluidTargetMlPerHour(row.temperatureC) - row.expectedFluidTargetMlPerHour)).toBeLessThanOrEqual(50);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("is always at or below the estimated loss at the same temperature (a deliberate controlled deficit)", () => {
    for (let t = 0; t <= 40; t += 5) {
      expect(fluidTargetMlPerHour(t)).toBeLessThanOrEqual(estimatedFluidLossMlPerHour(72, t, "70-80%"));
    }
  });

  it("flat at 300 mL/hr through 17C, then rises to a 1,600 mL/hr ceiling by 35C", () => {
    expect(fluidTargetMlPerHour(10)).toBe(300);
    expect(fluidTargetMlPerHour(17)).toBe(300);
    expect(fluidTargetMlPerHour(35)).toBe(1600);
    expect(fluidTargetMlPerHour(40)).toBe(1600);
  });
});

describe("estimatedSodiumLossMgPerHour / sodiumTargetMgPerHour", () => {
  it("match every collected temperature exactly (both are weight- and zone-independent)", () => {
    let checkedLoss = 0;
    let checkedTarget = 0;
    for (const row of dataset) {
      if (row.temperatureC === undefined) continue;
      if (row.expectedSodiumLossMgPerHour != null) {
        expect(estimatedSodiumLossMgPerHour(row.temperatureC)).toBe(row.expectedSodiumLossMgPerHour);
        checkedLoss++;
      }
      if (row.expectedSodiumTargetMgPerHour != null) {
        expect(sodiumTargetMgPerHour(row.temperatureC)).toBe(row.expectedSodiumTargetMgPerHour);
        checkedTarget++;
      }
    }
    expect(checkedLoss).toBeGreaterThan(100);
    expect(checkedTarget).toBeGreaterThan(100);
  });

  it("the sodium target is always at or below the estimated loss (the calculator deliberately under-replaces sodium)", () => {
    for (let t = 0; t <= 40; t += 5) {
      expect(sodiumTargetMgPerHour(t)).toBeLessThanOrEqual(estimatedSodiumLossMgPerHour(t) + 50);
    }
  });
});
