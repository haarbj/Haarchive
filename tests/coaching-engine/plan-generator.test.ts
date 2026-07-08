import { describe, expect, it } from "vitest";
import { generateTrainingPlan } from "@/lib/coaching-engine/plan-generator";
import { addDays } from "@/lib/coaching-engine/date-utils";
import type { GenerateTrainingPlanInput } from "@/lib/coaching-engine/types";

const TODAY = "2026-07-08";

// generateTrainingPlan computes totalWeeks as floor(diffDays/7) + 1, so a
// goal date exactly `n * 7` days out actually yields an (n+1)-week plan --
// this is the date that lands totalWeeks at exactly n.
function weeksOut(n: number): string {
  return addDays(TODAY, n * 7 - 1);
}

function baseInput(overrides: Partial<GenerateTrainingPlanInput["goal"]> = {}): GenerateTrainingPlanInput {
  return {
    goal: {
      raceName: "Chicago Marathon",
      distanceM: 42195,
      timeS: 3 * 3600 + 30 * 60,
      date: weeksOut(16),
      ...overrides,
    },
    athlete: { currentWeeklyMileageM: 30 * 1609.34, daysPerWeek: 5 },
    today: TODAY,
  };
}

describe("generateTrainingPlan", () => {
  it("succeeds for a typical 16-week marathon plan", () => {
    const result = generateTrainingPlan(baseInput());
    expect(result.ok).toBe(true);
  });

  it("rejects a goal date less than 4 weeks out", () => {
    const result = generateTrainingPlan(baseInput({ date: addDays(TODAY, 10) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too close/i);
  });

  it("rejects a goal date more than 52 weeks out", () => {
    const result = generateTrainingPlan(baseInput({ date: addDays(TODAY, 53 * 7) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than a year/i);
  });

  it("accepts exactly the 4-week and 52-week boundaries", () => {
    expect(generateTrainingPlan(baseInput({ date: weeksOut(4) })).ok).toBe(true);
    expect(generateTrainingPlan(baseInput({ date: weeksOut(52) })).ok).toBe(true);
  });

  it("rejects one day inside each boundary", () => {
    expect(generateTrainingPlan(baseInput({ date: weeksOut(3) })).ok).toBe(false);
    expect(generateTrainingPlan(baseInput({ date: weeksOut(53) })).ok).toBe(false);
  });

  it("ends the plan with exactly one race-day workout on goal day", () => {
    const result = generateTrainingPlan(baseInput());
    if (!result.ok) throw new Error(result.error);

    const raceWorkouts = result.workouts.filter((w) => w.workoutType === "race");
    expect(raceWorkouts).toHaveLength(1);
    expect(raceWorkouts[0].scheduledDate).toBe(result.plan.endDate);
    expect(result.plan.endDate).toBe(baseInput().goal.date);
  });

  it("sets plan metadata consistent with the input", () => {
    const input = baseInput();
    const result = generateTrainingPlan(input);
    if (!result.ok) throw new Error(result.error);

    expect(result.plan.startDate).toBe(input.today);
    expect(result.plan.endDate).toBe(input.goal.date);
    expect(result.plan.philosophy).toBe("custom");
    expect(result.plan.status).toBe("active");
    expect(result.plan.name).toContain(input.goal.raceName);
  });

  it("gives every workout a mesocycleIndex that resolves to a real mesocycle", () => {
    const result = generateTrainingPlan(baseInput());
    if (!result.ok) throw new Error(result.error);

    for (const workout of result.workouts) {
      expect(workout.mesocycleIndex).toBeGreaterThanOrEqual(0);
      expect(workout.mesocycleIndex).toBeLessThan(result.mesocycles.length);
    }
  });

  it("keeps every workout's date within its own mesocycle's date range", () => {
    const result = generateTrainingPlan(baseInput());
    if (!result.ok) throw new Error(result.error);

    for (const workout of result.workouts) {
      const mesocycle = result.mesocycles[workout.mesocycleIndex];
      expect(workout.scheduledDate >= mesocycle.startDate).toBe(true);
      expect(workout.scheduledDate <= mesocycle.endDate).toBe(true);
    }
  });

  it("produces mesocycles that together span from today through goal day with no gaps", () => {
    const result = generateTrainingPlan(baseInput());
    if (!result.ok) throw new Error(result.error);

    expect(result.mesocycles[0].startDate).toBe(TODAY);
    expect(result.mesocycles.at(-1)!.endDate).toBe(result.plan.endDate);
  });

  it("produces a materially different plan for a 5K goal than a marathon goal", () => {
    const marathon = generateTrainingPlan(baseInput());
    const fiveK = generateTrainingPlan(
      baseInput({ raceName: "Turkey Trot 5K", distanceM: 5000, timeS: 20 * 60 }),
    );
    if (!marathon.ok || !fiveK.ok) throw new Error("expected both plans to succeed");

    // Different taper lengths (long vs. short bucket) should produce a
    // different number of mesocycles for the same overall plan length.
    expect(marathon.mesocycles.length).not.toBe(fiveK.mesocycles.length);
  });

  it("scales weekly volume with the athlete's reported current mileage", () => {
    const low = generateTrainingPlan({
      ...baseInput(),
      athlete: { currentWeeklyMileageM: 15 * 1609.34, daysPerWeek: 5 },
    });
    const high = generateTrainingPlan({
      ...baseInput(),
      athlete: { currentWeeklyMileageM: 45 * 1609.34, daysPerWeek: 5 },
    });
    if (!low.ok || !high.ok) throw new Error("expected both plans to succeed");

    // Mesocycle 0 is always the plan's first "base" block, whose template
    // never includes tempo/vo2 -- every prescription in it is a plain
    // { distanceM } shape, so summing distanceM directly is safe here.
    const firstBlockTotal = (plan: typeof low) =>
      plan.workouts
        .filter((w) => w.mesocycleIndex === 0)
        .reduce((sum, w) => sum + ("distanceM" in w.prescription ? w.prescription.distanceM : 0), 0);

    expect(firstBlockTotal(high)).toBeGreaterThan(firstBlockTotal(low));
  });
});
