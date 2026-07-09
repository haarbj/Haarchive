import type { MesocyclePhase, WorkoutPrescription } from "@/lib/coaching-engine/types";

// One-line, plain-language framing for each mesocycle phase -- shown
// alongside the raw phase name wherever it's surfaced, so "Base" reads as
// something a runner understands rather than a label from a spreadsheet.
export const PHASE_SUMMARY: Record<MesocyclePhase, string> = {
  base: "Building the aerobic foundation everything else gets stacked on.",
  build: "Layering in tempo and threshold work on top of that base.",
  peak: "Race-specific sharpening -- the highest-intensity stretch of the plan.",
  taper: "Cutting volume so your legs arrive at the start line fresh.",
  recovery: "A deliberately lighter week to absorb the training you've done so far.",
};

export type WorkoutCoaching = {
  objective: string;
  adaptations: string[];
};

// Keyed by workout kind rather than phase: the physiological purpose of a
// tempo run doesn't change depending on which mesocycle it falls in, so this
// is the more accurate axis for "why does this workout look like this."
export const WORKOUT_KIND_COACHING: Record<WorkoutPrescription["kind"], WorkoutCoaching> = {
  easy: {
    objective: "Build aerobic volume without adding fatigue.",
    adaptations: ["Capillary development", "Fat oxidation", "Recovery"],
  },
  recovery: {
    objective: "Move the legs and encourage blood flow -- nothing more.",
    adaptations: ["Active recovery", "Blood flow", "Injury prevention"],
  },
  long: {
    objective: "Extend how long your body can run well on fat and glycogen together.",
    adaptations: ["Glycogen storage", "Fatigue resistance", "Mental durability"],
  },
  tempo: {
    objective: "Raise the pace you can hold before lactate piles up faster than you can clear it.",
    adaptations: ["Lactate threshold", "Running economy"],
  },
  vo2: {
    objective: "Push your aerobic ceiling higher.",
    adaptations: ["VO2 max", "Running economy", "Neuromuscular power"],
  },
  race: {
    objective: "Express the fitness you've already built -- not a day to chase more.",
    adaptations: ["Peak performance", "Taper payoff"],
  },
};
