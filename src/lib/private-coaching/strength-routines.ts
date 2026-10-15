// Strength training content -- Item 30's four options (see
// advanced-techniques.ts, which carries the eligibility/advisory copy for
// this same framework), written out here as real, assignable exercise
// content: named movements with sets, reps, and a form cue, not just a
// description of what the option is.
//
// The two FOUNDATION routines (modified pedestal, hip stability) are the
// complete, no-equipment, minimal-time base every athlete gets by
// default. The three performance-option sessions (heavy lifting,
// plyometrics, hill sprints) are shorter, named-movement lists in the
// same shape, meant to be read by the athlete as real instructions, not
// just a label on the calendar.
//
// All copy below is original -- no text lifted from any coaching book or
// published routine. See strength-scheduling.ts for how these get placed
// onto a generated program's real calendar days.

import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PhaseFamily } from "@/lib/private-coaching/adjustment-playbook";

export type StrengthExercise = {
  name: string;
  setsReps: string;
  cue: string;
};

export type StrengthRoutine = {
  key: "pedestal" | "hip-stability";
  name: string;
  /** Why this fits the brief: no equipment, minimal time, never impairs the next day's run. */
  summary: string;
  exercises: StrengthExercise[];
};

export const PEDESTAL_ROUTINE: StrengthRoutine = {
  key: "pedestal",
  name: "Modified pedestal routine",
  summary:
    "A short core and trunk-stability circuit, no equipment, about eight minutes. Isometric holds and slow, controlled reps only -- nothing here should leave the legs fatigued for tomorrow's run.",
  exercises: [
    {
      name: "Dead bug",
      setsReps: "2 sets x 8 reps per side",
      cue: "Press your lower back flat into the floor before you move either limb; the hold flattens out the moment your back arches, so that's the real signal to stop the set.",
    },
    {
      name: "Forearm plank",
      setsReps: "2 sets x 20-30 sec",
      cue: "Squeeze the glutes and pull the ribs down so the hips can't sag. End the set the moment they do rather than fighting to hold the position with the low back instead of the core.",
    },
    {
      name: "Side plank",
      setsReps: "2 sets x 15-20 sec per side",
      cue: "Stack the hips directly over each other. A slight forward lean of the top hip is the most common break in form here -- check for it, don't just hold the shape.",
    },
    {
      name: "Glute bridge hold",
      setsReps: "2 sets x 20 sec",
      cue: "Drive through the heels, not the toes, and pause at the top where hips, knees, and shoulders are level.",
    },
    {
      name: "Bird dog",
      setsReps: "2 sets x 6 reps per side",
      cue: "Move the opposite arm and leg together, slowly, keeping the hips square to the floor the whole time -- a rotating hip means the reach has gone further than the core can control.",
    },
    {
      name: "Superman hold",
      setsReps: "2 sets x 15 sec",
      cue: "Lift chest and legs only a few inches off the floor. Height isn't the point; an even, controlled lift through the whole spine is.",
    },
  ],
};

export const HIP_STABILITY_ROUTINE: StrengthRoutine = {
  key: "hip-stability",
  name: "Hip stability routine",
  summary:
    "A short hip abductor and external-rotator circuit, no equipment, about eight minutes. Targets the muscles that keep the knee tracking straight over a full run, the usual gap a pure core routine leaves open.",
  exercises: [
    {
      name: "Clamshells",
      setsReps: "2 sets x 12 per side",
      cue: "Keep the feet together and rotate from the hip, not the low back. A hip that rocks backward during the lift means the range has gone too far.",
    },
    {
      name: "Side-lying leg raise",
      setsReps: "2 sets x 10 per side",
      cue: "Lead with the heel, not the toe, to keep the hip from rotating open as the leg lifts.",
    },
    {
      name: "Standing hip abduction",
      setsReps: "2 sets x 10 per side",
      cue: "Stand tall against a wall or doorframe for balance and lift straight out to the side. Leaning the torso away to gain extra height is the leak to watch for.",
    },
    {
      name: "Single-leg glute bridge",
      setsReps: "2 sets x 8 per side",
      cue: "Keep the raised knee stacked over the opposite knee and drive the working heel straight down. A hip that drops on the lifted side means that side's set is done.",
    },
    {
      name: "Lateral lunge walk",
      setsReps: "2 sets x 10 steps per side",
      cue: "Push the hips back and down into each step rather than just stepping sideways -- it should feel like the outer hip of the trailing leg is doing the work, not the front knee.",
    },
    {
      name: "Single-leg balance reach",
      setsReps: "2 sets x 6 reaches per side",
      cue: "Reach the free leg and both hands toward one spot on the floor, barely touching down. A wobbling stance leg is the point of the drill, not a sign it's going wrong.",
    },
  ],
};

export const FOUNDATION_ROUTINES: StrengthRoutine[] = [PEDESTAL_ROUTINE, HIP_STABILITY_ROUTINE];

function exerciseLine(exercise: StrengthExercise): string {
  return `${exercise.name} — ${exercise.setsReps} — ${exercise.cue}`;
}

export function routineToExtra(routine: StrengthRoutine): WorkoutExtraInput {
  return {
    kind: "Strength",
    overview: `${routine.name}. ${routine.summary}`,
    count: null,
    distanceM: null,
    durationS: null,
    items: routine.exercises.map(exerciseLine),
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
