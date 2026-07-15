import type { GenomeCategory } from "./types";

// Single source of truth for genome category order and labels -- used by
// both an individual coach's genome chart and the comparison directory, so
// the two can never list categories in a different order.
export const GENOME_CATEGORIES: { key: GenomeCategory; label: string; description: string }[] = [
  {
    key: "aerobicDevelopment",
    label: "Aerobic Development",
    description: "How much the system leans on low-intensity volume to build the aerobic engine itself.",
  },
  {
    key: "threshold",
    label: "Threshold",
    description: "How much quality training time is spent at or near lactate threshold specifically.",
  },
  {
    key: "vo2max",
    label: "VO₂ Max",
    description: "How much training targets the aerobic power ceiling, not just aerobic efficiency below it.",
  },
  {
    key: "specificity",
    label: "Specificity",
    description: "How closely training mimics the exact pace and duration of the goal race.",
  },
  {
    key: "psychology",
    label: "Psychology",
    description: "How much the system treats mental preparation as a coached, trainable skill.",
  },
  {
    key: "strength",
    label: "Strength",
    description: "How much dedicated strength or plyometric work the system builds in.",
  },
  {
    key: "biomechanics",
    label: "Biomechanics",
    description: "How much attention the system pays to running form and technique.",
  },
  {
    key: "dataDriven",
    label: "Data Driven",
    description: "How much training decisions rely on measured numbers (pace, lactate, VDOT) over feel.",
  },
  {
    key: "individualization",
    label: "Individualization",
    description: "How much the prescription is tailored to one athlete's own data versus a shared formula.",
  },
  {
    key: "volume",
    label: "Volume",
    description: "How much total weekly training load the system typically asks for.",
  },
];

// Turns a 0-100 genome score into the qualitative label the Coach
// Comparison Table's "Data Driven" and "Individualization" columns show --
// keeps the table reading as plain English instead of a bare number, while
// still deriving from the one real genome score rather than a second,
// separately-maintained value.
export function genomeScoreLabel(score: number): string {
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}
