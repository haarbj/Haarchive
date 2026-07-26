import { describe, expect, it } from "vitest";

import { buildFuelingSchedule, computeFuelingTargets, type MileForFueling } from "@/lib/marathon-pacing/fueling-engine";

describe("computeFuelingTargets", () => {
  it("recommends no carbs for a sub-1-hour effort", () => {
    const targets = computeFuelingTargets({ goalTimeSeconds: 40 * 60 });
    expect(targets.carbGramsPerHour).toBe(0);
    expect(targets.caffeineRecommended).toBe(false);
  });

  it("recommends a moderate carb rate for a 1.5-hour effort", () => {
    const targets = computeFuelingTargets({ goalTimeSeconds: 90 * 60 });
    expect(targets.carbGramsPerHour).toBeGreaterThan(0);
    expect(targets.carbGramsPerHour).toBeLessThan(60);
  });

  it("recommends the highest carb rate and caffeine for a marathon-length effort", () => {
    const targets = computeFuelingTargets({ goalTimeSeconds: 3.5 * 3600 });
    expect(targets.carbGramsPerHour).toBeGreaterThanOrEqual(60);
    expect(targets.caffeineRecommended).toBe(true);
  });

  it("scales fluid needs up for a heavier runner", () => {
    const light = computeFuelingTargets({ goalTimeSeconds: 3.5 * 3600, weightKg: 55 });
    const heavy = computeFuelingTargets({ goalTimeSeconds: 3.5 * 3600, weightKg: 95 });
    expect(heavy.fluidMlPerHour).toBeGreaterThan(light.fluidMlPerHour);
  });

  it("scales fluid and sodium needs up in the heat", () => {
    const cool = computeFuelingTargets({ goalTimeSeconds: 3.5 * 3600, tempC: 10 });
    const hot = computeFuelingTargets({ goalTimeSeconds: 3.5 * 3600, tempC: 32 });
    expect(hot.fluidMlPerHour).toBeGreaterThan(cool.fluidMlPerHour);
    expect(hot.sodiumMgPerHour).toBeGreaterThan(cool.sodiumMgPerHour);
  });
});

describe("buildFuelingSchedule", () => {
  const goalTimeSeconds = 3.5 * 3600;
  const mileCount = 26;
  const paceSecPerMile = goalTimeSeconds / mileCount;
  const splits: MileForFueling[] = Array.from({ length: mileCount }, (_, i) => ({ mile: i + 1, paceSecPerMile }));
  const targets = computeFuelingTargets({ goalTimeSeconds });

  it("produces reminders roughly every 20 minutes, not every mile", () => {
    const schedule = buildFuelingSchedule(splits, targets, goalTimeSeconds);
    expect(schedule.length).toBeGreaterThan(1);
    expect(schedule.length).toBeLessThan(mileCount); // fewer reminders than miles

    for (let i = 1; i < schedule.length; i++) {
      const milesBetween = schedule[i].atMile - schedule[i - 1].atMile;
      const minutesBetween = milesBetween * (paceSecPerMile / 60);
      expect(minutesBetween).toBeGreaterThan(15); // roughly 20 minutes, allowing for mile-granularity rounding
    }
  });

  it("delivers close to the full-race carbohydrate target across the whole schedule", () => {
    const schedule = buildFuelingSchedule(splits, targets, goalTimeSeconds);
    const totalCarbGrams = schedule.reduce((sum, r) => sum + r.carbGrams, 0);
    const expectedTotal = targets.carbGramsPerHour * (goalTimeSeconds / 3600);

    expect(totalCarbGrams).toBeLessThanOrEqual(expectedTotal + 1);
    expect(totalCarbGrams).toBeGreaterThan(expectedTotal * 0.85); // only the final sub-20-minute remainder is left uncounted
  });

  it("only suggests caffeine on reminders in the race's final third, and only when recommended at all", () => {
    const schedule = buildFuelingSchedule(splits, targets, goalTimeSeconds);
    const withCaffeineNote = schedule.filter((r) => r.note !== "");
    expect(withCaffeineNote.length).toBeGreaterThan(0);
    for (const reminder of withCaffeineNote) {
      expect(reminder.atMile / mileCount).toBeGreaterThanOrEqual(2 / 3 - 0.05);
    }

    const shortRaceTargets = computeFuelingTargets({ goalTimeSeconds: 50 * 60 });
    const shortSplits: MileForFueling[] = Array.from({ length: 8 }, (_, i) => ({ mile: i + 1, paceSecPerMile: (50 * 60) / 8 }));
    const shortSchedule = buildFuelingSchedule(shortSplits, shortRaceTargets, 50 * 60);
    expect(shortSchedule.every((r) => r.note === "")).toBe(true);
  });
});
