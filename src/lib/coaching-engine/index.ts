export { generateTrainingPlan } from "@/lib/coaching-engine/plan-generator";
export { predictRaceTime } from "@/lib/coaching-engine/race-prediction";
export { derivePaceZones, WORKOUT_TYPE_PACE_ZONE } from "@/lib/coaching-engine/pace-zones";
export { addDays, diffDays, dayOfWeek } from "@/lib/coaching-engine/date-utils";
export { workoutPrescriptionSchema } from "@/lib/coaching-engine/types";
export type { DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
export type {
  GenerateTrainingPlanInput,
  GenerateTrainingPlanResult,
  MesocycleDraft,
  MesocyclePhase,
  PaceZoneKey,
  PaceZones,
  PlanDraft,
  WorkoutDraft,
  WorkoutPrescription,
  WorkoutType,
} from "@/lib/coaching-engine/types";
