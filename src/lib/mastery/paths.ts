// Learning paths: 4 code-defined sequences of real topic slugs (Phase 1
// has no `learning_paths` table -- there's no path UI yet, these only
// support the "use progress to determine next topic" recommendation logic
// in recommend.ts). Every slug here must exist in TOPIC_SEEDS.

export type LearningPath = {
  id: string;
  title: string;
  description: string;
  topicSlugs: string[];
};

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: "start-here",
    title: "Start Here",
    description:
      "The on-ramp for anyone new to structured training -- why before what, from the ground up.",
    topicSlugs: [
      "how-to-start-running",
      "training-philosophy",
      "the-philosophy-of-running",
      "the-aerobic-base",
      "exercise-physiology",
    ],
  },
  {
    id: "understand-the-science",
    title: "Understand the Science",
    description:
      "The physiology and evidence behind good training, not just the workouts it produces.",
    topicSlugs: [
      "exercise-physiology",
      "the-aerobic-base",
      "research-library",
      "data-and-analytics",
      "mostly-easy-genuinely-hard",
      "what-a-race-result-can-tell-you",
    ],
  },
  {
    id: "marathon-training",
    title: "Marathon Training",
    description:
      "Aerobic development, fueling, and recovery for the specific demands of the marathon distance.",
    topicSlugs: [
      "the-aerobic-base",
      "marathon-training",
      "nutrition-and-fueling",
      "recovery",
      "marathon-pacing-calculator",
    ],
  },
  {
    id: "coaching-philosophy",
    title: "Coaching Philosophy",
    description: "How real coaching systems are built, compared honestly against each other.",
    topicSlugs: [
      "coaching-library",
      "training-philosophy",
      "workout-library",
      "athlete-library",
      "for-coaches",
    ],
  },
];
