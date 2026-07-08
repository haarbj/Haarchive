import type { WorkoutType } from "@/lib/coaching-engine";

const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  easy: "Easy run",
  recovery: "Recovery",
  long: "Long run",
  tempo: "Tempo",
  vo2: "Intervals",
  race: "Race day",
  strength: "Strength",
};

export function workoutTypeLabel(workoutType: WorkoutType): string {
  return WORKOUT_TYPE_LABEL[workoutType];
}

// The formatter itself lives in lib/coaching-engine now -- the AI layer's
// tool results need the identical description to narrate from, not raw
// JSON, so it can't stay app-route-local anymore.
export { describePrescription } from "@/lib/coaching-engine";
