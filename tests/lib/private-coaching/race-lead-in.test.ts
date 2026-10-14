import { describe, it, expect } from "vitest";
import {
  RACE_LEAD_IN_DEFAULT,
  buildRaceLeadInSeed,
  daysBeforeRaceForSlot,
  RACE_LEAD_IN_LENGTH_DAYS,
  leadInTemplateSlot,
  raceLeadInDates,
} from "@/lib/private-coaching/race-lead-in";

describe("RACE_LEAD_IN_DEFAULT", () => {
  it("covers exactly the fourteen days up to and including race day", () => {
    expect(RACE_LEAD_IN_DEFAULT).toHaveLength(RACE_LEAD_IN_LENGTH_DAYS);
    const offsets = RACE_LEAD_IN_DEFAULT.map((d) => d.daysBeforeRace);
    expect(offsets).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("marks exactly one race day, on the final day", () => {
    const raceDays = RACE_LEAD_IN_DEFAULT.filter((d) => d.isRaceDay);
    expect(raceDays).toHaveLength(1);
    expect(raceDays[0].daysBeforeRace).toBe(0);
    expect(raceDays[0].difficulty).toBe("10/10");
  });

  it("follows the intended shape: one last full marathon-pace session about two weeks out", () => {
    const last = RACE_LEAD_IN_DEFAULT.find((d) => d.daysBeforeRace === 13)!;
    expect(last.prescription).toMatch(/100% MP/);
    expect(last.difficulty).toBe("8.5/10");
  });

  it("puts a reduced-volume tune-up eight to eleven days out, with faster float recoveries", () => {
    const tuneUp = RACE_LEAD_IN_DEFAULT.filter((d) => /105% MP/.test(d.prescription) && d.daysBeforeRace >= 8 && d.daysBeforeRace <= 11);
    expect(tuneUp).toHaveLength(1);
    // Floats faster than the 90% MP a mid-buildup version of this session
    // would use.
    expect(tuneUp[0].prescription).toMatch(/94-96% MP/);
  });

  it("leaves three to five genuinely easy days between the big session and the tune-up", () => {
    const between = RACE_LEAD_IN_DEFAULT.filter((d) => d.daysBeforeRace > 8 && d.daysBeforeRace < 13);
    expect(between.length).toBeGreaterThanOrEqual(3);
    expect(between.length).toBeLessThanOrEqual(5);
    // None of them is a workout.
    expect(between.every((d) => d.difficulty === null)).toBe(true);
  });

  it("has one or two light regenerative sessions at 103-110% MP in the final week", () => {
    const finalWeek = RACE_LEAD_IN_DEFAULT.filter((d) => d.daysBeforeRace < 7 && !d.isRaceDay);
    const sessions = finalWeek.filter((d) => d.difficulty !== null);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.length).toBeLessThanOrEqual(2);
    for (const session of sessions) {
      expect(session.prescription).toMatch(/10[3-9]|110/);
      // "Light" means light: nothing in race week should read as hard.
      expect(Number.parseFloat(session.difficulty!)).toBeLessThanOrEqual(7);
    }
  });

  it("never prescribes a hard session inside the last three days", () => {
    const final = RACE_LEAD_IN_DEFAULT.filter((d) => d.daysBeforeRace <= 3 && !d.isRaceDay);
    expect(final.every((d) => d.difficulty === null)).toBe(true);
  });

  it("gives every day a real prescription", () => {
    for (const day of RACE_LEAD_IN_DEFAULT) {
      expect(day.prescription.trim().length).toBeGreaterThan(0);
      expect(day.dayLabel.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("raceLeadInDates", () => {
  it("maps the lead-in onto the fourteen dates ending on race day, oldest first", () => {
    const mapped = raceLeadInDates("2027-04-18", RACE_LEAD_IN_DEFAULT);
    expect(mapped).toHaveLength(14);
    expect(mapped[0].date).toBe("2027-04-05");
    expect(mapped[13].date).toBe("2027-04-18");
    expect(mapped[13].day.isRaceDay).toBe(true);
    // Strictly ascending, no gaps or repeats.
    for (let i = 1; i < mapped.length; i += 1) {
      const prev = new Date(`${mapped[i - 1].date}T00:00:00Z`).getTime();
      const curr = new Date(`${mapped[i].date}T00:00:00Z`).getTime();
      expect(curr - prev).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("crosses a month boundary correctly", () => {
    const mapped = raceLeadInDates("2027-03-07", RACE_LEAD_IN_DEFAULT);
    expect(mapped[0].date).toBe("2027-02-22");
    expect(mapped[13].date).toBe("2027-03-07");
  });

  it("crosses a year boundary correctly", () => {
    const mapped = raceLeadInDates("2027-01-10", RACE_LEAD_IN_DEFAULT);
    expect(mapped[0].date).toBe("2026-12-28");
  });

  it("is unaffected by a spring-forward DST boundary", () => {
    // US DST begins 2027-03-14. Calendar dates must not shift.
    const mapped = raceLeadInDates("2027-03-21", RACE_LEAD_IN_DEFAULT);
    expect(mapped[0].date).toBe("2027-03-08");
    expect(mapped.map((m) => m.date)).toContain("2027-03-14");
    expect(mapped[13].date).toBe("2027-03-21");
  });

  it("refuses an invalid race date rather than producing nonsense dates", () => {
    expect(() => raceLeadInDates("not-a-date", RACE_LEAD_IN_DEFAULT)).toThrow(/Invalid race date/);
  });
});

describe("leadInTemplateSlot", () => {
  it("lays the fourteen days out as two weeks of seven, race day last", () => {
    expect(leadInTemplateSlot(13)).toEqual({ weekNumber: 1, dayOfWeek: 1 });
    expect(leadInTemplateSlot(7)).toEqual({ weekNumber: 1, dayOfWeek: 7 });
    expect(leadInTemplateSlot(6)).toEqual({ weekNumber: 2, dayOfWeek: 1 });
    expect(leadInTemplateSlot(0)).toEqual({ weekNumber: 2, dayOfWeek: 7 });
  });

  it("assigns every default day a distinct slot", () => {
    const slots = RACE_LEAD_IN_DEFAULT.map((d) => {
      const slot = leadInTemplateSlot(d.daysBeforeRace);
      return `${slot.weekNumber}:${slot.dayOfWeek}`;
    });
    expect(new Set(slots).size).toBe(RACE_LEAD_IN_LENGTH_DAYS);
  });

  it("rejects an out-of-range offset", () => {
    expect(() => leadInTemplateSlot(14)).toThrow(/out of range/);
    expect(() => leadInTemplateSlot(-1)).toThrow(/out of range/);
  });
});

describe("buildRaceLeadInSeed", () => {
  const plan = buildRaceLeadInSeed();

  it("is a two-week, single-phase program with all fourteen days", () => {
    expect(plan.program.frameworkKey).toBe("race-lead-in");
    expect(plan.program.name).toBe("Standard race lead-in");
    expect(plan.durationVariantName).toBe("2-Week");
    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].durationWeeksMin).toBe(2);
    expect(plan.phases[0].durationWeeksMax).toBe(2);
    expect(plan.days).toHaveLength(14);
    expect(plan.phaseWeeks).toHaveLength(2);
  });

  it("prescribes no weekly mileage total, rather than inventing one", () => {
    expect(plan.volumeVariants).toEqual([]);
    expect(plan.phaseWeekVolumes).toEqual([]);
    expect(plan.program.peakMileageMin).toBeNull();
  });

  it("marks exactly one event day, as the template's final day", () => {
    const eventDays = plan.days.filter((d) => d.isEventDay);
    expect(eventDays).toHaveLength(1);
    expect(eventDays[0]).toMatchObject({ weekNumber: 2, dayOfWeek: 7 });
  });

  it("fills every one of the fourteen slots exactly once, single sessions only", () => {
    const slots = plan.days.map((d) => `${d.weekNumber}:${d.dayOfWeek}`);
    expect(new Set(slots).size).toBe(14);
    expect(plan.days.every((d) => d.sessionSlot === null)).toBe(true);
    expect(plan.days.every((d) => !d.isOptional && d.alternativeText === null)).toBe(true);
  });

  it("carries the difficulty ratings through as the frameworks do", () => {
    const race = plan.days.find((d) => d.isEventDay)!;
    expect(race.difficultyLabel).toBe("10/10");
    expect(race.plannedRpe).toBe(10);
    // The 8.5/10 marathon-pace session widens to the 8..9 integer envelope.
    const big = plan.days.find((d) => d.difficultyLabel === "8.5/10")!;
    expect(big.plannedRpe).toBe(8);
    expect(big.plannedRpeMax).toBe(9);
  });

  it("tells the coach the template itself is the thing to edit", () => {
    expect(plan.program.description).toMatch(/Edit this template to change the standard/);
  });
});

describe("daysBeforeRaceForSlot", () => {
  it("inverts leadInTemplateSlot for every slot in the template", () => {
    for (let week = 1; week <= 2; week += 1) {
      for (let dow = 1; dow <= 7; dow += 1) {
        const offset = daysBeforeRaceForSlot(week, dow);
        expect(leadInTemplateSlot(offset)).toEqual({ weekNumber: week, dayOfWeek: dow });
      }
    }
  });

  it("puts the template's last slot on race day", () => {
    expect(daysBeforeRaceForSlot(2, 7)).toBe(0);
    expect(daysBeforeRaceForSlot(1, 1)).toBe(13);
  });

  it("rejects a slot outside a two-week template", () => {
    expect(() => daysBeforeRaceForSlot(3, 1)).toThrow(/out of range/);
    expect(() => daysBeforeRaceForSlot(1, 8)).toThrow(/out of range/);
    expect(() => daysBeforeRaceForSlot(0, 1)).toThrow(/out of range/);
  });
});
