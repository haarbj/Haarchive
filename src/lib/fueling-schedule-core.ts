// The shared "which gel is due at which minute, and when does caffeine
// timing make sense" core -- the single source of truth for gel-timing
// and caffeine-timing logic, consumed by both the Race Pace Planner
// (race-pace-planner/fueling-plan.ts, which adds a mile-of-the-race label
// on top of this) and the Fueling Calculator (fueling-calculator-math.ts,
// which has no course/mile data at all, just a goal duration). Extracted
// here specifically so a change to the cadence/cutoff rules happens once,
// not twice.
//
// This is deliberately NOT a per-hour physiological target model -- that's
// endurance-fueling-math.ts/fueling-products.ts's job (HR-zone and GI-
// training-driven carb/fluid/sodium rates, a product catalog, a DIY-drink
// recipe). This module only ever answers "given a rate I've already
// decided on, which minute is the next gel due, and is there still time
// left for caffeine to help" -- pure scheduling arithmetic, not a fitted
// or sourced model.

const FINAL_GEL_CUTOFF_MINUTES_BEFORE_FINISH = 35; // no required gel scheduled closer to the finish than this -- it won't be digested in time to help
const OPTIONAL_GRACE_MINUTES = 15; // a gel that would otherwise fall inside the cutoff is kept, but marked optional, rather than dropped
const MOUTH_RINSE_CUTOFF_MINUTES_BEFORE_FINISH = 15; // inside this window, a carb mouth-rinse is worth suggesting instead of another gel
export const PRE_RACE_GEL_MINUTES_BEFORE_START = 35; // within the commonly-recommended 30-45 min window
export const CAFFEINE_SECOND_DOSE_AT_MINUTES = 45; // 30-60 min into the effort, per the two-dose protocol
const CAFFEINE_BLACKOUT_MINUTES_BEFORE_FINISH = 60; // no caffeine dose scheduled with less than this much time left -- it won't take effect in time to help

export type GelTimingInputs = {
  totalMinutes: number;
  carbGramsPerHour: number;
  gelCarbGrams: number;
};

export type GelTiming = {
  /** Minutes into the effort this gel is due. */
  atMinute: number;
  /** Set when this gel falls inside the no-more-gels window below -- kept rather than dropped, since being a few minutes early is a reasonable way to still get the dose in. */
  optional?: boolean;
};

/**
 * A flat-interval gel schedule: how long it takes to need another gel's
 * worth of carbs at the target rate (gelCarbGrams / carbGramsPerHour,
 * scaled to minutes), repeated until too close to the finish for another
 * gel to help. A higher carb rate or a smaller gel both mean more
 * frequent gels.
 */
export function buildGelTimingSchedule(inputs: GelTimingInputs): GelTiming[] {
  const gelIntervalMinutes = inputs.carbGramsPerHour > 0 ? (inputs.gelCarbGrams / inputs.carbGramsPerHour) * 60 : Infinity;
  if (!Number.isFinite(gelIntervalMinutes) || gelIntervalMinutes <= 0) return [];

  const gels: GelTiming[] = [];
  let nextGelMinute = gelIntervalMinutes;
  while (nextGelMinute < inputs.totalMinutes) {
    const minutesToFinish = inputs.totalMinutes - nextGelMinute;
    if (minutesToFinish < FINAL_GEL_CUTOFF_MINUTES_BEFORE_FINISH - OPTIONAL_GRACE_MINUTES) {
      // Too close to the finish for a gel to help even with the grace
      // window below -- stop scheduling more rather than cramming one in
      // right before the line.
      break;
    }
    gels.push({
      atMinute: Math.round(nextGelMinute),
      optional: minutesToFinish < FINAL_GEL_CUTOFF_MINUTES_BEFORE_FINISH,
    });
    nextGelMinute += gelIntervalMinutes;
  }
  return gels;
}

/**
 * The last ~15 minutes of any effort fall inside the window where
 * another gel wouldn't be digested in time to help at all -- a mouth
 * rinse (swish, don't swallow) still gives a real, smaller CNS-mediated
 * benefit in that stretch, which is why it's offered as its own distinct
 * suggestion rather than just silence after the last scheduled gel.
 */
export function mouthRinseRecommended(totalMinutes: number): boolean {
  return totalMinutes > MOUTH_RINSE_CUTOFF_MINUTES_BEFORE_FINISH;
}

export type CaffeineTiming = { secondDoseAtMinute: number } | null;

/**
 * When the second of a two-dose caffeine protocol can still land with
 * enough time left to help -- null when the effort is too short for
 * caffeine timing to make sense at all (there's no scenario where caffeine
 * is useful and this returns null for a real marathon-length effort; it
 * exists mainly so a much shorter duration doesn't get a nonsensical
 * "dose at 45 minutes" for a 50-minute effort).
 */
export function caffeineTiming(totalMinutes: number): CaffeineTiming {
  if (totalMinutes - CAFFEINE_SECOND_DOSE_AT_MINUTES < CAFFEINE_BLACKOUT_MINUTES_BEFORE_FINISH) return null;
  return { secondDoseAtMinute: CAFFEINE_SECOND_DOSE_AT_MINUTES };
}
