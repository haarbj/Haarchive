// Workout-type metadata for the "Adjust Workout Paces" mode. Deliberately
// just data, not logic -- adjust-workout-pace.ts and environmental-calculator.tsx
// consume this to generate coaching-style guidance, but the actual heat/
// humidity/wind/elevation math is entirely the existing engines' (see
// combine.ts, heat-engine.ts, etc.) run exactly as Analyze/Predict/Compare
// already run them. Adding a workout type is just adding one entry here --
// no other file needs to change.

import type { SpeedOrEffort } from "@/lib/track-wind-physics";

export type WorkoutStructure = "continuous" | "interval";

export type WorkoutType =
  | "race"
  | "easy"
  | "recovery"
  | "long-run"
  | "marathon-pace"
  | "steady-state"
  | "tempo"
  | "threshold"
  | "critical-velocity"
  | "vo2max"
  | "hill-repeats"
  | "intervals"
  | "progression"
  | "fartlek"
  | "custom";

export type WorkoutTypeConfig = {
  label: string;
  /**
   * "continuous": the planned distance/duration is the whole effort.
   * "interval": it's one representative rep -- this tool doesn't model a
   * full set with recovery, since a rep's own pace/distance already fully
   * determines the physics; the distinction only changes helper copy.
   */
  structure: WorkoutStructure;
  /** The physiological adaptation this workout is meant to develop. */
  targetSystem: string;
  /** What holding the original pace risks turning the workout into, under tough conditions. */
  driftDescription: string;
  /**
   * The pacing assumption this workout type implies for track/route wind
   * integration -- lets "what best describes this run?" replace the raw
   * constant-effort/constant-speed physics toggle as the primary control,
   * with the toggle itself demoted to an Advanced Settings override.
   */
  defaultSpeedOrEffort: SpeedOrEffort;
};

export const WORKOUT_TYPE_ORDER: WorkoutType[] = [
  "race",
  "easy",
  "recovery",
  "long-run",
  "marathon-pace",
  "steady-state",
  "tempo",
  "threshold",
  "critical-velocity",
  "vo2max",
  "hill-repeats",
  "intervals",
  "progression",
  "fartlek",
  "custom",
];

export const WORKOUT_TYPE_CONFIG: Record<WorkoutType, WorkoutTypeConfig> = {
  race: {
    label: "Race",
    structure: "continuous",
    targetSystem: "race-day performance -- executing your goal pace or effort under competition conditions",
    driftDescription:
      "Holding the original goal pace in these conditions demands race-day-caliber effort on top of an already maximal one -- pacing by effort protects against a late blowup that a fixed split target can't see coming.",
    defaultSpeedOrEffort: "constant-effort",
  },
  easy: {
    label: "Easy Run",
    structure: "continuous",
    targetSystem: "aerobic base development and recovery, at a conversational effort",
    driftDescription:
      "Holding the original pace would push the effort harder than intended, adding fatigue without the easy day's usual recovery benefit.",
    defaultSpeedOrEffort: "constant-effort",
  },
  recovery: {
    label: "Recovery Run",
    structure: "continuous",
    targetSystem: "active recovery -- blood flow and light aerobic stimulus without meaningful training stress",
    driftDescription:
      "Holding the original pace risks turning a recovery day into another stress day, blunting the recovery you need before your next hard session.",
    defaultSpeedOrEffort: "constant-effort",
  },
  "long-run": {
    label: "Long Run",
    structure: "continuous",
    targetSystem: "aerobic endurance and fat-oxidation capacity built up over an extended duration",
    driftDescription:
      "Heat and dehydration compound over time, so holding the original pace gets progressively harder as a long run goes on, well beyond what the early miles suggest -- risking a hard late fade or overheating.",
    defaultSpeedOrEffort: "constant-effort",
  },
  "marathon-pace": {
    label: "Marathon Pace",
    structure: "continuous",
    targetSystem: "race-specific efficiency at marathon effort, rehearsing pacing discipline and fueling",
    driftDescription:
      "Holding true marathon pace in these conditions demands race-day-caliber effort rather than a controlled rehearsal -- exactly the pacing breakdown marathon training is meant to prevent.",
    defaultSpeedOrEffort: "constant-speed",
  },
  "steady-state": {
    label: "Steady State",
    structure: "continuous",
    targetSystem: "sustained aerobic effort just below tempo, building durability without deep fatigue",
    driftDescription:
      "Holding the original pace would edge this into tempo or threshold territory, costing more fatigue than a steady-state day is meant to.",
    defaultSpeedOrEffort: "constant-effort",
  },
  tempo: {
    label: "Tempo",
    structure: "continuous",
    targetSystem: "a comfortably hard aerobic effort that builds your ability to sustain a strong pace",
    driftDescription:
      "Holding the original pace would push this from tempo toward threshold effort -- the extra strain doesn't buy extra fitness, it just adds fatigue you didn't plan for.",
    defaultSpeedOrEffort: "constant-effort",
  },
  threshold: {
    label: "Threshold",
    structure: "continuous",
    targetSystem: "lactate threshold -- the fastest pace you can sustain while still clearing lactate as fast as you produce it",
    driftDescription:
      "Running the original pace would likely turn this into an effort closer to VO2 max, since heat and wind add cardiovascular strain on top of the pace itself.",
    defaultSpeedOrEffort: "constant-effort",
  },
  "critical-velocity": {
    label: "Critical Velocity",
    structure: "interval",
    targetSystem: "critical velocity -- the boundary pace between sustainable and unsustainable metabolic effort",
    driftDescription:
      "Conditions that add cardiovascular strain push the original pace above true critical velocity, turning a boundary effort into an unsustainable one well before the workout is designed to end.",
    defaultSpeedOrEffort: "constant-speed",
  },
  vo2max: {
    label: "VO₂ Max",
    structure: "interval",
    targetSystem: "maximal aerobic power -- developing your ceiling for oxygen uptake",
    driftDescription:
      "Heat and humidity already tax the cardiovascular system near its ceiling -- holding the original pace risks an early, ugly blowup rather than clean, repeatable reps at true VO₂ max effort.",
    defaultSpeedOrEffort: "constant-speed",
  },
  "hill-repeats": {
    label: "Hill Repeats",
    structure: "interval",
    targetSystem: "muscular power and running economy, using gradient instead of pace to load the effort",
    driftDescription:
      "Hills already add cardiovascular cost on top of pace -- in hot or humid conditions that combined strain compounds fast, so effort (not a flat-ground-equivalent pace) should lead today.",
    defaultSpeedOrEffort: "constant-effort",
  },
  intervals: {
    label: "Intervals",
    structure: "interval",
    targetSystem: "repeatable, controlled hard efforts with recovery between reps, building speed and race rhythm",
    driftDescription:
      "Wind and heat cost gets paid every rep -- holding the original pace risks each interval getting progressively harder to hold, degrading the workout's rhythm and consistency rep to rep.",
    defaultSpeedOrEffort: "constant-speed",
  },
  progression: {
    label: "Progression Run",
    structure: "continuous",
    targetSystem: "a controlled shift from easy to faster effort, teaching pace discipline as fatigue builds",
    driftDescription:
      "Conditions add fatigue on top of the run's own built-in progression -- holding the original pace schedule risks the back half arriving far harder than the progression was designed to feel.",
    defaultSpeedOrEffort: "constant-speed",
  },
  fartlek: {
    label: "Fartlek",
    structure: "interval",
    targetSystem: "unstructured, effort-based speed play mixing hard and easy running",
    driftDescription:
      "Fartlek is effort-driven rather than pace-driven by design -- let effort lead today and treat the adjusted numbers below as a guide, not a hard target.",
    defaultSpeedOrEffort: "constant-effort",
  },
  custom: {
    label: "Custom Workout",
    structure: "continuous",
    targetSystem: "whatever effort you're targeting today",
    driftDescription:
      "Holding the original pace in these conditions asks for more physiological effort than intended -- use the adjustment below as a starting point and calibrate to how you actually feel.",
    defaultSpeedOrEffort: "constant-effort",
  },
};
