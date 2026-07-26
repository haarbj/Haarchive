// Carbohydrate/fluid/sodium targets and a mile-by-mile reminder schedule,
// derived from goal duration, runner size, and heat -- not a new model,
// just applying widely-published sports-nutrition guidance (ACSM/ISSN
// position stands on carbohydrate intake during exercise; commonly cited
// fluid/sodium ranges from the same body of consensus guidance, not one
// narrow study) on top of what the rest of this pipeline already computes.

export type FuelingTargets = {
  carbGramsPerHour: number;
  fluidMlPerHour: number;
  sodiumMgPerHour: number;
  /** Whether a caffeine dose in the race's final third is worth suggesting -- efforts under ~3h get little benefit weighed against a first-time GI risk. */
  caffeineRecommended: boolean;
};

export type FuelReminder = {
  atMile: number;
  carbGrams: number;
  fluidMl: number;
  sodiumMg: number;
  note: string;
};

export type FuelingScheduleInput = {
  goalTimeSeconds: number;
  weightKg?: number;
  tempC?: number;
};

const DEFAULT_WEIGHT_KG = 70;
const REFERENCE_WEIGHT_KG = 70; // fluid/sodium targets below are calibrated to a 70kg runner, then scaled

// ACSM/ISSN-consistent carbohydrate tiers by effort duration.
const CARB_G_PER_HOUR_SHORT = 0; // < 1h: not needed for fueling purposes
const CARB_G_PER_HOUR_MODERATE = 45; // 1-2.5h: 30-60 g/hr guidance, midpoint
const CARB_G_PER_HOUR_LONG = 75; // > 2.5h: up to ~90 g/hr with multiple transportable carb sources, kept moderate as a default
const SHORT_DURATION_SECONDS = 3600;
const LONG_DURATION_SECONDS = 2.5 * 3600;

const FLUID_ML_PER_HOUR_BASE = 500; // commonly cited 400-800 mL/hr range, midpoint for a 70kg runner in neutral conditions
const FLUID_ML_PER_HOUR_PER_DEGREE_ABOVE_15C = 12; // scales up in heat

const SODIUM_MG_PER_HOUR_BASE = 400; // commonly cited 300-700 mg/hr range, midpoint
const SODIUM_MG_PER_HOUR_PER_DEGREE_ABOVE_15C = 8;

const CAFFEINE_MIN_DURATION_SECONDS = 3 * 3600;
const CAFFEINE_RACE_FRACTION = 2 / 3;

const REMINDER_INTERVAL_MINUTES = 20; // roughly matches typical gel/aid-station cadence, not a sip-every-mile schedule
const REFERENCE_TEMP_C = 15;

function carbGramsPerHourFor(goalTimeSeconds: number): number {
  if (goalTimeSeconds < SHORT_DURATION_SECONDS) return CARB_G_PER_HOUR_SHORT;
  if (goalTimeSeconds < LONG_DURATION_SECONDS) return CARB_G_PER_HOUR_MODERATE;
  return CARB_G_PER_HOUR_LONG;
}

export function computeFuelingTargets(input: FuelingScheduleInput): FuelingTargets {
  const weightKg = input.weightKg ?? DEFAULT_WEIGHT_KG;
  const weightScale = weightKg / REFERENCE_WEIGHT_KG;
  const heatDegreesAboveReference = Math.max(0, (input.tempC ?? REFERENCE_TEMP_C) - REFERENCE_TEMP_C);

  return {
    carbGramsPerHour: carbGramsPerHourFor(input.goalTimeSeconds),
    fluidMlPerHour: (FLUID_ML_PER_HOUR_BASE + heatDegreesAboveReference * FLUID_ML_PER_HOUR_PER_DEGREE_ABOVE_15C) * weightScale,
    sodiumMgPerHour: SODIUM_MG_PER_HOUR_BASE + heatDegreesAboveReference * SODIUM_MG_PER_HOUR_PER_DEGREE_ABOVE_15C,
    caffeineRecommended: input.goalTimeSeconds >= CAFFEINE_MIN_DURATION_SECONDS,
  };
}

export type MileForFueling = { mile: number; paceSecPerMile: number };

/**
 * Bundles the continuous g/hr, mL/hr, mg/hr targets into discrete reminders
 * at roughly REMINDER_INTERVAL_MINUTES spacing -- real fueling happens at
 * gels/aid stations, not a constant drip, so this accumulates targets
 * across however many miles fall in each interval and reports the dose due
 * at the mile where that interval closes.
 */
export function buildFuelingSchedule(splits: MileForFueling[], targets: FuelingTargets, goalTimeSeconds: number): FuelReminder[] {
  const intervalSeconds = REMINDER_INTERVAL_MINUTES * 60;
  const reminders: FuelReminder[] = [];

  let elapsedSinceLastReminderSeconds = 0;
  let cumulativeElapsedSeconds = 0;

  for (const split of splits) {
    elapsedSinceLastReminderSeconds += split.paceSecPerMile;
    cumulativeElapsedSeconds += split.paceSecPerMile;

    if (elapsedSinceLastReminderSeconds >= intervalSeconds) {
      const hours = elapsedSinceLastReminderSeconds / 3600;
      reminders.push({
        atMile: split.mile,
        carbGrams: Math.round(targets.carbGramsPerHour * hours),
        fluidMl: Math.round(targets.fluidMlPerHour * hours),
        sodiumMg: Math.round(targets.sodiumMgPerHour * hours),
        note:
          targets.caffeineRecommended && cumulativeElapsedSeconds / goalTimeSeconds >= CAFFEINE_RACE_FRACTION
            ? "Consider caffeine with this dose if you've trained with it."
            : "",
      });
      elapsedSinceLastReminderSeconds = 0;
    }
  }

  return reminders;
}
