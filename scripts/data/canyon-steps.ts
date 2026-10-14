// Structured (warmup/main-reps/cooldown) steps for the Canyon Framework's
// real interval/steady-state/progression/marathon-pace days -- see
// canyon-program.ts for the day-level data (dayLabel, plannedDistanceM,
// notes) this attaches to. Every value below is read directly off that
// same source table/PDF text (canyon-program.ts's own header comment); no
// distance, rep count, or percent here is invented -- see each entry's
// inline comment quoting the exact source note it was built from.
//
// Conventions used throughout (documented once, here, rather than repeated
// per entry):
// - Distances in meters (Math.round(mi * 1609.344) / Math.round(km * 1000)),
//   matching canyon-program.ts's own day-level precision.
// - Durations in seconds.
// - A plain "wu"/"cd" with no further qualifier is NOT a fabricated precise
//   number -- it's the implicit Easy-pace band (50-60% of 5K pace) from the
//   pace-zone table Brody supplied, the same table General-phase notes like
//   Week 1's own "easy progressing to moderate" callout describe directly
//   ("~50-60% 5k pace" for easy, "~65-75% 5k pace" for moderate). A "very
//   easy" cooldown (Supportive Week 2's alternating-Ks day) uses the
//   corresponding Very Easy band (<50%, modeled here as 40-50%, since the
//   table gives an upper bound only and a step's own pace-percent range
//   requires two bounds -- see StepInput's own comment).
// - A "progressive" warmup or a Kenyan-style progression run's own main
//   effort is deliberately left with an OPEN target (no fixed percent):
//   the whole point of a progression is that it isn't one pace, and the
//   source notes never give it a single percent figure the way every
//   interval/steady-state session does.
// - A plain "w/ N min jog" or "w/ N sec walk" recovery with no pace or
//   distance language of its own is folded into the interval step's own
//   restS/restMaxS field, not a separate step row -- that's exactly what
//   those columns are for. A recovery that DOES carry its own explicit
//   pace or distance target (a "float recovery" kilometer at a stated
//   percent, e.g. Supportive's "1 km at 85% MP") is its own separate
//   "recovery"-type step instead, since restS alone can't carry a pace.
// - A multi-segment workout with genuinely different paces per segment
//   (Specific Week 1's 6/5/5/3-4 mi marathon-simulation long run, Specific
//   Week 2's 5-4-3-2-1 km pyramid) is modeled as a sequence of single-rep
//   "interval" steps, one per distinct segment, in the order the source
//   describes them -- the most faithful structural fit this schema offers
//   for "several different paces within one continuous session," short of
//   a step type this schema doesn't have.
// - A nested "N sets of (M reps ...)" structure (General Week 6's "2 sets
//   of 6 x 500m") is folded into one interval step with reps = sets x reps
//   -- the schema has no nested-set concept -- with the between-set detail
//   preserved in that step's own instructions text instead of silently
//   dropped.

import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";

export type CanyonStepInput = {
  stepType: "warmup" | "main" | "interval" | "recovery" | "cooldown";
  distanceM: number | null;
  distanceMaxM: number | null;
  durationS: number | null;
  durationMaxS: number | null;
  targetType: "pace" | "open";
  targetPacePercentBasis: PaceReferenceKey | null;
  targetPacePercentMin: number | null;
  targetPacePercentMax: number | null;
  repetitions: number | null;
  repetitionsMax: number | null;
  restS: number | null;
  restMaxS: number | null;
  instructions: string | null;
};

function s(overrides: Partial<CanyonStepInput> & Pick<CanyonStepInput, "stepType">): CanyonStepInput {
  return {
    distanceM: null,
    distanceMaxM: null,
    durationS: null,
    durationMaxS: null,
    targetType: "open",
    targetPacePercentBasis: null,
    targetPacePercentMin: null,
    targetPacePercentMax: null,
    repetitions: null,
    repetitionsMax: null,
    restS: null,
    restMaxS: null,
    instructions: null,
    ...overrides,
  };
}

// Shorthand for the two most common step shapes below.
function easyLeg(stepType: "warmup" | "cooldown" | "recovery", distanceM: number): CanyonStepInput {
  return s({ stepType, distanceM, targetType: "pace", targetPacePercentBasis: "5k", targetPacePercentMin: 50, targetPacePercentMax: 60 });
}
function veryEasyLeg(stepType: "warmup" | "cooldown" | "recovery", distanceM: number): CanyonStepInput {
  return s({ stepType, distanceM, targetType: "pace", targetPacePercentBasis: "5k", targetPacePercentMin: 40, targetPacePercentMax: 50 });
}
function progressiveMain(distanceM: number, distanceMaxM: number | null = null): CanyonStepInput {
  return s({
    stepType: "main",
    distanceM,
    distanceMaxM,
    instructions: "Progressive effort: start very easy, and build to a strong but relaxed pace by the end.",
  });
}
function pacePercent(basis: PaceReferenceKey, min: number, max: number) {
  return { targetType: "pace" as const, targetPacePercentBasis: basis, targetPacePercentMin: min, targetPacePercentMax: max };
}

export type CanyonDayStepsEntry = {
  phaseKey: "General" | "Supportive" | "Specific";
  weekNumber: number;
  dayOfWeek: number;
  steps: CanyonStepInput[];
};

export const CANYON_STEPS: CanyonDayStepsEntry[] = [
  // ---------------------------------------------------------------------
  // General phase
  // ---------------------------------------------------------------------
  // W1D3: "10 x 1.5 min at 100% 5k w/ 1 min jog: 1mi progressive wu; .5mi cd"
  {
    phaseKey: "General",
    weekNumber: 1,
    dayOfWeek: 3,
    steps: [
      s({ stepType: "warmup", distanceM: 1609, instructions: "Progressive warmup." }),
      s({ stepType: "interval", durationS: 90, repetitions: 10, restS: 60, ...pacePercent("5k", 100, 100) }),
      easyLeg("cooldown", 805),
    ],
  },
  // W2D1: "5 mi Kenyan-style progression run; .5mi cd"
  { phaseKey: "General", weekNumber: 2, dayOfWeek: 1, steps: [progressiveMain(8047), easyLeg("cooldown", 805)] },
  // W2D3: "4 mi at 85% 5k"
  { phaseKey: "General", weekNumber: 2, dayOfWeek: 3, steps: [s({ stepType: "main", distanceM: 6437, ...pacePercent("5k", 85, 85) })] },
  // W3D1: "6-7 x 3 min at 90% 5k w/ 1 min jog; 1.5mi wu / .5mi cd"
  {
    phaseKey: "General",
    weekNumber: 3,
    dayOfWeek: 1,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 180, repetitions: 6, repetitionsMax: 7, restS: 60, ...pacePercent("5k", 90, 90) }),
      easyLeg("cooldown", 805),
    ],
  },
  // W3D3: "8 x 2 min at 100% 5k w/ 1.5 min jog; 1.5mi wu, .5mi cd"
  {
    phaseKey: "General",
    weekNumber: 3,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 120, repetitions: 8, restS: 90, ...pacePercent("5k", 100, 100) }),
      easyLeg("cooldown", 805),
    ],
  },
  // W3D6: "9 mi at 70-75% 5k; 1mi wu"
  {
    phaseKey: "General",
    weekNumber: 3,
    dayOfWeek: 6,
    steps: [easyLeg("warmup", 1609), s({ stepType: "main", distanceM: 14484, ...pacePercent("5k", 70, 75) })],
  },
  // W4D3: "5 mi at 85% 5k; 1mi wu"
  {
    phaseKey: "General",
    weekNumber: 4,
    dayOfWeek: 3,
    steps: [easyLeg("warmup", 1609), s({ stepType: "main", distanceM: 8047, ...pacePercent("5k", 85, 85) })],
  },
  // W4D6: "6 mi Kenyan-style progression run + 1mi easy cd"
  { phaseKey: "General", weekNumber: 4, dayOfWeek: 6, steps: [progressiveMain(9656), easyLeg("cooldown", 1609)] },
  // W5D1: "7-8 x 3 min at 90% 5k w/ 45 sec jog; 1.5 mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 5,
    dayOfWeek: 1,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 180, repetitions: 7, repetitionsMax: 8, restS: 45, ...pacePercent("5k", 90, 90) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W5D3: "3 x (3 min at 100% 5k, 1.5 min jog, 2 min at 102% 5k, 3 min jog); 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 5,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 180, repetitions: 3, restS: 90, ...pacePercent("5k", 100, 100) }),
      s({ stepType: "interval", durationS: 120, repetitions: 3, restS: 180, ...pacePercent("5k", 102, 102) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W6D1: "2 sets of: (6 x 500m at 95% 5k w/ 30 sec walk); 4 min walk between sets; 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 6,
    dayOfWeek: 1,
    steps: [
      easyLeg("warmup", 2414),
      s({
        stepType: "interval",
        distanceM: 500,
        repetitions: 12,
        restS: 30,
        ...pacePercent("5k", 95, 95),
        instructions: "Two sets of six reps; walk four minutes between the two sets (30 seconds within each set).",
      }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W6D3: "6 mi at 85% 5k; 1.5mi wu, .5mi cd"
  {
    phaseKey: "General",
    weekNumber: 6,
    dayOfWeek: 3,
    steps: [easyLeg("warmup", 2414), s({ stepType: "main", distanceM: 9656, ...pacePercent("5k", 85, 85) }), easyLeg("cooldown", 805)],
  },
  // W6D6: "7 mi Kenyan-style progression run; 1mi cd"
  { phaseKey: "General", weekNumber: 6, dayOfWeek: 6, steps: [progressiveMain(11265), easyLeg("cooldown", 1609)] },
  // W7D1: "4-5 x 5 min at 90-92% 5k w/ 1 min jog; 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 7,
    dayOfWeek: 1,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 300, repetitions: 4, repetitionsMax: 5, restS: 60, ...pacePercent("5k", 90, 92) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W7D3: "7 x 1 km at 95% 5k w/ 2 min jog; 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 7,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 1000, repetitions: 7, restS: 120, ...pacePercent("5k", 95, 95) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W7D6: "11-12 mi at 75-80% 5k; 1mi wu"
  {
    phaseKey: "General",
    weekNumber: 7,
    dayOfWeek: 6,
    steps: [easyLeg("warmup", 1609), s({ stepType: "main", distanceM: 17703, distanceMaxM: 19312, ...pacePercent("5k", 75, 80) })],
  },
  // W8D2: "3 x (3 min at 98% 5k, 1 min jog, 3 min at 100-102% 5k, 3 min walk/jog); 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 8,
    dayOfWeek: 2,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 180, repetitions: 3, restS: 60, ...pacePercent("5k", 98, 98) }),
      s({ stepType: "interval", durationS: 180, repetitions: 3, restS: 180, ...pacePercent("5k", 100, 102) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W9D2: "4-5 x (1200m at 90-92% 5k, 400m at 75% 5k); 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 9,
    dayOfWeek: 2,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 1200, repetitions: 4, repetitionsMax: 5, ...pacePercent("5k", 90, 92) }),
      s({ stepType: "recovery", distanceM: 400, repetitions: 4, repetitionsMax: 5, ...pacePercent("5k", 75, 75) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W9D4: "6mi kenyan ; 1mi cd"
  { phaseKey: "General", weekNumber: 9, dayOfWeek: 4, steps: [progressiveMain(9656), easyLeg("cooldown", 1609)] },
  // W9D6: "5-6 x 2 km at 86-88% 5k w/ 2 min walk; 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 9,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 2000, repetitions: 5, repetitionsMax: 6, restS: 120, ...pacePercent("5k", 86, 88) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W10D2: "4 x 1.5 km at 95% 5K w/ 3 min walk/jog; 1.5mi wu, 1mi cd"
  {
    phaseKey: "General",
    weekNumber: 10,
    dayOfWeek: 2,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 1500, repetitions: 4, restS: 180, ...pacePercent("5k", 95, 95) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W10D4: "7-8 mi at 85% 5k; 1mi wu"
  {
    phaseKey: "General",
    weekNumber: 10,
    dayOfWeek: 4,
    steps: [easyLeg("warmup", 1609), s({ stepType: "main", distanceM: 11265, distanceMaxM: 12875, ...pacePercent("5k", 85, 85) })],
  },

  // ---------------------------------------------------------------------
  // Supportive phase
  // ---------------------------------------------------------------------
  // W1D2: "3-4 x (1600m at 90-92% 5k, 400m at 75% 5k); 1.5mi wu, 1mi cd"
  {
    phaseKey: "Supportive",
    weekNumber: 1,
    dayOfWeek: 2,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 1600, repetitions: 3, repetitionsMax: 4, ...pacePercent("5k", 90, 92) }),
      s({ stepType: "recovery", distanceM: 400, repetitions: 3, repetitionsMax: 4, ...pacePercent("5k", 75, 75) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W1D4: "6/7 mi Kenyan-style progression run w/ optional fast finish; 1mi cd"
  {
    phaseKey: "Supportive",
    weekNumber: 1,
    dayOfWeek: 4,
    steps: [
      s({
        stepType: "main",
        distanceM: 9656,
        distanceMaxM: 11265,
        instructions:
          "Progressive effort: start very easy, build to a strong but relaxed pace, and only break from a controlled finish to attack the last mile if you feel fresh.",
      }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W1D6: "15-16 mi at 90-92% MP w/ 1st mile progressive into it"
  {
    phaseKey: "Supportive",
    weekNumber: 1,
    dayOfWeek: 6,
    steps: [
      s({
        stepType: "main",
        distanceM: 24140,
        distanceMaxM: 25750,
        ...pacePercent("marathon", 90, 92),
        instructions: "The first mile progresses into marathon-effort pace rather than starting there outright.",
      }),
    ],
  },
  // W2D3: "2 x (2 km, 1 km) at 108%, 112% MP w/ 3min jog within sets 4 min jog between sets; 1.5mi wu, 1mi cd"
  {
    phaseKey: "Supportive",
    weekNumber: 2,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 2000, repetitions: 2, restS: 180, ...pacePercent("marathon", 108, 108) }),
      s({
        stepType: "interval",
        distanceM: 1000,
        repetitions: 2,
        ...pacePercent("marathon", 112, 112),
        instructions: "Jog 4 minutes between the two full (2km + 1km) sets.",
      }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W2D6: "8-9 x (1 km at 100-102% MP, 1 km at 85% MP); 1mi wu, 1mi very easy cd" + fueling note
  {
    phaseKey: "Supportive",
    weekNumber: 2,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 1609),
      s({
        stepType: "interval",
        distanceM: 1000,
        repetitions: 8,
        repetitionsMax: 9,
        ...pacePercent("marathon", 100, 102),
        instructions: "Take a gel (or gel-equivalent) during reps two, four, and six to practice mid-workout fueling.",
      }),
      s({ stepType: "recovery", distanceM: 1000, repetitions: 8, repetitionsMax: 9, ...pacePercent("marathon", 85, 85) }),
      veryEasyLeg("cooldown", 1609),
    ],
  },
  // W3D3: "7 x (1 km at 105% MP, 1 km at 80% MP); 1.5mi wu, 1mi cd"
  {
    phaseKey: "Supportive",
    weekNumber: 3,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 1000, repetitions: 7, ...pacePercent("marathon", 105, 105) }),
      s({ stepType: "recovery", distanceM: 1000, repetitions: 7, ...pacePercent("marathon", 80, 80) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W3D6: "16-18 mi at 90-92% MP; 1mi wu" + fueling note
  {
    phaseKey: "Supportive",
    weekNumber: 3,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 1609),
      s({
        stepType: "main",
        distanceM: 25750,
        distanceMaxM: 28968,
        ...pacePercent("marathon", 90, 92),
        instructions: "Take at least three gels (or gel-equivalents) during this run -- miles 5, 10, and 15 are a good spot for most runners.",
      }),
    ],
  },
  // W4D3: "(3 x 2 km at 108% MP w/ 4 min jog), then 1 km at 110-112% MP; 1.5mi wu, 1mi cd"
  {
    phaseKey: "Supportive",
    weekNumber: 4,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 2000, repetitions: 3, restS: 240, ...pacePercent("marathon", 108, 108) }),
      s({ stepType: "interval", distanceM: 1000, repetitions: 1, ...pacePercent("marathon", 110, 112) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W4D6: "7 x (2 km at 100% MP, 1 km at 85% MP); 1mi wu, .5mi cd"
  {
    phaseKey: "Supportive",
    weekNumber: 4,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 1609),
      s({
        stepType: "interval",
        distanceM: 2000,
        repetitions: 7,
        ...pacePercent("marathon", 100, 100),
        instructions: "Practice your race-day fueling strategy. Wear your race-day shoes; run the second half on race-specific terrain if possible.",
      }),
      s({ stepType: "recovery", distanceM: 1000, repetitions: 7, ...pacePercent("marathon", 85, 85) }),
      easyLeg("cooldown", 805),
    ],
  },

  // ---------------------------------------------------------------------
  // Specific phase
  // ---------------------------------------------------------------------
  // W1D3: "3.5-5 mi at 105% MP; 1.5mi wu, 1mi cd"
  {
    phaseKey: "Specific",
    weekNumber: 1,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "main", distanceM: 5633, distanceMaxM: 8047, ...pacePercent("marathon", 105, 105) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W1D6: "6 mi at 88%, 5 mi at 90%, 5 mi at 92%, 3-4 mi at 95% MP; 1mi wu" -- toughest session
  {
    phaseKey: "Specific",
    weekNumber: 1,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 1609),
      s({ stepType: "interval", distanceM: 9656, repetitions: 1, ...pacePercent("marathon", 88, 88) }),
      s({ stepType: "interval", distanceM: 8047, repetitions: 1, ...pacePercent("marathon", 90, 90) }),
      s({ stepType: "interval", distanceM: 8047, repetitions: 1, ...pacePercent("marathon", 92, 92) }),
      s({
        stepType: "interval",
        distanceM: 4828,
        distanceMaxM: 6437,
        repetitions: 1,
        ...pacePercent("marathon", 95, 95),
        instructions:
          "Probably the toughest session in the framework. Keep it controlled early -- most of the challenge is in the second half. Use your race-day fueling strategy and run on race-specific terrain.",
      }),
    ],
  },
  // W2D3: "10-12 x 500m at 108-110% MP w/ 30-45 sec walk; 1.5mi wu, 1mi cd"
  {
    phaseKey: "Specific",
    weekNumber: 2,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({
        stepType: "interval",
        distanceM: 500,
        repetitions: 10,
        repetitionsMax: 12,
        restS: 30,
        restMaxS: 45,
        ...pacePercent("marathon", 108, 110),
      }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W2D6: "5-4-3-2-1 km at 98-100//100//100//100-102//101-102 % MP w/ 1 km easy in btwn; 1mi wu, .5mi cd"
  {
    phaseKey: "Specific",
    weekNumber: 2,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 1609),
      s({
        stepType: "interval",
        distanceM: 5000,
        repetitions: 1,
        ...pacePercent("marathon", 98, 100),
        instructions: "Run this opening segment the same way you'll open the first few miles of your race.",
      }),
      easyLeg("recovery", 1000),
      s({ stepType: "interval", distanceM: 4000, repetitions: 1, ...pacePercent("marathon", 100, 100) }),
      easyLeg("recovery", 1000),
      s({ stepType: "interval", distanceM: 3000, repetitions: 1, ...pacePercent("marathon", 100, 100) }),
      easyLeg("recovery", 1000),
      s({ stepType: "interval", distanceM: 2000, repetitions: 1, ...pacePercent("marathon", 100, 102) }),
      easyLeg("recovery", 1000),
      s({
        stepType: "interval",
        distanceM: 1000,
        repetitions: 1,
        ...pacePercent("marathon", 101, 102),
        instructions: "Wear your race-day gear and fuel the same way you plan to on race day; run on race-specific terrain.",
      }),
      easyLeg("cooldown", 805),
    ],
  },
  // W3D3: "5 x (1 km at 103% MP, 1 km at 85% MP); 1.5mi wu, 1mi cd"
  {
    phaseKey: "Specific",
    weekNumber: 3,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", distanceM: 1000, repetitions: 5, ...pacePercent("marathon", 103, 103) }),
      s({ stepType: "recovery", distanceM: 1000, repetitions: 5, ...pacePercent("marathon", 85, 85) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W3D6: "3-4 x 2 mi at 100% MP w/ 2-3 min jog; 1mi wu, .5mi cd"
  {
    phaseKey: "Specific",
    weekNumber: 3,
    dayOfWeek: 6,
    steps: [
      easyLeg("warmup", 1609),
      s({
        stepType: "interval",
        distanceM: 3219,
        repetitions: 3,
        repetitionsMax: 4,
        restS: 120,
        restMaxS: 180,
        ...pacePercent("marathon", 100, 100),
      }),
      easyLeg("cooldown", 805),
    ],
  },
  // W4D3: "5-6 x 3 min at 103-106% MP w/ 1 min jog; 1.5 mi wu, 1mi cd"
  {
    phaseKey: "Specific",
    weekNumber: 4,
    dayOfWeek: 3,
    steps: [
      easyLeg("warmup", 2414),
      s({ stepType: "interval", durationS: 180, repetitions: 5, repetitionsMax: 6, restS: 60, ...pacePercent("marathon", 103, 106) }),
      easyLeg("cooldown", 1609),
    ],
  },
  // W4D7: "Marathon; 1mi wu" -- race day itself; just the warmup, the race is tracked via completion, not a prescribed step.
  { phaseKey: "Specific", weekNumber: 4, dayOfWeek: 7, steps: [easyLeg("warmup", 1609)] },
];
