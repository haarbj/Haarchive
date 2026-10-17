// Strength training content -- Item 30's four options (see
// advanced-techniques.ts, which carries the eligibility/advisory copy for
// this same framework), written out here as real, assignable exercise
// content: named movements with reps and a real weekly progression, not
// just a description of what the option is.
//
// The two FOUNDATION routines (modified pedestal, hip stability) are a
// verbatim transcription of Table 49.1, "The modified pedestal and hip
// strength routines" (Marathon Excellence for Everyone, Ch. 49) -- every
// exercise name, the frequency/execution/equipment guidance, and the
// week-by-week rep progression are the source table's own content, not
// original copy (unlike the three performance-option sessions below,
// which remain original). Transcribed, not parsed out of an image at
// runtime, for the same reason the recovery program and the frameworks
// keep their own transcriptions in typed data rather than re-deriving
// them: a wrong transcription would put the wrong routine in front of an
// athlete, silently.
//
// See strength-scheduling.ts for how these get placed onto a generated
// program's real calendar days, and for how the week-by-week progression
// below gets resolved against a specific calendar week.

import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PhaseFamily } from "@/lib/private-coaching/adjustment-playbook";

export type StrengthExercise = {
  name: string;
  /** Only when an exercise needs something beyond the routine's own uniform rep count -- e.g. Glute bridge's hold-based "rep," Monster walk's equipment. */
  note?: string;
};

/**
 * One tier of a routine's week-by-week rep progression. `fromWeek` is the
 * first week this tier applies to; it keeps applying through every later
 * week until a tier with a higher `fromWeek` takes over -- so the table's
 * own "Weeks 3+" / "Weeks 4+" language is the LAST entry in this array,
 * not a special case.
 */
export type StrengthProgressionTier = {
  fromWeek: number;
  reps: string;
};

export type StrengthRoutine = {
  key: "pedestal" | "hip-stability";
  name: string;
  /** Verbatim from the table, e.g. "5-6 times per week, immediately following a run." */
  frequency: string;
  /** Verbatim from the table, e.g. "All exercises performed quickly at high intensity, while maintaining control and stability." */
  execution: string;
  /** Null when the table specifies none (pedestal). Verbatim otherwise. */
  equipment: string | null;
  exercises: StrengthExercise[];
  /** Ordered by `fromWeek`, ascending -- resolveWeeklyReps assumes this. */
  progression: StrengthProgressionTier[];
};

export const PEDESTAL_ROUTINE: StrengthRoutine = {
  key: "pedestal",
  name: "Modified pedestal routine",
  frequency: "5-6 times per week, immediately following a run.",
  execution: "All exercises performed quickly at high intensity, while maintaining control and stability.",
  equipment: null,
  exercises: [
    { name: "Front plank with leg lift" },
    { name: "Flutter kick on back" },
    { name: "Pushup stance with leg lift" },
    { name: "Back pushup stance with slightly bent knees, leg lift" },
    { name: "Side plank, single leg lift" },
    { name: "Straight-arm side plank with leg lift" },
    { name: "Compact front plank hip extension" },
    { name: "Compact back plank hip flexion" },
    { name: "Legs-up crunch" },
    { name: "Bicycle crunch" },
  ],
  progression: [
    { fromWeek: 1, reps: "7 reps" },
    { fromWeek: 2, reps: "8 reps" },
    { fromWeek: 3, reps: "10 reps" },
  ],
};

export const HIP_STABILITY_ROUTINE: StrengthRoutine = {
  key: "hip-stability",
  name: "Hip stability routine",
  frequency: "6-7 days per week, following a run and following the pedestal routine.",
  execution: "All exercises performed slowly and with a moderate range of motion.",
  equipment: "Elastic resistance band required -- no other specialized equipment.",
  exercises: [
    { name: "Side leg lift" },
    { name: "Clamshell leg lift" },
    { name: "Glute bridge", note: "1 rep = 1.5 second hold" },
    { name: "Monster walk", note: "resistance band around knees" },
  ],
  progression: [
    { fromWeek: 1, reps: "30 reps" },
    { fromWeek: 2, reps: "40 reps" },
    { fromWeek: 3, reps: "2 x 30 reps" },
    { fromWeek: 4, reps: "2 x 40 reps" },
  ],
};

export const FOUNDATION_ROUTINES: StrengthRoutine[] = [PEDESTAL_ROUTINE, HIP_STABILITY_ROUTINE];

/**
 * The rep count that applies at a given 1-indexed week of this routine's
 * own placement (week 1 = the first calendar week it's scheduled on, not
 * necessarily the program's own week 1 -- see strength-scheduling.ts).
 * Picks the last tier whose `fromWeek` is `<= week`; a week before the
 * first tier (shouldn't happen, since every routine's first tier starts
 * at week 1) falls back to that first tier rather than producing no reps
 * at all.
 */
export function resolveWeeklyReps(progression: StrengthProgressionTier[], week: number): string {
  let current = progression[0];
  for (const tier of progression) {
    if (tier.fromWeek <= week) current = tier;
  }
  return current.reps;
}

function exerciseLine(exercise: StrengthExercise, reps: string): string {
  return exercise.note ? `${exercise.name} — ${reps} (${exercise.note})` : `${exercise.name} — ${reps}`;
}

export function routineToExtra(routine: StrengthRoutine, week: number): WorkoutExtraInput {
  const reps = resolveWeeklyReps(routine.progression, week);
  const overview = [`${routine.name}.`, routine.frequency, routine.execution, routine.equipment].filter(Boolean).join(" ");
  return {
    kind: "Strength",
    overview,
    count: null,
    distanceM: null,
    durationS: null,
    items: routine.exercises.map((exercise) => exerciseLine(exercise, reps)),
  };
}

// Heavy lifting's own two movements, loaded differently in general versus
// supportive/specific -- see advanced-techniques.ts's STRENGTH_OPTIONS
// entry for the reasoning (always after the run, build in general,
// maintain at 60-70% once supportive or specific work begins).
export function heavyLiftingExtra(family: PhaseFamily): WorkoutExtraInput {
  const maintaining = family === "supportive" || family === "specific";
  return {
    kind: "Strength",
    overview: maintaining
      ? "Heavy lifting (maintenance load) -- calves and quads, compound movements, after today's run, never before it. Volume is deliberately reduced here to maintain what the general phase already built, not add to it."
      : "Heavy lifting -- calves and quads, compound movements, after today's run, never before it.",
    count: null,
    distanceM: null,
    durationS: null,
    items: maintaining
      ? [
          "Back squat or goblet squat — 1-2 sets x 4 reps at roughly 60-70% of the general-phase load, same full depth and control on the way down.",
          "Straight-leg calf raise — 1-2 sets x 4 reps at the same reduced load, pausing at the top rather than bouncing through the stretch.",
          "The goal here is maintaining strength already built, not adding more -- stop well short of a true grinding last rep.",
        ]
      : [
          "Back squat or goblet squat — 2-3 sets x 4 reps, heavy enough that the last rep is genuinely hard, full depth with control on the way down.",
          "Straight-leg calf raise — 2-3 sets x 4 reps, pausing at the top rather than bouncing through the stretch at the bottom.",
          "Rest 2-3 minutes between sets -- this is a strength session, not a conditioning one.",
        ],
  };
}

export function plyometricsExtra(): WorkoutExtraInput {
  return {
    kind: "Strength",
    overview:
      "Plyometrics -- maximum height, minimum ground contact time, after today's run. The highest injury risk of the three performance options, so build the volume up slowly across weeks rather than treating any single session as the test.",
    count: null,
    distanceM: null,
    durationS: null,
    items: [
      "Low pogo hops — 2 sets x 8-10 reps, minimum ground contact; let the ankle do the rebounding rather than sinking into the knees.",
      "Bounding (3-5 strides) — 2 sets x 6-8 reps, maximum height off each stride rather than maximum distance covered.",
      "Tuck jumps on open, flat ground — 1-2 sets x 5-6 reps, land soft and quiet; a loud landing is the signal to stop the set, not to push for one more.",
    ],
  };
}

export function hillSprintsExtra(): WorkoutExtraInput {
  return {
    kind: "Hill Sprints",
    overview:
      "Hill sprints -- the most running-specific of the three performance options, after today's easy run. Minimal soreness, usable in any phase, year-round.",
    count: null,
    distanceM: null,
    durationS: null,
    items: [
      "10-second maximal effort uphill, 5%+ grade — 4-6 reps, full recovery walk back down between reps.",
      "Run relaxed through the shoulders even at full effort -- tension in the upper body is wasted energy, not extra speed.",
      "Stop at the first sign of hamstring tightness; these are sprints, not a test of how many can be ground out.",
    ],
  };
}
