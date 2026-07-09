import { type DistanceBucket } from "@/lib/coaching-engine/distance-buckets";
import type { MesocyclePhase, WorkoutPrescription } from "@/lib/coaching-engine/types";

// Coaching copy is grounded in two of this program's own written training
// philosophies rather than generic exercise-science phrasing: the XC
// Training Guidelines (mile through 10K -- "short"/"middle" buckets) and
// the Vandy Run Club Training Guidelines (half/marathon -- "long" bucket).
// Both documents converge on the same closing idea, word for word, which is
// why it's surfaced here as a single shared constant rather than per-voice
// copy.
export const CORE_PRINCIPLE = "We train adaptations, not workouts.";

export type TrainingVoice = "xc" | "marathon";

export function trainingVoiceFor(bucket: DistanceBucket): TrainingVoice {
  return bucket === "long" ? "marathon" : "xc";
}

const PHASE_SUMMARY_XC: Record<MesocyclePhase, string> = {
  base: "Building the aerobic engine everything else gets stacked on -- consistency here matters more than any single session.",
  build: "Layering in tempo work on top of that base. Hard workouts are effective because easy days stay easy.",
  peak: "Race-specific sharpening -- VO2 max work and racing itself, built on the aerobic base already in place.",
  taper: "Cutting volume so the fitness you've built actually shows up on race day.",
  recovery: "A deliberately lighter week -- recovery is part of training, not a break from it.",
};

const PHASE_SUMMARY_MARATHON: Record<MesocyclePhase, string> = {
  base: "Building durability and aerobic development -- the foundation the rest of the cycle depends on.",
  build: "Adding threshold work and marathon-pace exposure on top of a base that can already absorb it.",
  peak: "Maximum specificity: long runs and key sessions that increasingly resemble race day itself.",
  taper: "Reducing volume while holding enough intensity to arrive rested, not detrained.",
  recovery: "A lighter week to absorb training -- durability comes from repeatable weeks, not heroic ones.",
};

export function phaseSummary(phase: MesocyclePhase, bucket: DistanceBucket): string {
  return (trainingVoiceFor(bucket) === "marathon" ? PHASE_SUMMARY_MARATHON : PHASE_SUMMARY_XC)[phase];
}

export type WorkoutCoaching = {
  objective: string;
  adaptations: string[];
};

// Keyed by workout kind rather than phase: the physiological purpose of a
// tempo run doesn't change depending on which mesocycle it falls in.
const WORKOUT_KIND_COACHING_XC: Record<WorkoutPrescription["kind"], WorkoutCoaching> = {
  easy: {
    objective: "Build the aerobic engine without adding fatigue. If you can't hold a conversation, you're running too fast.",
    adaptations: ["Capillary development", "Fat oxidation", "Recovery"],
  },
  recovery: {
    objective: "Move the legs and encourage blood flow -- nothing more.",
    adaptations: ["Active recovery", "Blood flow", "Injury prevention"],
  },
  long: {
    objective: "Build endurance more effectively than any other run this week -- relaxed running and good rhythm, not pace.",
    adaptations: ["Aerobic endurance", "Fatigue resistance", "Mental toughness"],
  },
  tempo: {
    objective: "Raise your lactate threshold and teach your body to run faster while staying primarily aerobic.",
    adaptations: ["Lactate threshold", "Running economy"],
  },
  vo2: {
    objective: "Increase aerobic power -- the ability to run hard for longer. The first rep shouldn't be the fastest.",
    adaptations: ["VO2 max", "Running economy", "Neuromuscular coordination"],
  },
  race: {
    objective: "This is the test the training was for, not another day to train.",
    adaptations: ["Race execution", "Season payoff"],
  },
};

const WORKOUT_KIND_COACHING_MARATHON: Record<WorkoutPrescription["kind"], WorkoutCoaching> = {
  easy: {
    objective: "Build mitochondrial density, fat oxidation, and capillary networks without costing you the next quality session.",
    adaptations: ["Mitochondrial density", "Fat oxidation", "Connective tissue strength"],
  },
  recovery: {
    objective: "Protect your ability to train tomorrow. If this feels like effort, it's being run too fast.",
    adaptations: ["Circulation", "Durability", "Recovery"],
  },
  long: {
    objective: "The most race-specific session of the week -- build glycogen storage and efficient mechanics under fatigue.",
    adaptations: ["Glycogen storage", "Fat oxidation", "Muscular endurance"],
  },
  tempo: {
    objective: "Raise the pace you can sustain aerobically, with modest recovery cost compared to harder interval work.",
    adaptations: ["Lactate threshold", "Sustainable pace"],
  },
  vo2: {
    objective: "Maintain aerobic power and efficiency at faster speeds, in support of the marathon work around it.",
    adaptations: ["Aerobic power", "Speed efficiency"],
  },
  race: {
    objective: "26.2 miles rewards the training you've already done, not anything new you can add today.",
    adaptations: ["Race execution", "Durability payoff"],
  },
};

export function workoutKindCoaching(kind: WorkoutPrescription["kind"], bucket: DistanceBucket): WorkoutCoaching {
  return (trainingVoiceFor(bucket) === "marathon" ? WORKOUT_KIND_COACHING_MARATHON : WORKOUT_KIND_COACHING_XC)[kind];
}
