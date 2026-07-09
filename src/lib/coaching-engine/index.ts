export { generateTrainingPlan } from "@/lib/coaching-engine/plan-generator";
export { predictRaceTime } from "@/lib/coaching-engine/race-prediction";
export { derivePaceZones, WORKOUT_TYPE_PACE_ZONE } from "@/lib/coaching-engine/pace-zones";
export { addDays, diffDays, dayOfWeek } from "@/lib/coaching-engine/date-utils";
export {
  adjustForHeat,
  compressWorkout,
  estimateWBGT,
  heatZoneFor,
  insertRecoveryDay,
  substituteForSurface,
} from "@/lib/coaching-engine/adaptations";
export { describePrescription } from "@/lib/coaching-engine/describe-prescription";
export { workoutPrescriptionSchema } from "@/lib/coaching-engine/types";
export { PHASE_SUMMARY, WORKOUT_KIND_COACHING } from "@/lib/coaching-engine/coaching-copy";
export { generateCompletionFeedback } from "@/lib/coaching-engine/completion-feedback";
export { summarizeWeek } from "@/lib/coaching-engine/weekly-summary";
export type { DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
export type { AdaptationResult, HeatZone, SurfaceGuidance } from "@/lib/coaching-engine/adaptations";
export type { WorkoutCoaching } from "@/lib/coaching-engine/coaching-copy";
export type { CompletionInput } from "@/lib/coaching-engine/completion-feedback";
export type { WeekCompletionInput, WeeklySummary } from "@/lib/coaching-engine/weekly-summary";
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
