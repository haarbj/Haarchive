import { describe, expect, it } from "vitest";
import { generateSeasonBlueprint } from "@/lib/coaching-engine/season-generator";
import { addDays } from "@/lib/coaching-engine/date-utils";
import type { GenerateSeasonBlueprintInput } from "@/lib/coaching-engine/season-generator";

const TODAY = "2026-07-08";

// Mirrors plan-generator.test.ts's own fixture helper: generateSeasonBlueprint
// computes totalWeeks as floor(diffDays/7) + 1, so a goal date exactly
// `n * 7` days out actually yields an (n+1)-week season -- this is the date
// that lands totalWeeks at exactly n.
function weeksOut(n: number): string {
  return addDays(TODAY, n * 7 - 1);
}

function baseInput(overrides: Partial<GenerateSeasonBlueprintInput["goal"]> = {}): GenerateSeasonBlueprintInput {
  return {
    goal: {
      raceName: "State Meet",
      distanceM: 5000,
      date: weeksOut(16),
      ...overrides,
    },
    representativeAthlete: { currentWeeklyMileageM: 30 * 1609.34, daysPerWeek: 5 },
    today: TODAY,
  };
}

describe("generateSeasonBlueprint", () => {
  it("succeeds for a typical 16-week season", () => {
    const result = generateSeasonBlueprint(baseInput());
    expect(result.ok).toBe(true);
  });

  it("rejects a goal date less than 4 weeks out", () => {
    const result = generateSeasonBlueprint(baseInput({ date: addDays(TODAY, 10) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too close/i);
  });

  it("rejects a goal date more than 52 weeks out", () => {
    const result = generateSeasonBlueprint(baseInput({ date: addDays(TODAY, 53 * 7) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/more than a year/i);
  });

  it("gives phases sequential, zero-based order indexes", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    expect(result.phases.map((p) => p.orderIndex)).toEqual(result.phases.map((_, i) => i));
  });

  it("spans phases from today through goal day with no gaps", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    expect(result.phases[0].startDate).toBe(TODAY);
    expect(result.phases.at(-1)!.endDate).toBe(baseInput().goal.date);
    for (let i = 1; i < result.phases.length; i++) {
      expect(result.phases[i].startDate).toBe(addDays(result.phases[i - 1].endDate, 1));
    }
  });

  it("gives every week a phaseOrderIndex that resolves to a real phase", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    for (const week of result.weeks) {
      expect(week.phaseOrderIndex).toBeGreaterThanOrEqual(0);
      expect(week.phaseOrderIndex).toBeLessThan(result.phases.length);
    }
  });

  it("produces one week draft per week_index with no gaps or duplicates", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    const indexes = result.weeks.map((w) => w.weekIndex).sort((a, b) => a - b);
    expect(indexes).toEqual(Array.from({ length: result.weeks.length }, (_, i) => i));
  });

  it("uses this program's own phase display names", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    const names = result.phases.map((p) => p.displayName);
    expect(names).toContain("Summer Base");
    expect(names.some((n) => n === "Threshold Phase" || n === "VO2 Development" || n === "Championship Phase")).toBe(true);
  });

  it("never lists tempo or vo2 as a key workout type for the base phase", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    const basePhase = result.phases.find((p) => p.phase === "base");
    expect(basePhase?.keyWorkoutTypes).not.toContain("tempo");
    expect(basePhase?.keyWorkoutTypes).not.toContain("vo2");
  });

  it("labels exactly one slot 'Long Run' in every week", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    for (const week of result.weeks) {
      const longRunSlots = week.workoutSlots.filter((s) => s.label === "Long Run");
      expect(longRunSlots).toHaveLength(1);
    }
  });

  it("produces a mix of mileage levels across the season, not a single flat value", () => {
    const result = generateSeasonBlueprint(baseInput());
    if (!result.ok) throw new Error(result.error);

    const levels = new Set(result.weeks.map((w) => w.mileageLevel));
    expect(levels.size).toBeGreaterThan(1);
  });

  it("produces a materially different phase count for a 5K goal than a marathon goal", () => {
    const fiveK = generateSeasonBlueprint(baseInput());
    const marathon = generateSeasonBlueprint(baseInput({ raceName: "Marathon", distanceM: 42195 }));
    if (!fiveK.ok || !marathon.ok) throw new Error("expected both to succeed");

    expect(fiveK.phases.length).not.toBe(marathon.phases.length);
  });
});
