// A gel-by-gel fueling schedule tied to the pace plan's own elapsed-time
// clock, plus a two-dose caffeine protocol -- not a g/hr physiological
// target in isolation (that's the Endurance Fueling Calculator's job; see
// endurance-fueling-math.ts, which this deliberately doesn't duplicate).
// This module answers a narrower, race-day-specific question: "given a
// carb rate I've already decided on, which gel, at which minute of THIS
// race, and which mile does that fall near."
//
// The actual gel-interval and caffeine-timing arithmetic lives in
// fueling-schedule-core.ts, shared with the Fueling Calculator's own
// fueling-calculator-math.ts -- this module's own job is just to attach a
// mile label to each reminder, using this plan's own elapsed-time clock,
// which the shared core has no concept of.

import {
  buildGelTimingSchedule,
  caffeineTiming,
  mouthRinseRecommended,
  PRE_RACE_GEL_MINUTES_BEFORE_START,
} from "@/lib/fueling-schedule-core";
import type { RacePacePlan } from "@/lib/race-pace-planner/pace-plan";

const CAFFEINE_FIRST_DOSE_MG = 100;
const CAFFEINE_SECOND_DOSE_MG = 100;

export type FuelingInputs = {
  carbGramsPerHour: number;
  gelCarbGrams: number;
  caffeineEnabled: boolean;
};

export type GelReminder = {
  /** Minutes into the race this gel is due. */
  atMinute: number;
  /** The nearest mile this falls at, from the pace plan's own elapsed-time clock. */
  nearMile: number;
  note: string;
  optional?: boolean;
};

export type FuelingSchedule = {
  preRaceGel: { minutesBeforeStart: number };
  gels: GelReminder[];
  mouthRinseInsteadOfFinalGel: boolean;
  caffeine: { firstDoseMg: number; secondDoseMg: number; secondDoseAtMinute: number } | null;
};

function nearestMileForElapsedSeconds(plan: RacePacePlan, elapsedSeconds: number): number {
  let closest = plan.miles[0];
  for (const mile of plan.miles) {
    if (Math.abs(mile.elapsedSeconds - elapsedSeconds) < Math.abs(closest.elapsedSeconds - elapsedSeconds)) {
      closest = mile;
    }
  }
  return closest.mile;
}

export function buildFuelingSchedule(plan: RacePacePlan, inputs: FuelingInputs): FuelingSchedule {
  const totalMinutes = plan.totalElapsedSeconds / 60;

  const timing = inputs.caffeineEnabled ? caffeineTiming(totalMinutes) : null;

  return {
    preRaceGel: { minutesBeforeStart: PRE_RACE_GEL_MINUTES_BEFORE_START },
    gels: buildGelTimingSchedule({
      totalMinutes,
      carbGramsPerHour: inputs.carbGramsPerHour,
      gelCarbGrams: inputs.gelCarbGrams,
    }).map((gel) => ({
      atMinute: gel.atMinute,
      nearMile: nearestMileForElapsedSeconds(plan, gel.atMinute * 60),
      note: `~${inputs.gelCarbGrams}g carbs`,
      optional: gel.optional,
    })),
    mouthRinseInsteadOfFinalGel: mouthRinseRecommended(totalMinutes),
    caffeine: timing
      ? { firstDoseMg: CAFFEINE_FIRST_DOSE_MG, secondDoseMg: CAFFEINE_SECOND_DOSE_MG, secondDoseAtMinute: timing.secondDoseAtMinute }
      : null,
  };
}
