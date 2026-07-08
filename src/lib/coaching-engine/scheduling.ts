import { addDays, dayOfWeek } from "@/lib/coaching-engine/date-utils";
import { buildRaceWeekTemplate, weeklyTemplateFor } from "@/lib/coaching-engine/templates";
import type { WeekPlan, WorkoutType } from "@/lib/coaching-engine/types";

export type ScheduledSlot = {
  weekIndex: number;
  date: string;
  workoutType: WorkoutType;
};

// Spreads `count` picks as evenly as possible across an ascending, already-
// sorted list of candidate offsets -- used to place easy/recovery filler
// days across whatever slots the long run and quality day didn't claim.
function pickEvenlySpaced(candidates: number[], count: number): number[] {
  if (count >= candidates.length) return candidates;
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(candidates[Math.floor((i * candidates.length) / count)]);
  }
  return picked;
}

// Assigns calendar dates to a plan's weekly workout-type templates. The
// long run (or, in the final week, the race itself) is always anchored to
// goalDate's weekday -- every week is a rolling 7-day block starting from
// planStartDate, so that weekday recurs at the same in-week offset every
// single week, and lands exactly on goalDate itself in the final week by
// construction (both are just `daysFromStart mod 7`). The quality day
// (tempo/vo2), when a phase's template has one, sits 3 days before that
// anchor; everything else fills the remaining offsets.
export function scheduleCalendar(
  weeks: WeekPlan[],
  planStartDate: string,
  goalDate: string,
  daysPerWeek: number,
): ScheduledSlot[] {
  const longOffset = (((dayOfWeek(goalDate) - dayOfWeek(planStartDate)) % 7) + 7) % 7;
  const qualityOffset = (((longOffset - 3) % 7) + 7) % 7;

  const slots: ScheduledSlot[] = [];

  weeks.forEach((week, weekIndex) => {
    const isFinalWeek = weekIndex === weeks.length - 1;
    const template = isFinalWeek
      ? buildRaceWeekTemplate(daysPerWeek)
      : weeklyTemplateFor(week.phase, daysPerWeek);

    const anchorType: WorkoutType = isFinalWeek ? "race" : "long";
    const qualityType = template.find((t) => t === "tempo" || t === "vo2");

    const usedOffsets = new Set<number>([longOffset]);
    if (qualityType) usedOffsets.add(qualityOffset);

    const fillerTypes = template.filter((t) => t !== anchorType && t !== qualityType);
    const candidateOffsets = Array.from({ length: 7 }, (_, offset) => offset).filter(
      (offset) => !usedOffsets.has(offset),
    );
    const fillerOffsets = pickEvenlySpaced(candidateOffsets, fillerTypes.length);

    const weekStartOffset = weekIndex * 7;
    slots.push({
      weekIndex,
      date: addDays(planStartDate, weekStartOffset + longOffset),
      workoutType: anchorType,
    });
    if (qualityType) {
      slots.push({
        weekIndex,
        date: addDays(planStartDate, weekStartOffset + qualityOffset),
        workoutType: qualityType,
      });
    }
    fillerTypes.forEach((workoutType, i) => {
      slots.push({
        weekIndex,
        date: addDays(planStartDate, weekStartOffset + fillerOffsets[i]),
        workoutType,
      });
    });
  });

  return slots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
