// Seed data for the `topics` and `concepts` reference tables (Learning
// Progress, Phase 1). This file is the canonical, hand-maintained source
// of truth those tables are meant to mirror -- there is no automated seed
// script that reads it at build or deploy time (a real gap, found during
// the Phase 4 content-coverage expansion: editing this file alone doesn't
// touch the live database at all). Every addition here needs a matching
// hand-written `insert into public.concepts (...) select t.id, ... from
// public.topics t where t.slug = '...'` migration, mirroring the pattern
// in 20260813010000_learning_progress.sql -- the tables themselves, not
// this file, are what the app queries at runtime, since Concept/Topic ids
// need to be stable database UUIDs a learning_events row can reference.
//
// Topic = every real section in src/lib/sections.ts (minus "contact",
// which is a form, not learning content) -- a 1:1 mirror kept here rather
// than derived at build time so a topic's database id stays stable even if
// sections.ts's own array order or content changes.
//
// Concept = a durable idea that recurs across content, not a one-off
// article heading (a Concept is "VO2 Max," never "Racing the Last 2.5
// Miles"). Sourced only from two curated, already-vetted signals, per the
// feature's own instruction not to invent a new taxonomy from scratch:
//   1. src/lib/glossary.ts -- but only entries that define a genuine
//      recurring physiology/psychology/training concept, not the ones that
//      point at a coach/athlete bio page, a named coaching cue/quote
//      heading (e.g. "the-wheel", "racing-the-last-25"), or a page's own
//      self-link anchor (e.g. "sports-psychology-page") -- those are the
//      site's own "bad example" shape (a one-off heading), not a concept.
//   2. src/lib/coaches/physiology-topics.ts (PHYSIOLOGY_TOPICS) -- only
//      where it names something genuinely distinct from what glossary.ts
//      already covers (its own href is a page-level link, not an anchor,
//      for several keys that fully overlap an existing glossary concept --
//      those were skipped as duplicates, not re-added under a new slug).
//
// Coverage is intentionally uneven -- exercise-physiology and
// nutrition-and-fueling have many concepts because glossary.ts already has
// many precise, real anchors there; marathon-training has none yet because
// no curated term's real href actually lands on that page. That's a
// correct reflection of what's already curated, not a gap to paper over
// with an invented concept.

export type TopicSeed = {
  slug: string;
  title: string;
  categorySlug: string;
  sectionSlug: string;
};

export type ConceptSeed = {
  slug: string;
  title: string;
  topicSlug: string;
  // Matches a GlossaryTerm.id in src/lib/glossary.ts when one exists, so
  // the concept's real href only ever needs resolving in glossary.ts
  // itself. Null for the couple of PHYSIOLOGY_TOPICS-only concepts with no
  // matching glossary entry yet -- those fall back to linking the concept's
  // own topic page.
  glossaryTermId: string | null;
};

// One-to-one with sections.ts's `sections` array, minus "contact" (a
// contact form, not learning content). `slug` doubles as `sectionSlug`
// today -- kept as two separate columns in the database (not one) so a
// future content rename can repoint sectionSlug without breaking the
// stable identifier a learning_events row already references.
export const TOPIC_SEEDS: TopicSeed[] = [
  { slug: "how-to-start-running", title: "How to Start Running", categorySlug: "getting-started", sectionSlug: "how-to-start-running" },
  { slug: "training-philosophy", title: "Training Philosophy", categorySlug: "foundations", sectionSlug: "training-philosophy" },
  { slug: "the-philosophy-of-running", title: "The Philosophy of Running", categorySlug: "foundations", sectionSlug: "the-philosophy-of-running" },
  { slug: "exercise-physiology", title: "Exercise Physiology", categorySlug: "the-science", sectionSlug: "exercise-physiology" },
  { slug: "the-aerobic-base", title: "The Aerobic Base", categorySlug: "the-science", sectionSlug: "the-aerobic-base" },
  { slug: "research-library", title: "Research Library", categorySlug: "the-science", sectionSlug: "research-library" },
  { slug: "data-and-analytics", title: "Data & Analytics", categorySlug: "the-science", sectionSlug: "data-and-analytics" },
  { slug: "what-a-race-result-can-tell-you", title: "What One Race Result Can (and Can't) Tell You", categorySlug: "the-science", sectionSlug: "what-a-race-result-can-tell-you" },
  { slug: "mostly-easy-genuinely-hard", title: "The Case for Mostly Easy, Genuinely Hard Training", categorySlug: "the-science", sectionSlug: "mostly-easy-genuinely-hard" },
  { slug: "coaching-library", title: "Coaching Library", categorySlug: "coaching-and-training", sectionSlug: "coaching-library" },
  { slug: "athlete-library", title: "Athlete Library", categorySlug: "coaching-and-training", sectionSlug: "athlete-library" },
  { slug: "marathon-training", title: "Marathon Training", categorySlug: "coaching-and-training", sectionSlug: "marathon-training" },
  { slug: "workout-library", title: "Workout Library", categorySlug: "coaching-and-training", sectionSlug: "workout-library" },
  { slug: "trail-and-ultra-training", title: "Trail & Ultra Running", categorySlug: "coaching-and-training", sectionSlug: "trail-and-ultra-training" },
  { slug: "strength-training", title: "Strength Training for Runners", categorySlug: "coaching-and-training", sectionSlug: "strength-training" },
  { slug: "5k-training", title: "5K Training", categorySlug: "coaching-and-training", sectionSlug: "5k-training" },
  { slug: "training-plans", title: "Training Plans", categorySlug: "coaching-and-training", sectionSlug: "training-plans" },
  { slug: "nutrition-and-fueling", title: "Nutrition & Fueling", categorySlug: "recovery-and-fueling", sectionSlug: "nutrition-and-fueling" },
  { slug: "recovery", title: "Recovery", categorySlug: "recovery-and-fueling", sectionSlug: "recovery" },
  { slug: "training-across-the-menstrual-cycle", title: "Training Across the Menstrual Cycle", categorySlug: "recovery-and-fueling", sectionSlug: "training-across-the-menstrual-cycle" },
  { slug: "pregnancy-and-postpartum-running", title: "Pregnancy and Postpartum Running", categorySlug: "recovery-and-fueling", sectionSlug: "pregnancy-and-postpartum-running" },
  { slug: "training-through-the-decades", title: "Training Through the Decades", categorySlug: "recovery-and-fueling", sectionSlug: "training-through-the-decades" },
  { slug: "sports-psychology", title: "Sports Psychology", categorySlug: "mind-and-recovery", sectionSlug: "sports-psychology" },
  { slug: "goal-setting", title: "Goal Setting & Identity", categorySlug: "mind-and-recovery", sectionSlug: "goal-setting" },
  { slug: "self-talk", title: "Self-Talk & Mental Technique", categorySlug: "mind-and-recovery", sectionSlug: "self-talk" },
  { slug: "daily-practice", title: "Consistency & Daily Practice", categorySlug: "mind-and-recovery", sectionSlug: "daily-practice" },
  { slug: "performing-under-pressure", title: "Performing Under Pressure", categorySlug: "mind-and-recovery", sectionSlug: "performing-under-pressure" },
  { slug: "for-coaches", title: "For Coaches", categorySlug: "mind-and-recovery", sectionSlug: "for-coaches" },
  { slug: "articles", title: "Articles", categorySlug: "writing-and-resources", sectionSlug: "articles" },
  { slug: "resources", title: "Resources", categorySlug: "writing-and-resources", sectionSlug: "resources" },
  { slug: "choosing-a-pace-calculator", title: "Which Pace Calculator Should I Use?", categorySlug: "tools", sectionSlug: "choosing-a-pace-calculator" },
  { slug: "heat-tracker", title: "Heat Tracker", categorySlug: "tools", sectionSlug: "heat-tracker" },
  { slug: "pace-calculator", title: "Pace & Heart Rate Calculator", categorySlug: "tools", sectionSlug: "pace-calculator" },
  { slug: "environmental-calculator", title: "Environmental Performance Calculator", categorySlug: "tools", sectionSlug: "environmental-calculator" },
  { slug: "gap-calculator", title: "GAP Calculator", categorySlug: "tools", sectionSlug: "gap-calculator" },
  { slug: "pace-percent-calculator", title: "Pace Percent Calculator", categorySlug: "tools", sectionSlug: "pace-percent-calculator" },
  { slug: "cv-threshold-calculator", title: "Threshold, CV & VO2 Max Pace Calculator", categorySlug: "tools", sectionSlug: "cv-threshold-calculator" },
  { slug: "race-pace-calculator", title: "Race Pace Calculator", categorySlug: "tools", sectionSlug: "race-pace-calculator" },
  { slug: "hr-threshold-calculator", title: "LT1 & LT2 Heart Rate Reference Ranges", categorySlug: "tools", sectionSlug: "hr-threshold-calculator" },
  { slug: "tinman-calculator", title: "Tinman Running Calculator", categorySlug: "tools", sectionSlug: "tinman-calculator" },
  { slug: "marathon-pacing-calculator", title: "Marathon Pacing Calculator", categorySlug: "tools", sectionSlug: "marathon-pacing-calculator" },
  { slug: "altitude-calculator", title: "Altitude Calculator", categorySlug: "tools", sectionSlug: "altitude-calculator" },
];

// ~6-8 "high-value" topics get concept coverage first (exercise-physiology,
// the-aerobic-base, workout-library, marathon-training, sports-psychology,
// research-library, recovery, nutrition-and-fueling, per the feature spec)
// -- plus data-and-analytics and coaching-library and performing-under-
// pressure and goal-setting, which turned up their own real, precise
// glossary anchors along the way and were included on the same basis
// rather than arbitrarily excluded.
//
// Phase 4 (content coverage expansion): marathon-training, how-to-start-
// running, and training-philosophy each moved from zero concepts to a
// small, deliberately curated set -- every one grounded in that page's own
// existing prose, with a real, resolvable glossary.ts anchor (verified by
// direct grep against sections.ts for alias collisions before adding, not
// just theoretical uniqueness -- see glossary.ts's own comments on why
// several obvious-looking phrases were rejected in favor of a more
// distinctive one from the same heading). training-philosophy's two
// concepts required adding real `id` attributes to two of its own h3
// sub-headings (training-philosophy-page.tsx) that had none before -- the
// same anchor mechanism its h2s already used, not a new pattern.
export const CONCEPT_SEEDS: ConceptSeed[] = [
  // Exercise Physiology
  { slug: "vo2-max", title: "VO₂ Max", topicSlug: "exercise-physiology", glossaryTermId: "vo2-max" },
  { slug: "muscle-tone", title: "Muscle Tone & Stiffness", topicSlug: "exercise-physiology", glossaryTermId: "muscle-tone" },
  { slug: "central-governor", title: "Central Governor Model", topicSlug: "exercise-physiology", glossaryTermId: "central-governor" },
  { slug: "psychobiological-model", title: "Psychobiological Model", topicSlug: "exercise-physiology", glossaryTermId: "psychobiological-model" },
  { slug: "perceived-effort", title: "Perceived Effort", topicSlug: "exercise-physiology", glossaryTermId: "perceived-effort" },
  { slug: "steady-state", title: "Steady State", topicSlug: "exercise-physiology", glossaryTermId: "steady-state" },
  { slug: "oxygen-debt", title: "Oxygen Debt", topicSlug: "exercise-physiology", glossaryTermId: "oxygen-debt" },
  { slug: "size-principle", title: "The Size Principle", topicSlug: "exercise-physiology", glossaryTermId: "size-principle" },
  { slug: "fatigue-resistance", title: "Fatigue Resistance", topicSlug: "exercise-physiology", glossaryTermId: "voluntary-activation" },
  { slug: "muscle-fiber-types", title: "Muscle Fiber Types", topicSlug: "exercise-physiology", glossaryTermId: "alactic" },
  { slug: "neuromuscular-power", title: "Neuromuscular Power", topicSlug: "exercise-physiology", glossaryTermId: null },
  { slug: "biomechanics-form", title: "Biomechanics & Form", topicSlug: "exercise-physiology", glossaryTermId: null },

  // The Aerobic Base
  { slug: "super-compensation", title: "Supercompensation", topicSlug: "the-aerobic-base", glossaryTermId: "super-compensation" },
  { slug: "bonking", title: "Bonking", topicSlug: "the-aerobic-base", glossaryTermId: "bonking" },
  { slug: "capillary-density", title: "Capillary Density", topicSlug: "the-aerobic-base", glossaryTermId: "capillary-density" },
  { slug: "mitochondria", title: "Mitochondrial Density", topicSlug: "the-aerobic-base", glossaryTermId: "mitochondria" },

  // Data & Analytics
  { slug: "cardiac-drift", title: "Cardiac Drift", topicSlug: "data-and-analytics", glossaryTermId: "cardiac-drift" },
  { slug: "talk-test", title: "The Talk Test", topicSlug: "data-and-analytics", glossaryTermId: "talk-test" },
  { slug: "cardiac-lag", title: "Cardiac Lag", topicSlug: "data-and-analytics", glossaryTermId: "cardiac-lag" },
  { slug: "critical-power", title: "Critical Power", topicSlug: "data-and-analytics", glossaryTermId: "critical-power" },

  // Marathon Training
  { slug: "medium-long-run", title: "The Medium-Long Run", topicSlug: "marathon-training", glossaryTermId: "medium-long-run" },
  { slug: "marathon-pace-paradox", title: "The Marathon Pace Paradox", topicSlug: "marathon-training", glossaryTermId: "marathon-pace-paradox" },
  { slug: "buildup-cycle-length", title: "Buildup Cycle Length", topicSlug: "marathon-training", glossaryTermId: "buildup-cycle-length" },

  // How to Start Running
  { slug: "beginner-progression", title: "The Beginner Progression", topicSlug: "how-to-start-running", glossaryTermId: "beginner-progression" },
  { slug: "training-heart-rate-formula", title: "Training Heart Rate Formula", topicSlug: "how-to-start-running", glossaryTermId: "training-heart-rate-formula" },

  // Training Philosophy
  { slug: "individualization", title: "Individualization", topicSlug: "training-philosophy", glossaryTermId: "individualization" },
  { slug: "consistency-beats-perfection", title: "Consistency Beats Perfection", topicSlug: "training-philosophy", glossaryTermId: "consistency-beats-perfection" },

  // Research Library
  { slug: "running-economy", title: "Running Economy", topicSlug: "research-library", glossaryTermId: "running-economy" },
  { slug: "glycogen-depletion", title: "Glycogen Depletion", topicSlug: "research-library", glossaryTermId: "glycogen-depletion" },
  { slug: "polarized-training", title: "Polarized Training", topicSlug: "research-library", glossaryTermId: "polarized-training" },
  { slug: "perceived-exertion", title: "Rating of Perceived Exertion", topicSlug: "research-library", glossaryTermId: "perceived-exertion" },
  { slug: "il-6", title: "IL-6", topicSlug: "research-library", glossaryTermId: "il-6" },

  // Coaching Library
  { slug: "double-threshold", title: "Double Threshold Training", topicSlug: "coaching-library", glossaryTermId: "double-threshold" },
  { slug: "periodization", title: "Periodization", topicSlug: "coaching-library", glossaryTermId: "periodization" },
  { slug: "vdot", title: "VDOT", topicSlug: "coaching-library", glossaryTermId: "vdot" },

  // Recovery
  { slug: "red-s", title: "RED-S", topicSlug: "recovery", glossaryTermId: "red-s" },

  // Nutrition & Fueling
  { slug: "glycogen", title: "Glycogen", topicSlug: "nutrition-and-fueling", glossaryTermId: "glycogen" },
  { slug: "carb-loading", title: "Carb Loading", topicSlug: "nutrition-and-fueling", glossaryTermId: "carb-loading" },
  { slug: "gut-training", title: "Gut Training", topicSlug: "nutrition-and-fueling", glossaryTermId: "gut-training" },
  { slug: "gi-distress", title: "GI Distress", topicSlug: "nutrition-and-fueling", glossaryTermId: "gi-distress" },
  { slug: "carbohydrate-oxidation", title: "Carbohydrate Oxidation", topicSlug: "nutrition-and-fueling", glossaryTermId: "carbohydrate-oxidation" },
  { slug: "hyponatremia", title: "Hyponatremia", topicSlug: "nutrition-and-fueling", glossaryTermId: "hyponatremia" },
  { slug: "plasma-osmolality", title: "Plasma Osmolality", topicSlug: "nutrition-and-fueling", glossaryTermId: "plasma-osmolality" },

  // Sports Psychology
  { slug: "pain-tolerance", title: "Tolerance for Suffering", topicSlug: "sports-psychology", glossaryTermId: "pain-tolerance" },
  { slug: "belief-effects", title: "Belief Effects", topicSlug: "sports-psychology", glossaryTermId: "belief-effects" },

  // Performing Under Pressure
  { slug: "flow-state", title: "Flow State", topicSlug: "performing-under-pressure", glossaryTermId: "flow-state" },
  { slug: "curse-of-perfection", title: "The Curse of Perfection", topicSlug: "performing-under-pressure", glossaryTermId: "curse-of-perfection" },

  // Goal Setting & Identity
  { slug: "curse-of-talent", title: "The Curse of Talent", topicSlug: "goal-setting", glossaryTermId: "curse-of-talent" },

  // Workout Library
  { slug: "lactate-threshold", title: "Lactate Threshold", topicSlug: "workout-library", glossaryTermId: "lactate-threshold" },
  { slug: "advanced-periodization", title: "Advanced Periodization", topicSlug: "workout-library", glossaryTermId: "advanced-periodization" },
  { slug: "matching-interval-pace", title: "Matching Interval Pace to Fitness", topicSlug: "workout-library", glossaryTermId: "matching-interval-pace" },
];
