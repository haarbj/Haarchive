import type { MesocyclePhase, WorkoutType } from "@/lib/coaching-engine/types";

export type RunningDaysPerWeek = 3 | 4 | 5 | 6;

// Each template lists exactly `daysPerWeek` entries, with exactly one
// "long" (the week's anchor day) and at most one tempo/vo2 "quality" day --
// scheduling.ts depends on both of those invariants to place workouts on
// specific dates. No template ever emits two hard (tempo/vo2) days unless
// there are at least 5 running days that week to absorb the load, and
// `strength` never appears -- nothing collects strength_days_per_week yet
// (see athlete_profiles), so there's no signal to schedule it from.
const WEEKLY_TEMPLATES: Record<MesocyclePhase, Record<RunningDaysPerWeek, WorkoutType[]>> = {
  base: {
    3: ["long", "easy", "easy"],
    4: ["long", "easy", "easy", "easy"],
    5: ["long", "easy", "easy", "easy", "easy"],
    6: ["long", "easy", "easy", "easy", "easy", "easy"],
  },
  build: {
    3: ["long", "tempo", "easy"],
    4: ["long", "tempo", "easy", "easy"],
    5: ["long", "tempo", "easy", "easy", "easy"],
    6: ["long", "tempo", "easy", "easy", "easy", "easy"],
  },
  peak: {
    3: ["long", "vo2", "easy"],
    4: ["long", "vo2", "easy", "easy"],
    5: ["long", "vo2", "tempo", "easy", "easy"],
    6: ["long", "vo2", "tempo", "easy", "easy", "easy"],
  },
  taper: {
    3: ["long", "easy", "easy"],
    4: ["long", "tempo", "easy", "easy"],
    5: ["long", "tempo", "easy", "easy", "easy"],
    6: ["long", "tempo", "easy", "easy", "easy", "easy"],
  },
  recovery: {
    3: ["long", "easy", "easy"],
    4: ["long", "easy", "recovery", "easy"],
    5: ["long", "easy", "recovery", "easy", "easy"],
    6: ["long", "easy", "recovery", "easy", "recovery", "easy"],
  },
};

function clampDaysPerWeek(daysPerWeek: number): RunningDaysPerWeek {
  const clamped = Math.min(6, Math.max(3, Math.round(daysPerWeek)));
  return clamped as RunningDaysPerWeek;
}

export function weeklyTemplateFor(phase: MesocyclePhase, daysPerWeek: number): WorkoutType[] {
  return WEEKLY_TEMPLATES[phase][clampDaysPerWeek(daysPerWeek)];
}

// The plan's final week always overrides whatever phase it nominally falls
// in: short easy/shakeout days culminating in exactly one race-day effort,
// anchored on goal day the same way every other week anchors its long run.
export function buildRaceWeekTemplate(daysPerWeek: number): WorkoutType[] {
  const days = clampDaysPerWeek(daysPerWeek);
  return ["race", ...Array<WorkoutType>(days - 1).fill("recovery")];
}
