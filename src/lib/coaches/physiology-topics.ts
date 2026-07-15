// Canonical hrefs for the "Physiological Model" section of a coach page --
// shared across all seven coaches AND every Athlete Library page (see
// Athlete.physiologicalEmphasis in lib/athletes/types.ts) so a link only
// ever needs correcting in one place. Anchors are only used where a heading
// with that exact text really exists on the target page (confirmed against
// sections.ts); every other topic links to the page itself rather than a
// guessed fragment.
export const PHYSIOLOGY_TOPICS: Record<string, { label: string; href: string }> = {
  aerobicBase: { label: "Aerobic Base", href: "/exercise-physiology" },
  vo2max: {
    label: "VO₂ Max",
    href: "/exercise-physiology#vo2-max-is-two-adaptations-sharing-one-name",
  },
  lactateThreshold: { label: "Lactate Threshold", href: "/exercise-physiology" },
  runningEconomy: { label: "Running Economy", href: "/exercise-physiology" },
  neuromuscularPower: {
    label: "Neuromuscular Power",
    href: "/exercise-physiology#reversing-the-size-principle-why-hills-and-heavy-lifting-work",
  },
  fatigueResistance: {
    label: "Fatigue Resistance",
    href: "/exercise-physiology#central-vs-peripheral-fatigue-when-the-muscle-itself-gives-out",
  },
  mentalPerformance: { label: "Mental Performance", href: "/sports-psychology" },
  fueling: { label: "Fueling", href: "/nutrition-and-fueling" },
  biomechanics: { label: "Biomechanics & Form", href: "/exercise-physiology" },
};
