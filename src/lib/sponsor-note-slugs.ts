// Which public section pages carry the CRÜ Optics sponsor note (rendered
// below the main content via sponsor-note.tsx, from [slug]/page.tsx).
//
// Scoped deliberately narrower than "every public page." CLAUDE.md's own
// hard rule is that editorial pages never sell while tools/account pages
// always offer a next step (§2) -- a product endorsement on every
// educational essay, including sports psychology, goal setting, or
// training philosophy, would read as the archive monetizing attention
// rather than a note genuinely tied to running outdoors in the sun. This
// list includes every tool/calculator (tools already carry CTAs by design)
// plus only the practice/physiology essays where outdoor running
// conditions are substantively part of the content.
//
// Deliberately excluded: the Psychology category, the Philosophy category,
// the Library/archive category (articles, resources, contact), and the
// coaching-library/athlete-library/training-plans pages -- the site's most
// "pure research" surfaces, where this note would do the most identity
// damage for the least topical connection to sunglasses.
export const SPONSOR_NOTE_SLUGS = new Set<string>([
  // Tools
  "heat-tracker",
  "heat-acclimation-planner",
  "pace-calculator",
  "environmental-calculator",
  "gap-calculator",
  "pace-percent-calculator",
  "cv-threshold-calculator",
  "race-pace-calculator",
  "hr-threshold-calculator",
  "training-load-planner",
  "tinman-calculator",
  "race-pace-planner",
  "course-comparator",
  "altitude-calculator",
  "fueling-calculator",
  "workout-builder",
  "choosing-a-pace-calculator",
  // Practice / physiology essays with a real outdoor-training connection
  "how-to-start-running",
  "marathon-training",
  "trail-and-ultra-training",
  "strength-training",
  "5k-training",
  "workout-library",
  "the-aerobic-base",
  "recovery",
  "what-a-race-result-can-tell-you",
  "nutrition-and-fueling",
  "training-across-the-menstrual-cycle",
  "pregnancy-and-postpartum-running",
  "training-through-the-decades",
]);
