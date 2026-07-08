import { describe, expect, it } from "vitest";
import {
  allocateMesocycles,
  buildWeeklyPhaseSequence,
  coalesceMesocycles,
  CUTBACK_INTERVAL_WEEKS,
} from "@/lib/coaching-engine/periodization";

const MARATHON_M = 42195;
const FIVE_K_M = 5000;

describe("allocateMesocycles", () => {
  it("always sums to exactly totalWeeks, across a full sweep", () => {
    for (let totalWeeks = 4; totalWeeks <= 52; totalWeeks++) {
      for (const distanceM of [1609, 5000, 10000, 21097, 42195]) {
        const allocation = allocateMesocycles(totalWeeks, distanceM);
        const sum = allocation.reduce((total, a) => total + a.weeks, 0);
        expect(sum, `totalWeeks=${totalWeeks} distanceM=${distanceM}`).toBe(totalWeeks);
      }
    }
  });

  it("never allocates a negative or zero-week phase (other than by omission)", () => {
    for (let totalWeeks = 4; totalWeeks <= 52; totalWeeks++) {
      const allocation = allocateMesocycles(totalWeeks, MARATHON_M);
      for (const a of allocation) {
        expect(a.weeks).toBeGreaterThan(0);
      }
    }
  });

  it("collapses to base + taper only for very short plans", () => {
    const allocation = allocateMesocycles(4, MARATHON_M);
    expect(allocation.map((a) => a.phase)).toEqual(["base", "taper"]);
  });

  it("gives a marathon goal a longer taper than a 5K goal at the same length", () => {
    const marathonTaper = allocateMesocycles(20, MARATHON_M).find((a) => a.phase === "taper")!;
    const fiveKTaper = allocateMesocycles(20, FIVE_K_M).find((a) => a.phase === "taper")!;
    expect(marathonTaper.weeks).toBeGreaterThan(fiveKTaper.weeks);
  });

  it("includes all four phases for a typical 16-week marathon plan", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    expect(allocation.map((a) => a.phase)).toEqual(["base", "build", "peak", "taper"]);
  });
});

describe("buildWeeklyPhaseSequence", () => {
  it("produces exactly one entry per week", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    const weeks = buildWeeklyPhaseSequence(allocation);
    expect(weeks).toHaveLength(16);
    expect(weeks.map((w) => w.weekIndex)).toEqual([...Array(16).keys()]);
  });

  it("marks every 4th non-taper training week as a recovery cutback", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    const weeks = buildWeeklyPhaseSequence(allocation);

    // The original phase per week, before cutback substitution -- used only
    // to know which weeks were "taper" going in, since taper is excluded
    // from the cutback count entirely.
    const originalPhaseByWeek = allocation.flatMap((block) => Array(block.weeks).fill(block.phase));

    let trainingWeekCount = 0;
    for (const week of weeks) {
      if (originalPhaseByWeek[week.weekIndex] === "taper") {
        expect(week.isCutback).toBe(false);
        continue;
      }
      trainingWeekCount += 1;
      const expectCutback = trainingWeekCount % CUTBACK_INTERVAL_WEEKS === 0;
      expect(week.isCutback).toBe(expectCutback);
      if (expectCutback) expect(week.phase).toBe("recovery");
    }
  });

  it("never marks a taper week as a cutback", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    const weeks = buildWeeklyPhaseSequence(allocation);
    const taperWeeks = weeks.slice(-allocation.find((a) => a.phase === "taper")!.weeks);
    for (const week of taperWeeks) {
      expect(week.isCutback).toBe(false);
      expect(week.phase).toBe("taper");
    }
  });
});

describe("coalesceMesocycles", () => {
  const planStartDate = "2026-07-08";

  it("produces contiguous, non-overlapping date ranges covering the whole plan", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    const weeks = buildWeeklyPhaseSequence(allocation);
    const { mesocycles } = coalesceMesocycles(weeks, planStartDate);

    expect(mesocycles[0].startDate).toBe(planStartDate);
    for (let i = 1; i < mesocycles.length; i++) {
      // Each mesocycle should start exactly one day after the previous ends.
      const prevEnd = new Date(`${mesocycles[i - 1].endDate}T00:00:00`);
      const thisStart = new Date(`${mesocycles[i].startDate}T00:00:00`);
      const gapDays = (thisStart.getTime() - prevEnd.getTime()) / (24 * 60 * 60 * 1000);
      expect(gapDays).toBe(1);
    }
  });

  it("gives every week a valid mesocycle index", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    const weeks = buildWeeklyPhaseSequence(allocation);
    const { mesocycles, weekMesocycleIndex } = coalesceMesocycles(weeks, planStartDate);

    expect(weekMesocycleIndex).toHaveLength(weeks.length);
    for (const index of weekMesocycleIndex) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(mesocycles.length);
    }
    // Indices are non-decreasing -- weeks are assigned to mesocycles in order.
    for (let i = 1; i < weekMesocycleIndex.length; i++) {
      expect(weekMesocycleIndex[i]).toBeGreaterThanOrEqual(weekMesocycleIndex[i - 1]);
    }
  });

  it("assigns each week's mesocycle the same phase as that week", () => {
    const allocation = allocateMesocycles(16, MARATHON_M);
    const weeks = buildWeeklyPhaseSequence(allocation);
    const { mesocycles, weekMesocycleIndex } = coalesceMesocycles(weeks, planStartDate);

    weeks.forEach((week, i) => {
      expect(mesocycles[weekMesocycleIndex[i]].phase).toBe(week.phase);
    });
  });
});
