import { diffDays } from "@/lib/coaching-engine/date-utils";
import { buildWeeklyMileagePlan } from "@/lib/coaching-engine/mileage-progression";
import { allocateMesocycles, buildWeeklyPhaseSequence, coalesceMesocycles } from "@/lib/coaching-engine/periodization";
import { weeklyTemplateFor } from "@/lib/coaching-engine/templates";
import type { MesocyclePhase, WorkoutType } from "@/lib/coaching-engine/types";

const MIN_SEASON_WEEKS = 4;
const MAX_SEASON_WEEKS = 52;

export type GenerateSeasonBlueprintInput = {
  goal: { raceName: string; distanceM: number; date: string };
  representativeAthlete: { currentWeeklyMileageM: number; daysPerWeek: number };
  today: string;
};

export type SeasonPhaseDraft = {
  phase: MesocyclePhase;
  orderIndex: number;
  displayName: string;
  startDate: string;
  endDate: string;
  primaryGoal: string;
  secondaryGoals: string[];
  keyWorkoutTypes: WorkoutType[];
};

export type MileageLevel = "low" | "moderate" | "high";

export type SeasonWeekDraft = {
  phaseOrderIndex: number;
  weekIndex: number;
  theme: string;
  mileageLevel: MileageLevel;
  workoutSlots: { label: string; workoutType: WorkoutType }[];
};

export type GenerateSeasonBlueprintResult =
  | { ok: true; phases: SeasonPhaseDraft[]; weeks: SeasonWeekDraft[] }
  | { ok: false; error: string };

// Display content for Layer 1 (Season Blueprint), grounded in the coach's
// own example framing -- Summer Base / Threshold Phase / VO2 Development /
// Championship Phase -- rather than the bare mesocycle_phase enum values.
// `phase` itself stays the enum underneath so the deterministic engine
// (pace zones, periodization, mileage progression) keeps working exactly
// as it already does; this table only affects what a coach sees and edits.
const PHASE_DISPLAY_COPY: Record<MesocyclePhase, { displayName: string; primaryGoal: string; secondaryGoals: string[] }> = {
  base: {
    displayName: "Summer Base",
    primaryGoal: "Build aerobic capacity",
    secondaryGoals: ["Running economy", "Consistency", "Injury prevention"],
  },
  build: {
    displayName: "Threshold Phase",
    primaryGoal: "Raise lactate threshold",
    secondaryGoals: ["Introduce tempo work", "Maintain mileage"],
  },
  peak: {
    displayName: "VO2 Development",
    primaryGoal: "Increase aerobic power",
    secondaryGoals: ["Sharpen race-specific fitness", "Race simulation"],
  },
  taper: {
    displayName: "Championship Phase",
    primaryGoal: "Arrive at the championship meet rested and sharp",
    secondaryGoals: ["Cut volume", "Hold race-pace feel"],
  },
  recovery: {
    displayName: "Recovery Week",
    primaryGoal: "Absorb the training block that came before it",
    secondaryGoals: ["Reduced volume", "Stay loose"],
  },
};

const WEEK_THEME_BY_PHASE: Record<MesocyclePhase, string> = {
  base: "Build aerobic volume",
  build: "Increase threshold volume",
  peak: "Sharpen race-specific fitness",
  taper: "Cut volume, hold sharpness",
  recovery: "Absorb and recover",
};

function labelSlots(types: WorkoutType[]): { label: string; workoutType: WorkoutType }[] {
  let qualityCount = 0;
  return types.map((workoutType) => {
    if (workoutType === "long") return { label: "Long Run", workoutType };
    if (workoutType === "tempo" || workoutType === "vo2") {
      qualityCount += 1;
      return { label: qualityCount === 1 ? "Workout A" : "Workout B", workoutType };
    }
    if (workoutType === "recovery") return { label: "Recovery Day", workoutType };
    return { label: "Easy Day", workoutType };
  });
}

function mileageLevelFor(weekMeters: number, minMeters: number, maxMeters: number): MileageLevel {
  if (maxMeters === minMeters) return "moderate";
  const fraction = (weekMeters - minMeters) / (maxMeters - minMeters);
  if (fraction < 1 / 3) return "low";
  if (fraction < 2 / 3) return "moderate";
  return "high";
}

// Pure, zero-I/O, same shape as plan-generator.ts -- reuses the exact same
// periodization/mileage-progression/templates functions an individual
// athlete's plan already goes through, just stops short of building daily
// prescriptions (that's Layer 3, generated per-athlete later against each
// athlete's own mileage/pace, not here against a "representative" one).
export function generateSeasonBlueprint(input: GenerateSeasonBlueprintInput): GenerateSeasonBlueprintResult {
  const { goal, representativeAthlete, today } = input;

  const totalWeeks = Math.floor(diffDays(today, goal.date) / 7) + 1;
  if (totalWeeks < MIN_SEASON_WEEKS) {
    return {
      ok: false,
      error: `Your goal date is too close -- a season needs at least ${MIN_SEASON_WEEKS} weeks to build safely. Pick a later date.`,
    };
  }
  if (totalWeeks > MAX_SEASON_WEEKS) {
    return { ok: false, error: "Your goal date is more than a year out -- check back closer to the season to generate a blueprint." };
  }

  const allocation = allocateMesocycles(totalWeeks, goal.distanceM);
  const weekPlan = buildWeeklyPhaseSequence(allocation);
  const { mesocycles, weekMesocycleIndex } = coalesceMesocycles(weekPlan, today);
  const mileagePlan = buildWeeklyMileagePlan(weekPlan, representativeAthlete.currentWeeklyMileageM, goal.distanceM);
  const minMileage = Math.min(...mileagePlan);
  const maxMileage = Math.max(...mileagePlan);

  const phases: SeasonPhaseDraft[] = mesocycles.map((meso, orderIndex) => {
    const copy = PHASE_DISPLAY_COPY[meso.phase];
    const template = weeklyTemplateFor(meso.phase, representativeAthlete.daysPerWeek);
    return {
      phase: meso.phase,
      orderIndex,
      displayName: copy.displayName,
      startDate: meso.startDate,
      endDate: meso.endDate,
      primaryGoal: copy.primaryGoal,
      secondaryGoals: copy.secondaryGoals,
      keyWorkoutTypes: Array.from(new Set(template)),
    };
  });

  const weeks: SeasonWeekDraft[] = weekPlan.map((week) => {
    const template = weeklyTemplateFor(week.phase, representativeAthlete.daysPerWeek);
    return {
      phaseOrderIndex: weekMesocycleIndex[week.weekIndex],
      weekIndex: week.weekIndex,
      theme: WEEK_THEME_BY_PHASE[week.phase],
      mileageLevel: mileageLevelFor(mileagePlan[week.weekIndex], minMileage, maxMileage),
      workoutSlots: labelSlots(template),
    };
  });

  return { ok: true, phases, weeks };
}
