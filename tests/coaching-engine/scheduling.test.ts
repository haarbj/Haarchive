import { describe, expect, it } from "vitest";
import { scheduleCalendar } from "@/lib/coaching-engine/scheduling";
import { dayOfWeek, diffDays } from "@/lib/coaching-engine/date-utils";
import { allocateMesocycles, buildWeeklyPhaseSequence } from "@/lib/coaching-engine/periodization";

const PLAN_START = "2026-07-08"; // a Wednesday
const GOAL_DATE = "2026-10-25"; // arbitrary marathon date, ~16 weeks out
const DAYS_PER_WEEK = [3, 4, 5, 6];

// Mirrors exactly how plan-generator.ts derives totalWeeks from
// planStartDate/goalDate, so these fixtures stay internally consistent with
// what scheduleCalendar actually assumes (that the final week's window
// contains goalDate).
function weeksFor(distanceM: number) {
  const totalWeeks = Math.floor(diffDays(PLAN_START, GOAL_DATE) / 7) + 1;
  return buildWeeklyPhaseSequence(allocateMesocycles(totalWeeks, distanceM));
}

describe("scheduleCalendar", () => {
  it("lands the race exactly on goal day", () => {
    const weeks = weeksFor(42195);
    for (const daysPerWeek of DAYS_PER_WEEK) {
      const slots = scheduleCalendar(weeks, PLAN_START, GOAL_DATE, daysPerWeek);
      const race = slots.find((s) => s.workoutType === "race");
      expect(race?.date).toBe(GOAL_DATE);
    }
  });

  it("anchors every non-final week's long run to goal day's weekday", () => {
    const weeks = weeksFor(42195);
    const slots = scheduleCalendar(weeks, PLAN_START, GOAL_DATE, 5);
    const goalWeekday = dayOfWeek(GOAL_DATE);

    const longRuns = slots.filter((s) => s.workoutType === "long");
    expect(longRuns.length).toBe(weeks.length - 1); // every week except the final race week
    for (const run of longRuns) {
      expect(dayOfWeek(run.date)).toBe(goalWeekday);
    }
  });

  it("never schedules two workouts on the same date", () => {
    const weeks = weeksFor(21097);
    for (const daysPerWeek of DAYS_PER_WEEK) {
      const slots = scheduleCalendar(weeks, PLAN_START, GOAL_DATE, daysPerWeek);
      const dates = slots.map((s) => s.date);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });

  it("produces exactly daysPerWeek workouts for every week", () => {
    const weeks = weeksFor(42195);
    for (const daysPerWeek of DAYS_PER_WEEK) {
      const slots = scheduleCalendar(weeks, PLAN_START, GOAL_DATE, daysPerWeek);
      for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
        expect(slots.filter((s) => s.weekIndex === weekIndex)).toHaveLength(daysPerWeek);
      }
    }
  });

  it("keeps every scheduled date within that week's own 7-day window", () => {
    const weeks = weeksFor(42195);
    const slots = scheduleCalendar(weeks, PLAN_START, GOAL_DATE, 6);
    for (const slot of slots) {
      const dayOffset = diffDays(PLAN_START, slot.date);
      expect(Math.floor(dayOffset / 7)).toBe(slot.weekIndex);
    }
  });

  it("returns slots sorted by date", () => {
    const weeks = weeksFor(42195);
    const slots = scheduleCalendar(weeks, PLAN_START, GOAL_DATE, 5);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].date >= slots[i - 1].date).toBe(true);
    }
  });
});
