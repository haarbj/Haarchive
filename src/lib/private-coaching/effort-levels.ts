// The effort vocabulary an athlete picks from when logging a workout,
// plus the RPE anchors shown beside it.
//
// Its own module rather than part of athlete-education.ts specifically so
// the client-side completion form can import it without pulling in every
// guide's prose: athlete-education.ts builds its workout-types content at
// module scope, so importing anything from it drags the whole education
// library into that bundle. The pacing guide imports these from here, so
// the words the form offers and the words the guide explains still cannot
// drift apart.

export type EffortLevelOption = {
  value: string;
  label: string;
  feel: string;
};

export const EFFORT_LEVELS: EffortLevelOption[] = [
  {
    value: "very-easy",
    label: "Very easy",
    feel: "Conversational without thinking about it. You could do this all day and finish feeling better than you started.",
  },
  { value: "easy", label: "Easy", feel: "Full sentences, no strain. Breathing is noticeable but never a factor." },
  {
    value: "moderate",
    label: "Moderate",
    feel: "Comfortably working. Talking is possible but you would rather not. Still clearly sustainable for a long time.",
  },
  {
    value: "high-end-aerobic",
    label: "High-end aerobic",
    feel: "Strong and controlled, roughly where a marathon lives. A few words at a time. You could hold it a lot longer than you are being asked to.",
  },
  {
    value: "steady-state-max",
    label: "At steady-state max",
    feel: "The fastest you could hold for about an hour. Focused, rhythmic, and right at the edge of sustainable.",
  },
  {
    value: "above-steady-state",
    label: "Above steady-state max",
    feel: "Metrics are climbing on their own and the clock starts to matter. Sustainable for minutes, not an hour.",
  },
  { value: "5k-effort", label: "5K effort or harder", feel: "Racing. Nothing in reserve by the end of the repeat." },
];

export const EFFORT_LEVEL_VALUES = EFFORT_LEVELS.map((level) => level.value);

export function effortLevelLabel(value: string | null): string | null {
  if (!value) return null;
  return EFFORT_LEVELS.find((level) => level.value === value)?.label ?? value;
}

// An unanchored 1-10 scale drifts: one athlete's 8 is another's 6, and the
// coach is reading these across a whole roster over months.
export const RPE_ANCHOR_TEXT =
  "1 is barely moving, 10 is an all-out race. Most workouts land between 6 and 8. A 9 should be occasional. Save 10 for races.";
