// Fueling plans attached to workouts: a pure adapter from a scheduled
// workout's own already-resolved fields to the existing Fueling
// Planner's engine inputs, and back to a display-ready card. No new
// model, no new storage -- every number here is produced by
// endurance-fueling-math.ts / fueling-products.ts, exactly as the
// Fueling Planner itself (training-run mode) already calls them. This
// module only decides WHICH workouts get a card, and HOW a workout's own
// fields (type, RPE, distance, duration, resolved pace, the athlete's
// weight if known) map onto that engine's real inputs.
//
// Deliberately NOT built on fueling-oversight.ts -- that module is a
// narrower, coach-only plan-health check (under-fueling awareness, the
// gut-training plan-health check, the ferritin check), a different
// concern entirely from "what should this workout's fueling plan be."

import type { GiTrainingLevel, HeartRateZone } from "@/lib/endurance-fueling-math";
import { fluidTargetMlPerHour, sodiumTargetMgPerHour } from "@/lib/endurance-fueling-math";
import { resolveCarbTargetGPerHour } from "@/lib/fueling-calculator-math";
import {
  FUEL_PRODUCTS,
  GENERIC_PRODUCTS,
  generateFuelingSchedule,
  totalsForSchedule,
  type FuelProduct,
  type ScheduleEntry,
} from "@/lib/fueling-products";
import { durationSFromDistancePace } from "@/lib/private-coaching/workout-distance";
import { MILE_METERS } from "@/lib/race-distances";
import type { WorkoutType } from "@/lib/coaching-engine";

// ---------------------------------------------------------------------------
// Eligibility -- the one place this rule lives.
// ---------------------------------------------------------------------------

// Checked directly: endurance-fueling-math.ts, fueling-calculator-math.ts,
// fueling-products.ts, and fueling-schedule-core.ts (the gel/caffeine
// timing core both tools share) define no general "fueling applies
// below this duration" threshold -- the closest thing is
// caffeineTiming's own ~105-minute cutoff for whether a SECOND caffeine
// dose still has time to help, a narrower question than "does this
// workout need a fueling plan at all." The Fueling Calculator's own UI
// has no duration gate either -- a user can ask it about a 20-minute
// run and get a (possibly trivial) answer. So this 75-minute threshold
// is this feature's own fallback, not an engine-defined value.
export const FUELING_DURATION_THRESHOLD_MINUTES = 75;

export function isWorkoutFuelingEligible(durationMinutes: number | null): boolean {
  return durationMinutes != null && durationMinutes >= FUELING_DURATION_THRESHOLD_MINUTES;
}

// ---------------------------------------------------------------------------
// Duration resolution -- stored duration wins; otherwise derive from
// distance and the workout's own already-resolved pace, exactly the
// distance/duration/pace relationship workout-distance.ts's
// durationSFromDistancePace already encodes (the same function
// weekly-load.ts already uses for this exact derivation, just applied
// here to one workout instead of a week's totals). Never invents a pace
// -- a workout with distance but no resolvable pace at all simply has no
// derivable duration, and this function says so (null) rather than
// guessing.
// ---------------------------------------------------------------------------

export type WorkoutDurationInput = {
  distanceM: number | null;
  durationS: number | null;
  /** The workout's own already-resolved pace (literal, pace_reference, or pace_percent -- whichever applies), in seconds/mile. Resolve once, at the call site, the same way the workout detail page already does for display. */
  paceSPerMi: number | null;
};

export function resolveWorkoutDurationMinutes(input: WorkoutDurationInput): number | null {
  if (input.durationS != null) return input.durationS / 60;
  if (input.distanceM != null && input.paceSPerMi != null) {
    return durationSFromDistancePace(input.distanceM, input.paceSPerMi) / 60;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Effort -> heart-rate zone. The Fueling Planner's carb/fluid/sodium
// model is keyed on a 5-band HR zone (endurance-fueling-math.ts), which
// this platform's workouts don't store directly -- planned_rpe is the
// real signal every workout already carries (plan-health.ts,
// completion-comparison.ts, isBigSession all key off it the same way),
// so RPE is the primary mapping; workout_type is only a fallback for the
// rarer case of a workout with no RPE set at all.
// ---------------------------------------------------------------------------

function zoneFromRpe(rpe: number): HeartRateZone {
  if (rpe <= 3) return "50-60%";
  if (rpe <= 5) return "60-70%";
  if (rpe <= 7) return "70-80%";
  if (rpe <= 9) return "80-90%";
  return "90-100%";
}

function zoneFromWorkoutType(workoutType: WorkoutType | null): HeartRateZone {
  switch (workoutType) {
    case "recovery":
      return "50-60%";
    case "vo2":
      return "90-100%";
    case "tempo":
    case "race":
      return "70-80%";
    case "easy":
    case "long":
    case "strength":
    default:
      // "60-70%" is also the Fueling Planner's own persisted UI default
      // (fueling-calculator.tsx) -- the same fallback a coach would land
      // on by not touching the zone picker at all.
      return "60-70%";
  }
}

export function heartRateZoneForWorkout(workoutType: WorkoutType | null, plannedRpe: number | null, plannedRpeMax: number | null): HeartRateZone {
  const rpe = plannedRpeMax ?? plannedRpe;
  return rpe != null ? zoneFromRpe(rpe) : zoneFromWorkoutType(workoutType);
}

// ---------------------------------------------------------------------------
// The card itself.
// ---------------------------------------------------------------------------

// The Fueling Planner's own defaults, exactly as fueling-calculator.tsx
// pre-fills them -- never a fabricated, workout-specific guess:
//   - product: "gel-gu" (GU Energy Gel) is the form's own default
//     selection before a user ever touches the product picker.
//   - GI training level: "Moderate" is the form's own default -- there is
//     no athlete-level GI-training-preference store to read instead (a
//     real preference store is explicitly v2, not invented here).
//   - temperature: 15°C is the form's own default ambient-temperature
//     input value.
//   - weight: 150lb is the form's own fallback (weightKgOrDefault) for
//     when no weight is entered -- used here only when athlete_profiles
//     has none on file, never a fabricated athlete-specific number.
const DEFAULT_PRODUCT_ID = "gel-gu";
const DEFAULT_GI_TRAINING: GiTrainingLevel = "Moderate";
const DEFAULT_TEMP_C = 15;
const KG_PER_LB = 0.453592;
const DEFAULT_WEIGHT_KG = 150 * KG_PER_LB;

function defaultProduct(): FuelProduct {
  return FUEL_PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT_ID) ?? GENERIC_PRODUCTS[0];
}

export type WorkoutFuelingInput = {
  workoutType: WorkoutType | null;
  dayLabel: string | null;
  title: string | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  distanceM: number | null;
  durationS: number | null;
  paceSPerMi: number | null;
  /** athlete_profiles.weight_kg -- null degrades to the engine's own default, never fabricated. */
  weightKg: number | null;
};

export type WorkoutFuelingCard = {
  label: string;
  distanceM: number | null;
  durationMinutes: number;
  carbsPerHourGPerHour: number;
  totalCarbsG: number;
  fluidPerHourMl: number;
  sodiumPerHourMg: number;
  schedule: ScheduleEntry[];
  product: FuelProduct;
  weightSource: "athlete" | "default";
};

/**
 * Null when the workout isn't eligible (see isWorkoutFuelingEligible) --
 * callers render nothing for a short easy run or strides session, not an
 * empty card. Every number on a non-null result traces straight back to
 * endurance-fueling-math.ts / fueling-products.ts; this function only
 * ever arranges which workout fields feed them.
 *
 * Fluid-loss (vs. fluid-TARGET) is deliberately never surfaced here --
 * the card asks "what should I drink," which is fluidTargetMlPerHour,
 * the same target/loss distinction the Fueling Planner's own UI draws
 * (see endurance-fueling-math.ts's header comment).
 */
export function buildWorkoutFuelingCard(input: WorkoutFuelingInput): WorkoutFuelingCard | null {
  const durationMinutes = resolveWorkoutDurationMinutes({ distanceM: input.distanceM, durationS: input.durationS, paceSPerMi: input.paceSPerMi });
  if (!isWorkoutFuelingEligible(durationMinutes)) return null;

  const zone = heartRateZoneForWorkout(input.workoutType, input.plannedRpe, input.plannedRpeMax);
  const carbsPerHourGPerHour = resolveCarbTargetGPerHour(zone, DEFAULT_GI_TRAINING, null);
  const fluidPerHourMl = fluidTargetMlPerHour(DEFAULT_TEMP_C);
  const sodiumPerHourMg = sodiumTargetMgPerHour(DEFAULT_TEMP_C);

  const weightKg = input.weightKg ?? DEFAULT_WEIGHT_KG;
  const product = defaultProduct();

  const schedule = generateFuelingSchedule(durationMinutes!, carbsPerHourGPerHour, fluidPerHourMl, sodiumPerHourMg, product, {
    useCaffeine: true, // gated by the engine's own caffeineTiming cutoff inside generateFuelingSchedule -- a short-enough session simply gets no caffeine note, never a nonsensical one.
    bodyWeightKg: weightKg,
    catalog: FUEL_PRODUCTS,
  });
  const totals = totalsForSchedule(schedule);

  return {
    label: input.dayLabel ?? input.title ?? "Workout",
    distanceM: input.distanceM,
    durationMinutes: durationMinutes!,
    carbsPerHourGPerHour,
    totalCarbsG: totals.carbsG,
    fluidPerHourMl,
    sodiumPerHourMg,
    schedule,
    product,
    weightSource: input.weightKg != null ? "athlete" : "default",
  };
}

export function formatHoursMinutes(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatMilesLabel(distanceM: number | null): string | null {
  if (distanceM == null) return null;
  const miles = distanceM / MILE_METERS;
  return `${miles % 1 === 0 ? miles.toFixed(0) : miles.toFixed(1)} mi`;
}
