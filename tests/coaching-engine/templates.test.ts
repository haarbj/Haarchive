import { describe, expect, it } from "vitest";
import { buildRaceWeekTemplate, weeklyTemplateFor } from "@/lib/coaching-engine/templates";
import type { MesocyclePhase } from "@/lib/coaching-engine/types";

const PHASES: MesocyclePhase[] = ["base", "build", "peak", "taper", "recovery"];
const DAYS_PER_WEEK = [3, 4, 5, 6];

describe("weeklyTemplateFor", () => {
  it("returns exactly daysPerWeek entries for every phase and day count", () => {
    for (const phase of PHASES) {
      for (const days of DAYS_PER_WEEK) {
        expect(weeklyTemplateFor(phase, days)).toHaveLength(days);
      }
    }
  });

  it("always includes exactly one long run", () => {
    for (const phase of PHASES) {
      for (const days of DAYS_PER_WEEK) {
        const longCount = weeklyTemplateFor(phase, days).filter((t) => t === "long").length;
        expect(longCount).toBe(1);
      }
    }
  });

  it("never schedules more than 2 quality (tempo/vo2) days, and only peak at 5-6 days/week goes to 2", () => {
    for (const phase of PHASES) {
      for (const days of DAYS_PER_WEEK) {
        const template = weeklyTemplateFor(phase, days);
        const qualityCount = template.filter((t) => t === "tempo" || t === "vo2").length;
        const expectsTwo = phase === "peak" && days >= 5;
        expect(qualityCount).toBeLessThanOrEqual(expectsTwo ? 2 : 1);
      }
    }
  });

  it("never schedules two quality days unless there are at least 5 running days", () => {
    // peak is the only phase whose template ever combines tempo + vo2 in
    // the same week -- confirm it only does so at 5-6 days/week.
    expect(weeklyTemplateFor("peak", 3).includes("tempo")).toBe(false);
    expect(weeklyTemplateFor("peak", 4).includes("tempo")).toBe(false);
    expect(weeklyTemplateFor("peak", 5)).toEqual(expect.arrayContaining(["tempo", "vo2"]));
    expect(weeklyTemplateFor("peak", 6)).toEqual(expect.arrayContaining(["tempo", "vo2"]));
  });

  it("never emits a strength workout in v1", () => {
    for (const phase of PHASES) {
      for (const days of DAYS_PER_WEEK) {
        expect(weeklyTemplateFor(phase, days)).not.toContain("strength");
      }
    }
  });

  it("clamps out-of-range day counts instead of throwing", () => {
    expect(weeklyTemplateFor("base", 1)).toHaveLength(3);
    expect(weeklyTemplateFor("base", 7)).toHaveLength(6);
  });

  it("gives recovery weeks no quality day at all", () => {
    for (const days of DAYS_PER_WEEK) {
      const template = weeklyTemplateFor("recovery", days);
      expect(template.some((t) => t === "tempo" || t === "vo2")).toBe(false);
    }
  });
});

describe("buildRaceWeekTemplate", () => {
  it("includes exactly one race day and fills the rest with recovery", () => {
    for (const days of DAYS_PER_WEEK) {
      const template = buildRaceWeekTemplate(days);
      expect(template).toHaveLength(days);
      expect(template.filter((t) => t === "race")).toHaveLength(1);
      expect(template.filter((t) => t === "recovery")).toHaveLength(days - 1);
    }
  });

  it("puts the race on the first slot, matching scheduling's anchor assumption", () => {
    expect(buildRaceWeekTemplate(5)[0]).toBe("race");
  });
});
