import { diffDays } from "@/lib/coaching-engine/date-utils";
import { derivePaceZones } from "@/lib/coaching-engine/pace-zones";
import { buildWeeklyMileagePlan } from "@/lib/coaching-engine/mileage-progression";
import { allocateMesocycles, buildWeeklyPhaseSequence, coalesceMesocycles } from "@/lib/coaching-engine/periodization";
import { buildWeekPrescriptions } from "@/lib/coaching-engine/prescriptions";
import { scheduleCalendar } from "@/lib/coaching-engine/scheduling";
import type { GenerateTrainingPlanInput, GenerateTrainingPlanResult, WorkoutDraft } from "@/lib/coaching-engine/types";

const MIN_PLAN_WEEKS = 4;
const MAX_PLAN_WEEKS = 52;

// The one entry point the rest of the app should call. Pure and zero-I/O --
// every date and mileage figure it needs comes in as input, so the same
// input always produces the exact same plan. Callers own persisting the
// result; this function only ever returns plain data.
export function generateTrainingPlan(input: GenerateTrainingPlanInput): GenerateTrainingPlanResult {
  const { goal, athlete, today } = input;

  const totalWeeks = Math.floor(diffDays(today, goal.date) / 7) + 1;
  if (totalWeeks < MIN_PLAN_WEEKS) {
    return {
      ok: false,
      error: `Your goal date is too close -- a plan needs at least ${MIN_PLAN_WEEKS} weeks to build safely. Pick a later date or a shorter-term goal.`,
    };
  }
  if (totalWeeks > MAX_PLAN_WEEKS) {
    return {
      ok: false,
      error: "Your goal date is more than a year out -- check back closer to your race to generate a plan.",
    };
  }

  const allocation = allocateMesocycles(totalWeeks, goal.distanceM);
  const weeks = buildWeeklyPhaseSequence(allocation);
  const { mesocycles, weekMesocycleIndex } = coalesceMesocycles(weeks, today);
  const mileagePlan = buildWeeklyMileagePlan(weeks, athlete.currentWeeklyMileageM, goal.distanceM);
  const paceZones = derivePaceZones(goal.distanceM, goal.timeS);
  const slots = scheduleCalendar(weeks, today, goal.date, athlete.daysPerWeek);

  const workouts: WorkoutDraft[] = [];
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    // `slots` is sorted by date across the whole plan; a single week's dates
    // never interleave with another week's, so filtering preserves each
    // week's own chronological order.
    const weekSlots = slots.filter((slot) => slot.weekIndex === weekIndex);
    const weekTypes = weekSlots.map((slot) => slot.workoutType);
    const prescriptions = buildWeekPrescriptions(
      weekTypes,
      mileagePlan[weekIndex],
      paceZones,
      weeks[weekIndex].phase,
      goal.distanceM,
    );

    weekSlots.forEach((slot, i) => {
      workouts.push({
        mesocycleIndex: weekMesocycleIndex[weekIndex],
        scheduledDate: slot.date,
        workoutType: slot.workoutType,
        prescription: prescriptions[i],
      });
    });
  }

  return {
    ok: true,
    plan: {
      name: `${goal.raceName} Training Plan`,
      startDate: today,
      endDate: goal.date,
      philosophy: "custom",
      status: "active",
    },
    mesocycles,
    workouts,
  };
}
