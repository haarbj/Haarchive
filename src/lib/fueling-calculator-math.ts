// The "what are my numbers" fueling math behind the Fueling Calculator --
// carb-rate target and gut-training progression, carb-loading and
// pre-race breakfast gram targets, and a caffeine dose, all derived from
// goal duration and body weight alone. Deliberately NOT a from-scratch
// reimplementation of the site's other fueling math: gel/drink timing
// reuses fueling-schedule-core.ts (the same module the Race Pace Planner
// builds its own fueling schedule from), and the caffeine dose itself
// reuses fueling-products.ts's own caffeinePreloadDoseMg (already a real,
// cited 3mg/kg ACSM/ISSN-consistent figure) rather than inventing a
// second caffeine-dosing constant.
//
// This also deliberately doesn't duplicate endurance-fueling-math.ts's
// per-hour carb/fluid/sodium model (which answers "what rate fits my
// effort intensity and GI training," with a reverse-engineered HR-zone x
// GI-training lookup table): this tool answers a narrower, race-week
// question -- "given my weight and goal duration, what are the concrete
// numbers for carb-loading, breakfast, in-race fueling, and caffeine" --
// and takes a single target rate as a given, the same way the Race Pace
// Planner takes a goal pace as a given rather than predicting it.

import { suggestedCarbsPerHour, type GiTrainingLevel, type HeartRateZone } from "@/lib/endurance-fueling-math";
import { caffeinePreloadDoseMg } from "@/lib/fueling-products";
import { buildGelTimingSchedule, caffeineTiming, mouthRinseRecommended, PRE_RACE_GEL_MINUTES_BEFORE_START } from "@/lib/fueling-schedule-core";

export const DEFAULT_TARGET_CARB_G_PER_HOUR = 60; // ACSM/ISSN-consistent flat default, kept as the fallback for any caller that doesn't have an effort level to work from

// --- Fueling Planner: shared mode/target logic ------------------------------
//
// The Fueling Planner (this tool's unified race/training-run form) resolves
// one target carb rate for both modes, rather than the Fueling Calculator's
// old flat DEFAULT_TARGET_CARB_G_PER_HOUR above: suggestedCarbsPerHour
// (endurance-fueling-math.ts's reverse-engineered HR-zone x GI-training
// lookup table) is now the suggestion for both race and training-run
// sessions, and an explicit custom override -- when the runner sets one --
// still wins, the same "suggestion vs. override" pattern
// endurance-fueling-math.ts's own UI already used for training runs. This is
// the resolved conflict between the two original tools' default carb rates
// (a flat 60g/hr vs. an effort-adjusted 35-120g/hr table): the effort-
// adjusted figure wins per this tool's own enrichment goal, but nothing is
// lost -- a runner who wants the old flat 60g/hr can still type it into the
// override field.
export type FuelingPlannerMode = "race" | "training";

export function resolveCarbTargetGPerHour(
  zone: HeartRateZone,
  giTraining: GiTrainingLevel,
  customOverrideGPerHour: number | null,
): number {
  if (customOverrideGPerHour !== null && customOverrideGPerHour > 0) return customOverrideGPerHour;
  return suggestedCarbsPerHour(zone, giTraining);
}

// The gut, not fitness, is what actually limits carb intake during
// exercise -- SGLT1 (the glucose transporter) and GLUT5 (the fructose
// transporter) each saturate on their own, which is why a glucose+fructose
// mix supports a meaningfully higher total rate than either sugar alone,
// and why the rate itself has to be trained gradually rather than jumped
// to on race day.
export type CarbRateStep = { label: string; lowGPerHour: number; highGPerHour: number };

const CARB_RATE_PROGRESSION_STEPS: CarbRateStep[] = [
  { label: "Step 1", lowGPerHour: 30, highGPerHour: 45 },
  { label: "Step 2", lowGPerHour: 50, highGPerHour: 60 },
  { label: "Step 3", lowGPerHour: 70, highGPerHour: 90 },
];

export type CarbRateGuidance = {
  targetGPerHour: number;
  needsProgression: boolean;
  steps: CarbRateStep[];
};

/**
 * `currentRateGPerHour` is optional and only ever changes whether the
 * step-up progression is shown -- it never changes the target itself or
 * the gel schedule's own rate, which is always built around the target a
 * runner is working toward, not where they are today.
 */
export function buildCarbRateGuidance(currentRateGPerHour: number | null, targetGPerHour: number): CarbRateGuidance {
  const needsProgression = currentRateGPerHour !== null && currentRateGPerHour < targetGPerHour;
  return {
    targetGPerHour,
    needsProgression,
    steps: needsProgression ? CARB_RATE_PROGRESSION_STEPS : [],
  };
}

// --- Carb loading -----------------------------------------------------------
//
// Two widely-cited protocols, both expressed as g/kg body weight per day:
// a moderate 1.5-day version and a more aggressive 2-day version. Neither
// is "better" in isolation -- the aggressive protocol asks for more total
// carbohydrate and more days of it, which is exactly the kind of thing
// worth rehearsing before a big workout, not discovering for the first
// time in race week.
const MODERATE_LOW_G_PER_KG_PER_DAY = 8;
const MODERATE_HIGH_G_PER_KG_PER_DAY = 10;
const MODERATE_DAYS = 1.5;
const AGGRESSIVE_LOW_G_PER_KG_PER_DAY = 10;
const AGGRESSIVE_HIGH_G_PER_KG_PER_DAY = 12;
const AGGRESSIVE_DAYS = 2;

export type CarbLoadProtocol = { lowG: number; highG: number; days: number };
export type CarbLoadTargets = { moderate: CarbLoadProtocol; aggressive: CarbLoadProtocol };

export function buildCarbLoadTargets(weightKg: number): CarbLoadTargets {
  return {
    moderate: {
      lowG: Math.round(MODERATE_LOW_G_PER_KG_PER_DAY * weightKg * MODERATE_DAYS),
      highG: Math.round(MODERATE_HIGH_G_PER_KG_PER_DAY * weightKg * MODERATE_DAYS),
      days: MODERATE_DAYS,
    },
    aggressive: {
      lowG: Math.round(AGGRESSIVE_LOW_G_PER_KG_PER_DAY * weightKg * AGGRESSIVE_DAYS),
      highG: Math.round(AGGRESSIVE_HIGH_G_PER_KG_PER_DAY * weightKg * AGGRESSIVE_DAYS),
      days: AGGRESSIVE_DAYS,
    },
  };
}

// --- Pre-race breakfast ------------------------------------------------------
//
// A 1-4 g/kg range eaten within 3 hours of the start -- deliberately wide,
// since gut tolerance this close to a race start varies more between
// runners than almost anything else in this calculator, and the right
// number for any one runner is whatever they've already rehearsed in
// training, not the top of this range by default.
const BREAKFAST_LOW_G_PER_KG = 1;
const BREAKFAST_HIGH_G_PER_KG = 4;
const BREAKFAST_HOURS_BEFORE_START = 3;

export type BreakfastTargets = { lowG: number; highG: number; hoursBeforeStart: number };

export function buildBreakfastTargets(weightKg: number): BreakfastTargets {
  return {
    lowG: Math.round(BREAKFAST_LOW_G_PER_KG * weightKg),
    highG: Math.round(BREAKFAST_HIGH_G_PER_KG * weightKg),
    hoursBeforeStart: BREAKFAST_HOURS_BEFORE_START,
  };
}

// --- In-race gel/drink schedule ----------------------------------------------

export type GelReminder = { atMinute: number; optional?: boolean };

export type RaceFuelingSchedule = {
  preRaceGel: { minutesBeforeStart: number };
  gels: GelReminder[];
  mouthRinseInsteadOfFinalGel: boolean;
};

export function buildRaceFuelingSchedule(goalDurationMinutes: number, targetGPerHour: number, gelCarbGrams: number): RaceFuelingSchedule {
  return {
    preRaceGel: { minutesBeforeStart: PRE_RACE_GEL_MINUTES_BEFORE_START },
    gels: buildGelTimingSchedule({ totalMinutes: goalDurationMinutes, carbGramsPerHour: targetGPerHour, gelCarbGrams }),
    mouthRinseInsteadOfFinalGel: mouthRinseRecommended(goalDurationMinutes),
  };
}

// --- Caffeine -----------------------------------------------------------------
//
// caffeinePreloadDoseMg (fueling-products.ts) already gives the total
// ~3mg/kg race-day budget; this tool splits that total across the same
// two-dose protocol the Race Pace Planner uses (an early dose plus a
// mid-race dose), rather than loading it all pre-race.
export type CaffeinePlan = {
  totalMg: number;
  firstDoseMg: number;
  secondDoseMg: number;
  secondDoseAtMinute: number;
};

const CAFFEINE_DOSE_ROUNDING_MG = 5;

export function buildCaffeinePlan(weightKg: number, goalDurationMinutes: number): CaffeinePlan | null {
  const timing = caffeineTiming(goalDurationMinutes);
  if (!timing) return null;

  const totalMg = caffeinePreloadDoseMg(weightKg);
  const firstDoseMg = Math.round(totalMg / 2 / CAFFEINE_DOSE_ROUNDING_MG) * CAFFEINE_DOSE_ROUNDING_MG;
  const secondDoseMg = totalMg - firstDoseMg;

  return { totalMg, firstDoseMg, secondDoseMg, secondDoseAtMinute: timing.secondDoseAtMinute };
}
