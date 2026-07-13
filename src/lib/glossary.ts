// A curated, hand-maintained list of recurring concepts that have a real,
// dedicated home elsewhere on the site. Deliberately NOT heuristic/NLP --
// only terms listed here ever get auto-linked, and each points at a page or
// anchor that genuinely explains the term, not just mentions it in passing.
//
// To add one: find the section/heading that actually defines the concept,
// confirm its anchor id (headingId() of the exact heading text, see
// src/lib/heading-id.ts), and add an entry. aliases are the literal strings
// to match in prose (case-insensitive); the original casing found in the
// text is preserved when rendering the link.
export type GlossaryTerm = {
  id: string;
  aliases: string[];
  href: string;
};

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "lactate-threshold",
    aliases: ["lactate threshold heart rate", "lactate threshold", "anaerobic threshold"],
    href: "/workout-library#five-training-zones-anchored-to-one-number",
  },
  {
    id: "muscle-tone",
    aliases: ["muscle tone"],
    href: "/exercise-physiology#muscle-tone-elasticity-and-stiffness-defined",
  },
  {
    id: "double-threshold",
    aliases: ["double threshold training", "double threshold"],
    href: "/coaching-library#norwegian-threshold-training-living-at-the-edge-of-the-threshold",
  },
  {
    id: "cardiac-drift",
    aliases: ["cardiac drift"],
    href: "/data-and-analytics#cardiac-drift-what-a-rising-heart-rate-at-a-held-pace-actually-means",
  },
  {
    id: "vo2-max",
    aliases: ["VO2 max", "VO2max", "VO₂ max", "VO₂max"],
    href: "/exercise-physiology",
  },
  {
    id: "running-economy",
    aliases: ["running economy"],
    href: "/research-library#don-t-fix-your-form-run-more-and-let-it-fix-itself",
  },
  {
    id: "glycogen-depletion",
    aliases: ["glycogen depletion", "glycogen depleted"],
    href: "/research-library#why-long-slow-runs-fatigue-you-in-a-way-sprints-don-t",
  },
  {
    id: "glycogen",
    aliases: ["glycogen"],
    href: "/nutrition-and-fueling#how-much-carbohydrate-a-session-actually-needs",
  },
  {
    id: "periodization",
    aliases: ["periodization", "periodized"],
    href: "/coaching-library#the-pyramid",
  },
  {
    id: "red-s",
    aliases: ["RED-S", "Relative Energy Deficiency in Sport"],
    href: "/recovery#relative-energy-deficiency-in-sport-red-s",
  },
  {
    id: "super-compensation",
    aliases: ["super-compensation", "supercompensation"],
    href: "/training-philosophy#why-response-regulated-recovery-actually-works",
  },
  {
    id: "altitude-training",
    aliases: ["altitude training"],
    href: "/coaching-library#joe-vigil-altitude-biomechanics-and-the-whole-athlete",
  },
  {
    id: "eighty-twenty",
    aliases: ["80/20 Rule", "80/20 rule"],
    href: "/coaching-library#polarized-training-80-20-the-one-i-lean-on-most",
  },
  {
    id: "polarized-training",
    aliases: ["polarized training"],
    href: "/research-library#polarized-training-what-elite-endurance-athletes-actually-do",
  },
  {
    id: "carb-loading",
    aliases: ["carb loading", "carb-loading"],
    href: "/nutrition-and-fueling#carb-loading-before-a-long-race",
  },
  {
    id: "talk-test",
    aliases: ["talk test"],
    href: "/data-and-analytics#two-diy-ways-to-find-your-threshold",
  },
  {
    id: "gut-training",
    aliases: ["gut training"],
    href: "/nutrition-and-fueling#gut-training-is-a-real-trainable-skill",
  },
  {
    id: "central-governor",
    aliases: ["central governor"],
    href: "/exercise-physiology#what-actually-limits-endurance-two-competing-models",
  },
  {
    id: "psychobiological-model",
    aliases: ["psychobiological model"],
    href: "/exercise-physiology#what-actually-limits-endurance-two-competing-models",
  },
  {
    id: "perceived-effort",
    aliases: ["perceived effort"],
    href: "/exercise-physiology#what-actually-limits-endurance-two-competing-models",
  },
  {
    id: "perceived-exertion",
    aliases: ["rate of perceived exertion", "perceived exertion", "RPE"],
    href: "/research-library#rating-of-perceived-exertion-the-borg-scale",
  },
  {
    id: "il-6",
    aliases: ["interleukin-6", "IL-6"],
    href: "/research-library#why-long-slow-runs-fatigue-you-in-a-way-sprints-don-t",
  },
  {
    id: "cardiac-lag",
    aliases: ["cardiac lag"],
    href: "/data-and-analytics#why-heart-rate-misleads-on-short-hard-efforts",
  },
  {
    id: "vdot",
    aliases: ["VDOT"],
    href: "/coaching-library#jack-daniels-precision-through-pace-zones",
  },
  {
    id: "steady-state",
    aliases: ["Steady State"],
    href: "/exercise-physiology#steady-state-and-oxygen-debt",
  },
  {
    id: "oxygen-debt",
    aliases: ["oxygen debt"],
    href: "/exercise-physiology#steady-state-and-oxygen-debt",
  },
  {
    id: "capillary-density",
    aliases: ["capillary density", "capillary beds", "capillaries"],
    href: "/the-aerobic-base",
  },
  {
    id: "mitochondria",
    aliases: ["mitochondria", "mitochondrial"],
    href: "/the-aerobic-base",
  },
  {
    id: "flow-state",
    aliases: ["flow state"],
    href: "/sports-psychology#letting-go-of-the-outcome",
  },
  {
    id: "hyponatremia",
    aliases: ["hyponatremia"],
    href: "/nutrition-and-fueling#sodium-is-the-electrolyte-that-actually-matters",
  },
  {
    id: "size-principle",
    aliases: ["size principle"],
    href: "/exercise-physiology#the-size-principle-why-easy-running-never-touches-your-fastest-fibers",
  },
  {
    id: "alactic",
    aliases: ["alactic"],
    href: "/exercise-physiology#three-fiber-types-three-different-jobs",
  },
  {
    id: "glycolytic",
    aliases: ["glycolytic"],
    href: "/exercise-physiology#three-fiber-types-three-different-jobs",
  },
  {
    id: "voluntary-activation",
    aliases: ["voluntary activation"],
    href: "/exercise-physiology#central-vs-peripheral-fatigue-when-the-muscle-itself-gives-out",
  },
  {
    id: "critical-power",
    aliases: ["critical power", "critical velocity"],
    href: "/data-and-analytics#critical-power-a-sharper-ceiling-than-lactate-threshold",
  },
  {
    id: "pain-tolerance",
    aliases: ["pain tolerance"],
    href: "/sports-psychology#tolerance-for-suffering-is-a-trainable-skill",
  },
  {
    id: "belief-effects",
    aliases: ["belief effects"],
    href: "/sports-psychology#belief-effects-the-real-science-of-placebo-in-sport",
  },
  {
    id: "plasma-osmolality",
    aliases: ["plasma osmolality"],
    href: "/nutrition-and-fueling#what-the-body-actually-monitors-isn-t-water-volume",
  },
];
