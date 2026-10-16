// Brody's own hand-read answers from labeling-worksheet.md, encoded as a
// lookup framework-structure.ts's structureFramework consults before
// falling back to its own automatic parser -- see that file's own
// comment on lookupHandOverride. This is the follow-up the original
// worksheet asked for: every entry here is one specific day this parser
// could not resolve on its own, now resolved by Brody reading the
// prescription end to end, never re-derived or re-guessed here.
//
// MATCHING. Keyed by (programName, exact prescription text as printed in
// the worksheet's "Prescription (verbatim)" line) -- that line already
// normalizes a raw newline-joined session (canyon/mesa/ridge's own JSON
// style) to the same " / "-joined form peak/summit's JSON already uses
// natively, so normalize() applies that same transform to the raw text
// before comparing and the lookup works regardless of which separator
// style the source file actually used. Checked once, programmatically,
// that no two entries share identical text within the same program
// (`tests/lib/private-coaching/framework-structure-overrides.test.ts`) --
// the one real duplicate (peak's two "7-9 mi easy with 40 min of ..."
// days) has an identical answer on both occurrences, so collapsing them
// to one lookup entry is correct, not lossy.
//
// CONVENTIONS CARRIED OVER FROM BRODY'S OWN ANSWERS, APPLIED UNIFORMLY:
//   * Nested/ladder sets are split into one step per distinct component,
//     each carrying the bracketed note from his answer verbatim in
//     `instructions` (e.g. "[part 1 of 3x(...)]") -- never collapsed into
//     a single step that would hide which percent/duration belongs to
//     which part.
//   * A walk or jog recovery is read into restS/restMaxS (a real, stated
//     duration) but never converted to distance -- same policy
//     framework-structure.ts's own parser already applies uniformly to
//     jog recoveries, extended here to "walk" explicitly too (Brody's
//     own math throughout leaves these out of his distance totals).
//   * Easy/no-percent running keeps every pace field null -- easy is by
//     feel, never a number.
//   * "null (pace-dependent)" in Brody's answer means exactly what
//     framework-structure.ts's own time-based-main-set case already
//     means: the day's steps are fully structured, but distanceMiMin/Max
//     stay null forever (not a guess, not asking again).
//   * A percent stated only as a ceiling ("progressing to 95% MP", no
//     floor) is stored as a POINT value (targetPacePercentMin = that
//     number, Max = null) rather than literally min=null/max=90 --
//     program_day_steps' own pace_percent_range_valid constraint requires
//     min whenever max is set, so "the one number that's actually
//     stated" has to live in Min, matching parseDifficulty's own
//     single-number-is-a-point-value convention elsewhere in this schema.
//
// BRODY'S TWO DIRECT DIRECTIVES (see the task that added them):
//   1. summit W9D3a is encoded as the exact 4-pair, 14k ladder he
//      specified, overriding the worksheet's own "[... confirm pairing]"
//      hedge -- see that entry below.
//   2. mesa W17D7 (NEEDS BRODY in the filled worksheet) is encoded as
//      BOTH conditional variants via StructuredDay.conditionalVariants,
//      per his instruction to bake the conditional into the plan rather
//      than pick one. Auto-resolving which variant applies to a given
//      athlete is explicitly out of scope here -- see
//      framework-structure.ts's own closing comment for that follow-up
//      and Brody's stated rule for it.

import { MILE_METERS } from "@/lib/race-distances";
import type { PaceBasis, SeedDayStep, StructuredDay } from "@/lib/private-coaching/framework-structure";

function miM(miles: number): number {
  return Math.round(miles * MILE_METERS);
}
function kmM(km: number): number {
  return Math.round(km * 1000);
}
/** Minutes -> seconds, for every duration/rest Brody wrote as "N min". */
function minS(n: number): number {
  return Math.round(n * 60);
}

type StepSpec = Partial<Omit<SeedDayStep, "stepOrder">> & { stepType: SeedDayStep["stepType"] };

/** Fills every unspecified SeedDayStep field with null and assigns stepOrder by position -- the same shape every step below is built from. */
function steps(specs: StepSpec[]): SeedDayStep[] {
  return specs.map((s, i) => ({
    stepOrder: i + 1,
    stepType: s.stepType,
    durationS: s.durationS ?? null,
    durationMaxS: s.durationMaxS ?? null,
    distanceM: s.distanceM ?? null,
    distanceMaxM: s.distanceMaxM ?? null,
    targetPacePercentBasis: s.targetPacePercentBasis ?? null,
    targetPacePercentMin: s.targetPacePercentMin ?? null,
    targetPacePercentMax: s.targetPacePercentMax ?? null,
    repetitions: s.repetitions ?? null,
    repetitionsMax: s.repetitionsMax ?? null,
    restS: s.restS ?? null,
    restMaxS: s.restMaxS ?? null,
    instructions: s.instructions ?? null,
  }));
}

const MP: PaceBasis = "marathon";
const FIVEK: PaceBasis = "5k";

type OverrideEntry = { program: string; workoutText: string; structured: StructuredDay };

function entry(program: string, workoutText: string, distanceMiMin: number | null, distanceMiMax: number | null, stepSpecs: StepSpec[] | null): OverrideEntry {
  return { program, workoutText, structured: { distanceMiMin, distanceMiMax, steps: stepSpecs ? steps(stepSpecs) : null } };
}

// ---------------------------------------------------------------------------
// canyon (16)
// ---------------------------------------------------------------------------

const CANYON: OverrideEntry[] = [
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 3 × (3 min at 100% 5k, 1.5 min jog, 2 min at 102% 5k, 3 min jog) / 1 mi easy cool-down",
    null,
    null,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 3, restS: minS(1.5), instructions: "part 1 of 3x(3 min @100% / 1.5 min jog / 2 min @102% / 3 min jog) complex" },
      { stepType: "interval", durationS: minS(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 102, repetitions: 3, restS: minS(3), instructions: "part 2; rounds run 3-min bout, jog, 2-min bout, jog x 3" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 2 sets of (6 × 500m at 95% 5k with 30 sec walk), with 4 min walk between sets / 1 mi easy cool-down",
    6.1,
    6.1,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 6, restS: 30, instructions: "2 sets of 6x500m; 4 min (240s) walk between sets" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 3 sets of: (3 min at 98% 5k, 1 min jog, 3 min at 100–102% 5k, 4 min walk/jog) / 1 mi easy cool-down",
    null,
    null,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 98, repetitions: 3, restS: minS(1), instructions: "part 1 of 3x(3 min @98% / 1 min jog / 3 min @100-102% / 4 min walk-jog)" },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, targetPacePercentMax: 102, repetitions: 3, restS: minS(4), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 4–5 sets of (1200m at 90–92% 5k, 400m at 75% 5k) / 1 mi easy cool-down",
    6.1,
    7.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 1200, targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 4, repetitionsMax: 5, instructions: "4-5 sets of (1200m / 400m float); float is the recovery" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: FIVEK, targetPacePercentMin: 75, repetitions: 4, repetitionsMax: 5, instructions: "float recovery" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 5–6 × 2 km at 86–88% 5k with 2 min walk / 1 mi easy cool-down",
    8.5,
    9.7,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 88, repetitions: 5, repetitionsMax: 6, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 3–4 sets of: (1600m at 90–92% 5k, 400m at 75% 5k) / 1 mi easy cool-down",
    6.1,
    7.3,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 1600, targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 3, repetitionsMax: 4, instructions: "3-4 sets of (1600m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: FIVEK, targetPacePercentMin: 75, repetitions: 3, repetitionsMax: 4, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 2 sets of (2 km at 108% MP, 1 km at 112% MP) with 3 min jog within sets and 4 min jog between sets / 1 mi easy cool-down",
    6.1,
    6.1,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, repetitions: 2, restS: minS(3), instructions: "part 1 of 2x(2 km @108% / 1 km @112%); 3 min jog within sets, 4 min jog between sets" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 112, repetitions: 2, restS: minS(3), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1 mi progressive warm-up + 4 strides / 8–9 × (1 km at 100–102% MP, 1 km at 85% MP) / 1 mi very easy cool-down",
    11.6,
    12.8,
    [
      { stepType: "warmup", distanceM: miM(1) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 100, targetPacePercentMax: 102, repetitions: 8, repetitionsMax: 9, instructions: "alternating 1 km @100-102% / 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 8, repetitionsMax: 9 },
      { stepType: "cooldown", distanceM: miM(1), instructions: "very easy" },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 7 × (1 km at 105% MP, 1 km at 85% MP) / 1 mi easy cool-down",
    10.9,
    10.9,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 7, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 7 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / (3 × 2 km at 108% MP with 4 min jog); then at the end, 1 km at 110–112% MP / 1 mi easy cool-down",
    6.7,
    6.7,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, repetitions: 3, restS: minS(4) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, targetPacePercentMax: 112, instructions: "final pickup" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1 mi progressive warm-up + 4 strides / 7 × (2 km at 100% MP, 1 km at 85% MP) / 0.5 mi easy cool-down",
    14.1,
    14.1,
    [
      { stepType: "warmup", distanceM: miM(1) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 7, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 7 },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 10–12 × 500m at 108–110% MP with 30–45 sec walk / 1 mi easy cool-down",
    5.5,
    6.1,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 10, repetitionsMax: 12, restS: 30, restMaxS: 45 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1 mi progressive warm-up + 4 strides / 5 km at 98–100% MP, 1 km easy (65–75% MP) / 4 km at 100% MP, 1 km easy / 3 km at 100% MP, 1 km easy / 2 km at 100–102% MP, 1 km easy / 1 km at 101–102% MP / 0.5 mi easy cool-down",
    13.2,
    13.2,
    [
      { stepType: "warmup", distanceM: miM(1) },
      { stepType: "main", distanceM: kmM(5), targetPacePercentBasis: MP, targetPacePercentMin: 98, targetPacePercentMax: 100 },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 65, targetPacePercentMax: 75, instructions: "easy recovery, stated percent kept" },
      { stepType: "main", distanceM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 100 },
      { stepType: "main", distanceM: kmM(1), instructions: "easy, no pace" },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 100 },
      { stepType: "main", distanceM: kmM(1), instructions: "easy, no pace" },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 100, targetPacePercentMax: 102 },
      { stepType: "main", distanceM: kmM(1), instructions: "easy, no pace" },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 101, targetPacePercentMax: 102 },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 5 × (1 km at 103% MP, 1 km at 85% MP) / 1 mi easy cool-down",
    8.5,
    8.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, repetitions: 5, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 5 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "canyon",
    "1 mi progressive warm-up + 4 strides / 3–4 × 2 mi at 100% MP with 2–3 min jog / 0.5 mi easy cool-down",
    7.5,
    9.5,
    [
      { stepType: "warmup", distanceM: miM(1) },
      { stepType: "interval", distanceM: miM(2), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 3, repetitionsMax: 4, restS: minS(2), restMaxS: minS(3) },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "canyon",
    "1.5 mi progressive warm-up + 4 strides / 7 × (1 km at 105% MP, 1 km at 80% MP) / 1 mi easy cool-down",
    10.9,
    10.9,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 7, instructions: "alternating with 1 km @80% recovery" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 80, repetitions: 7 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
];

// ---------------------------------------------------------------------------
// mesa (17, including the W17D7 conditional)
// ---------------------------------------------------------------------------

const MESA: OverrideEntry[] = [
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 4 sets of: / 3 min at 95% 5k; 1 min jog / 2 min at 100% 5k; 3 min jog / 1.5 mi cool-down",
    null,
    null,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 4, restS: minS(1), instructions: "part 1 of 4x(3 min @95% / 1 min jog / 2 min @100% / 3 min jog)" },
      { stepType: "interval", durationS: minS(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 4, restS: minS(3), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 4 sets of: / 3 min at 98% 5k, 1 min jog / 2 min at 100% 5k, 1 min jog / 1 min at 102% 5k, 3 min jog / 1.5 mi easy cool-down",
    null,
    null,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 98, repetitions: 4, restS: minS(1), instructions: "part 1 of 4x(3/2/1 min ladder @98/100/102%)" },
      { stepType: "interval", durationS: minS(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 4, restS: minS(1), instructions: "part 2" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 102, repetitions: 4, restS: minS(3), instructions: "part 3" },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 4 sets of: / 1 km at 95% 5k pace, 2 min jog / 1 km at 98% 5k pace, 4 min jog / 1.5 mi easy cool-down",
    7.8,
    7.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 4, restS: minS(2), instructions: "part 1 of 4x(1 km @95% / 1 km @98%)" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 98, repetitions: 4, restS: minS(4), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 5-6 x (1200m at 90-92% 5k, 400m at 80% 5k) / 1.5 mi easy cool-down",
    7.5,
    8.4,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 1200, targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 5, repetitionsMax: 6, instructions: "5-6x(1200m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: FIVEK, targetPacePercentMin: 80, repetitions: 5, repetitionsMax: 6, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "6-8 mi easy with 28 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    6,
    8,
    [
      { stepType: "main", distanceM: miM(6), distanceMaxM: miM(8), instructions: "28 min of pickups embedded in the middle" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 7, restS: minS(3), instructions: "pickups within the easy miles, not additional distance" },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 4-5 x (1600m at 90-92% 5k, 400m at 80% 5k) / 1.5 mi easy cool-down",
    7.8,
    9.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 1600, targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 4, repetitionsMax: 5, instructions: "4-5x(1600m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: FIVEK, targetPacePercentMin: 80, repetitions: 4, repetitionsMax: 5, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 3 x 2 km at 108-110% MP with 4 min jog / 2 x 1 km at 112% MP with 3 min jog / 1.5 mi easy cool-down",
    7.8,
    7.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 3, restS: minS(4) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 112, repetitions: 2, restS: minS(3) },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "7-9 mi easy with 28 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    7,
    9,
    [
      { stepType: "main", distanceM: miM(7), distanceMaxM: miM(9), instructions: "28 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 7, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 7-8 x (1 km at 105% MP, 1 km at 85% MP) / 1.5 mi easy cool-down",
    11.4,
    12.6,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 7, repetitionsMax: 8, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 7, repetitionsMax: 8 },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 4 x 2 km at 108-110% MP with 4 min walk/jog / 1.5 mi easy cool-down",
    7.8,
    7.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 4, restS: minS(4) },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1 mi progressive warm-up + 4 strides / 8 x (2 km at 100% MP, 1 km at 85% MP) / 1 mi easy cool-down",
    16.4,
    16.4,
    [
      { stepType: "warmup", distanceM: miM(1) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 8, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 8 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 5 x (2 km at 105% MP, 1 km at 85% MP) / 1.5 mi easy cool-down",
    12.0,
    12.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 5, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 5 },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 3 km at 108% MP, 4 min walk/jog / 2 km at 109% MP, 4 min walk/jog / 2 km at 110% MP, 4 min walk/jog / 1 km at 112-115% MP / 1.5 mi easy cool-down",
    7.9,
    7.9,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 108, restS: minS(4) },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 109, restS: minS(4) },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 110, restS: minS(4) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 112, targetPacePercentMax: 115, instructions: "final" },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1 mi progressive warm-up + 4 strides / 6 x (3 km at 100% MP, 1 km at 85% MP) / 1 mi easy cool-down",
    17.0,
    17.0,
    [
      { stepType: "warmup", distanceM: miM(1) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 6, instructions: "alternating with 1 km @85%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 85, repetitions: 6 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 12 x 500m at 108-110% MP with 30-45 sec walk / 1.5 mi easy cool-down",
    6.6,
    6.6,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, restS: 30, restMaxS: 45 },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "mesa",
    "1.5 mi progressive warm-up + 4 strides / 6-7 x (1 km at 103-105% MP, 1 km at 90% MP) / 1.5 mi easy cool-down",
    10.2,
    11.4,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 105, repetitions: 6, repetitionsMax: 7, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 6, repetitionsMax: 7 },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
];

// The mesa W17D7 conditional: both variants encoded, per Brody's directive
// not to pick one. See ConditionalVariant's own comment and the
// auto-resolution follow-up note at the end of framework-structure.ts.
const MESA_W17D7: OverrideEntry = {
  program: "mesa",
  workoutText: "8 mi Kenyan-style progression run + 1 mi easy cool-down (if marathon is on a Sunday), or: 8 mi easy progressing to moderate (if marathon is on a Saturday)",
  structured: {
    distanceMiMin: null,
    distanceMiMax: null,
    steps: null,
    conditionalVariants: [
      {
        condition: "sunday-marathon",
        distanceMiMin: 9,
        distanceMiMax: 9,
        steps: steps([
          { stepType: "main", distanceM: miM(8), instructions: "Kenyan-style progression, no pace stated (progressive, no percent given)" },
          { stepType: "cooldown", distanceM: miM(1) },
        ]),
      },
      {
        condition: "saturday-marathon",
        distanceMiMin: 8,
        distanceMiMax: 8,
        steps: steps([{ stepType: "main", distanceM: miM(8), instructions: "easy progressing to moderate, no pace" }]),
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// ridge (22)
// ---------------------------------------------------------------------------

const RIDGE: OverrideEntry[] = [
  entry(
    "ridge",
    "5 mi easy + 3 × (1.5 mi at 88–90% 5k, 0.5 mi moderate at ~60–70% 5k pace)",
    11.0,
    11.0,
    [
      { stepType: "main", distanceM: miM(5), instructions: "opening miles" },
      { stepType: "interval", distanceM: miM(1.5), targetPacePercentBasis: FIVEK, targetPacePercentMin: 88, targetPacePercentMax: 90, repetitions: 3, instructions: "3x(1.5 mi / 0.5 mi moderate)" },
      { stepType: "interval", distanceM: miM(0.5), targetPacePercentBasis: FIVEK, targetPacePercentMin: 60, targetPacePercentMax: 70, repetitions: 3, instructions: "moderate recovery between 1.5 mi reps; stated distance, counted" },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 4 sets of: / 3 min at 98% 5k, 1 min jog / 2 min at 100% 5k, 1 min jog / 1 min at 102% 5k, 2 min jog / 2 mi easy cool-down",
    null,
    null,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 98, repetitions: 4, restS: minS(1), instructions: "part 1 of 4x(3/2/1 min ladder)" },
      { stepType: "interval", durationS: minS(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 4, restS: minS(1), instructions: "part 2" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 102, repetitions: 4, restS: minS(2), instructions: "part 3" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive warm-up + 4 strides / 12–13 mi at 80% 5k, optionally through rolling hills / 1 mi easy cool-down",
    14.5,
    15.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "main", distanceM: miM(12), distanceMaxM: miM(13), targetPacePercentBasis: FIVEK, targetPacePercentMin: 80, instructions: "optionally through rolling hills" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "ridge",
    "7 mi easy progressing to moderate with 28 min of (1 min at ~95% 5k effort, 3 min moderate) in the middle",
    7,
    7,
    [
      { stepType: "main", distanceM: miM(7), instructions: "easy progressing to moderate; 28 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 7, restS: minS(3), instructions: "moderate recovery, within the miles" },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 8 × 800m at 100% 5k with 2–3 min walk/jog / 2 mi easy cool-down",
    8.0,
    8.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 800, targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 8, restS: minS(2), restMaxS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 5 × 1 mi at 95% 5k with 3 min jog / 2 mi easy cool-down",
    9.0,
    9.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: miM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 5, restS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 6–7 × (1200m at 90–92% 5k, 400m at 80% 5k) / 2 mi easy cool-down",
    9.4,
    10.3,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 1200, targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 6, repetitionsMax: 7, instructions: "6-7x(1200m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: FIVEK, targetPacePercentMin: 80, repetitions: 6, repetitionsMax: 7, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive + 4 strides / 5 × (1600m at 105–107% MP, 400m at 95–98% MP) / 2 mi easy cool-down",
    10.0,
    10.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 1600, targetPacePercentBasis: MP, targetPacePercentMin: 105, targetPacePercentMax: 107, repetitions: 5, instructions: "5x(1600m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: MP, targetPacePercentMin: 95, targetPacePercentMax: 98, repetitions: 5, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "8–10 mi easy to moderate with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "easy to moderate; 40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive warm-up + 4 strides / 16–18 mi at 90–92% MP, optionally through hills / No cool-down",
    17.5,
    19.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "main", distanceM: miM(16), distanceMaxM: miM(18), targetPacePercentBasis: MP, targetPacePercentMin: 90, targetPacePercentMax: 92, instructions: "optionally through hills; no cool-down" },
    ],
  ),
  entry(
    "ridge",
    "5–6 mi moderate progressing to strong (~80% to 100% MP)",
    5,
    6,
    [{ stepType: "main", distanceM: miM(5), distanceMaxM: miM(6), targetPacePercentBasis: MP, targetPacePercentMin: 80, targetPacePercentMax: 100, instructions: "moderate progressing to strong" }],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 3 sets of: / 2 km at 108% MP, 2 min jog / 1 km at 110% MP, 5 min walk/jog / 2 mi easy cool-down",
    9.4,
    9.4,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, repetitions: 3, restS: minS(2), instructions: "part 1 of 3x(2 km @108% / 1 km @110%)" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, repetitions: 3, restS: minS(5), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "8–10 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 9–10 × (1 km at 105% MP, 1 km at 90% MP) / 2 mi easy cool-down",
    14.8,
    16.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 9, repetitionsMax: 10, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 9, repetitionsMax: 10 },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive warm-up + 4 strides / 18–20 mi at 90–92% MP, optionally through rolling hills / No cool-down",
    19.5,
    21.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "main", distanceM: miM(18), distanceMaxM: miM(20), targetPacePercentBasis: MP, targetPacePercentMin: 90, targetPacePercentMax: 92, instructions: "optionally through rolling hills; no cool-down" },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 3 × 3 km at 108–110% MP with 4–5 min walk/jog rest / 2 mi easy cool-down",
    9.7,
    9.7,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 3, restS: minS(4), restMaxS: minS(5) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive warm-up + 4 strides / 8 × (2 km at 100% MP, 1 km at 90% MP) / 1 mi easy cool-down",
    16.9,
    16.9,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 8, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 8 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 6–7 × (2 km at 105% MP, 1 km at 90% MP) / 2 mi easy cool-down",
    14.8,
    16.6,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 6, repetitionsMax: 7, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 6, repetitionsMax: 7 },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "2 mi progressive warm-up + 4 strides / 12–15 × 500m at 108–110% MP with 30–45 sec walk / 2 mi easy cool-down",
    7.6,
    8.5,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, repetitionsMax: 15, restS: 30, restMaxS: 45 },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive warm-up + 4 strides / 6 × (3 km at 100% MP, 1 km at 90% MP) / 1 mi easy cool-down",
    17.5,
    17.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 6, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 6 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive warm-up + 4 strides / 5 × (4 km at 100% MP, 1 km at 90% MP) / 1 mi easy cool-down",
    18.0,
    18.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 5, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 5 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "ridge",
    "1.5 mi progressive + 4 strides / 7–8 × (1 km at 103–105% MP, 1 km at 92–94% MP) / 1.5 mi easy cool-down",
    11.4,
    12.6,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 105, repetitions: 7, repetitionsMax: 8, instructions: "alternating with 1 km @92-94%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 92, targetPacePercentMax: 94, repetitions: 7, repetitionsMax: 8 },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
];

// ---------------------------------------------------------------------------
// peak (29 unique texts, covering 30 worksheet entries -- one duplicate)
// ---------------------------------------------------------------------------

const PEAK: OverrideEntry[] = [
  entry(
    "peak",
    "7 mi easy + 5 mi progressing from moderate to ~90% 5k pace + 1 mi easy cool-down",
    13,
    13,
    [
      { stepType: "main", distanceM: miM(7), instructions: "easy" },
      { stepType: "main", distanceM: miM(5), targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, instructions: "progressing from moderate (no pct) to ~90% 5k" },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "peak",
    "8–10 mi easy to moderate with 40 min of (1 min at ~95% 5k effort, 3 min easy to moderate) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "easy to moderate; 40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "easy-to-moderate recovery, within the miles" },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 2 × (4-3-2-1 min at 96-98-100-102% 5k with 1 min moderate (~70–80% 5k) between reps and 2–3 min jog between sets) / 2 mi easy cool-down",
    null,
    null,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", durationS: minS(4), targetPacePercentBasis: FIVEK, targetPacePercentMin: 96, repetitions: 2, restS: minS(1), instructions: "set 1 of 2x(4-3-2-1 min ladder); moderate ~70-80% 5k between reps" },
      { stepType: "interval", durationS: minS(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 98, repetitions: 2, restS: minS(1), instructions: "ladder part 2" },
      { stepType: "interval", durationS: minS(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 2, restS: minS(1), instructions: "ladder part 3" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 102, repetitions: 2, restS: minS(2), restMaxS: minS(3), instructions: "ladder part 4; longer jog between sets" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 5 × 1 mi at 95% 5k with 3 min jog / 2 mi easy cool-down",
    9.0,
    9.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: miM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 5, restS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 2 × (3 km, 2 km, 1 km) at 86–88% 5k with 2 min walk between all repeats / 2 mi easy cool-down",
    11.4,
    11.4,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 88, repetitions: 2, restS: minS(2), instructions: "2x(3km / 2km / 1km); 2 min walk between all repeats" },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 88, repetitions: 2, restS: minS(2) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 88, repetitions: 2, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 7 × (1200m at 90–92% 5k, 400m at 80% 5k) / 2 mi easy cool-down",
    10.3,
    10.3,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 1200, targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 7, instructions: "7x(1200m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: FIVEK, targetPacePercentMin: 80, repetitions: 7, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "8–10 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 3 sets of: 2 km at 108% MP, 2 min walk/jog, 1 km at 110–112% MP, 4–5 min walk/jog / 2 mi easy cool-down",
    9.4,
    9.4,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, repetitions: 3, restS: minS(2), instructions: "part 1 of 3x(2 km @108% / 1 km @110-112%)" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, targetPacePercentMax: 112, repetitions: 3, restS: minS(4), restMaxS: minS(5), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "8–10 mi easy with 40 min of (1 min at ~110% MP effort, 3 min easy) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive + 4 strides / 6 × (1600m at 105–107% MP, 400m at 95–98% MP) / 2 mi easy cool-down",
    11.2,
    11.2,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 1600, targetPacePercentBasis: MP, targetPacePercentMin: 105, targetPacePercentMax: 107, repetitions: 6, instructions: "6x(1600m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: MP, targetPacePercentMin: 95, targetPacePercentMax: 98, repetitions: 6, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 4 km at 101% MP, 2 min walk, 1 km at 105% MP, 2 min walk / 3 km at 102% MP, 2 min walk, 1 km at 105% MP, 2 min walk / 2 km at 103% MP, 2 min walk, 1 km at 105% MP, 2 min walk / 1 km at 103% MP, 2 min walk, 1 km at 105% MP, 2 min walk / 2 mi easy cool-down",
    12.6,
    12.6,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "main", distanceM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 101, restS: minS(2) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, restS: minS(2) },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 102, restS: minS(2) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, restS: minS(2) },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, restS: minS(2) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, instructions: "final" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "7–9 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    7,
    9,
    [
      { stepType: "main", distanceM: miM(7), distanceMaxM: miM(9), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "peak",
    "8–10 mi easy with 12 × (1 min fast, 1 min easy run) in the middle (fast: ~112–115% MP)",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: MP, targetPacePercentMin: 112, targetPacePercentMax: 115, repetitions: 12, restS: minS(1), instructions: "fast segment, within the miles" },
    ],
  ),
  entry(
    "peak",
    "Double threshold — AM: 1.5 mi progressive warm-up + 4 strides / 7 × 1 km at 103–106% MP with 1 min jog / 0.5 mi easy cool-down",
    6.2,
    6.2,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 106, repetitions: 7, restS: minS(1) },
      { stepType: "cooldown", distanceM: miM(0.5), instructions: "AM session of double-threshold day" },
    ],
  ),
  entry(
    "peak",
    "Double threshold — PM: 1.5 mi progressive warm-up + 4 strides / 12 × 500m at 108–110% MP with 30 sec walk rest / 1 mi easy cool-down",
    6.1,
    6.1,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, restS: 30 },
      { stepType: "cooldown", distanceM: miM(1), instructions: "PM session of double-threshold day" },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 10 × (1 km at 105% MP, 1 km at 90–92% MP) / 2 mi easy cool-down",
    16.0,
    16.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 10, instructions: "alternating with 1 km @90-92%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 10 },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "8–11 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    8,
    11,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(11), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "peak",
    "Special block — AM: 3 mi progressing from easy to 95% MP, then: 5–6 × 2 km at 103% MP with 2 min walk rest / 0.5 mi very easy cool-down",
    9.5,
    10.7,
    [
      { stepType: "warmup", distanceM: miM(3), targetPacePercentBasis: MP, targetPacePercentMin: 95, instructions: "progressing easy to 95% MP" },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 103, repetitions: 5, repetitionsMax: 6, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(0.5), instructions: "very easy; AM session of special-block day" },
    ],
  ),
  entry(
    "peak",
    "Special block — PM: 3 mi progressing from easy to 95% MP, then: 4 × 500m at 108–110% MP with 30 sec walk, 4 min rest, then 3–5 km continuous at 108–110% MP / 0.5 mi very easy cool-down",
    6.6,
    7.8,
    [
      { stepType: "warmup", distanceM: miM(3), targetPacePercentBasis: MP, targetPacePercentMin: 95, instructions: "progressing easy to 95% MP" },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 4, restS: 30, instructions: "then 4 min rest before continuous block" },
      { stepType: "main", distanceM: kmM(3), distanceMaxM: kmM(5), targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, instructions: "continuous, after 4 min rest" },
      { stepType: "cooldown", distanceM: miM(0.5), instructions: "very easy; PM session of special-block day" },
    ],
  ),
  entry(
    "peak",
    "1.5 mi progressive warm-up + 4 strides / 6 × (3 km at 100% MP, 1 km at 90% MP) / 1 mi very easy cool-down",
    17.5,
    17.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 6, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 6 },
      { stepType: "cooldown", distanceM: miM(1), instructions: "very easy" },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 4–5 × 3 km at 103–105% MP w/ 2–3 min walk / 2 mi easy cool-down",
    11.6,
    13.5,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 105, repetitions: 4, repetitionsMax: 5, restS: minS(2), restMaxS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "Double threshold — AM: 1.5 mi progressive warm-up + 4 strides / 3 km at 102% MP, 2 min walk / 2 km at 103% MP, 2 min walk / 2 × 1 km at 104–106% MP with 2 min walk / 0.5 mi very easy cool-down",
    6.3,
    6.3,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 102, restS: minS(2) },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 104, targetPacePercentMax: 106, repetitions: 2, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(0.5), instructions: "very easy; AM session of double-threshold day" },
    ],
  ),
  entry(
    "peak",
    "Double threshold — PM: 1.5 mi progressive warm-up + 4 strides / 12–15 × 400m at 108–110% MP with 25 sec walk / 0.5 mi very easy cool-down",
    4.4,
    5.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, repetitionsMax: 15, restS: 25 },
      { stepType: "cooldown", distanceM: miM(0.5), instructions: "very easy; PM session of double-threshold day" },
    ],
  ),
  entry(
    "peak",
    "1.5 mi progressive warm-up + 4 strides / 6 × (4 km at 100% MP, 1 km at 90% MP) / 1 mi easy cool-down",
    21.1,
    21.1,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 6, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 6 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "peak",
    "5–6 mi easy progressing to strong (~98% MP)",
    5,
    6,
    [{ stepType: "main", distanceM: miM(5), distanceMaxM: miM(6), targetPacePercentBasis: MP, targetPacePercentMin: 98, instructions: "easy progressing to strong" }],
  ),
  entry(
    "peak",
    "6–8 mi easy with 32 min of (1 min at ~110% MP effort, 3 min easy) in the middle",
    6,
    8,
    [
      { stepType: "main", distanceM: miM(6), distanceMaxM: miM(8), instructions: "40 min... embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, repetitions: 8, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 12 × 500m at 108–110% MP with 30 sec walk / 2 mi easy cool-down",
    7.6,
    7.6,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, restS: 30 },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 8 × (1 km at 103–105% MP, 1 km at 92–94% MP) / 2 mi easy cool-down",
    13.6,
    13.6,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 105, repetitions: 8, instructions: "alternating with 1 km @92-94%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 92, targetPacePercentMax: 94, repetitions: 8 },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "peak",
    "2 mi progressive warm-up + 4 strides / 2 × 2 km at 107% MP with 3 min jog; 2–4 × 1 km at 108–110% MP with 2–3 min jog / 2 mi easy cool-down",
    7.6,
    8.8,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 107, repetitions: 2, restS: minS(3) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 2, repetitionsMax: 4, restS: minS(2), restMaxS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
];

// ---------------------------------------------------------------------------
// summit (31)
// ---------------------------------------------------------------------------

const SUMMIT: OverrideEntry[] = [
  entry(
    "summit",
    "10 mi easy + 5 mi progression from moderate to 90% 5k",
    15,
    15,
    [
      { stepType: "main", distanceM: miM(10), instructions: "easy" },
      { stepType: "main", distanceM: miM(5), targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, instructions: "progression from moderate (no pct) to 90% 5k; no cool-down stated" },
    ],
  ),
  entry(
    "summit",
    "7-10 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    7,
    10,
    [
      { stepType: "main", distanceM: miM(7), distanceMaxM: miM(10), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 6 x 2 km at 86-88% 5k pace with 2 min walk / 2 mi easy cool-down",
    11.2,
    11.2,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 88, repetitions: 6, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 4 x (1 km at 95% 5k, 2 min jog, 1 km at 100% 5k, 4 min jog) / 2 mi easy cool-down",
    8.8,
    8.8,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 4, restS: minS(2), instructions: "part 1 of 4x(1 km @95% / 1 km @100%)" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 100, repetitions: 4, restS: minS(4), instructions: "part 2" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "8-10 mi easy to moderate with 40 min of (1 min at ~95% 5k effort, 3 min moderate) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "easy to moderate; 40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "moderate recovery, within the miles" },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 6 x 1 mi at 95% 5k pace with 3 min jog / 2 mi easy cool-down",
    10.0,
    10.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: miM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 6, restS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 3-2-2-1 km at 86-92% 5k with 2 min walk / 0.5 mi easy cool-down",
    6.9,
    6.9,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 92, restS: minS(2), instructions: "3-2-2-1 km ladder" },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 92, restS: minS(2) },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 92, restS: minS(2) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 86, targetPacePercentMax: 92, instructions: "final rung" },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 4-5 x 1.5 km at 90-92% 5k pace with 1 min walk / 0.5 mi easy cool-down",
    5.6,
    6.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1.5), targetPacePercentBasis: FIVEK, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 4, repetitionsMax: 5, restS: minS(1) },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 5 x 2 km at 95% 5k with 3-4 min jog (optionally on XC terrain) / 2 mi easy cool-down",
    10.0,
    10.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 5, restS: minS(3), restMaxS: minS(4), instructions: "optionally on XC terrain" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "8-10 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    8,
    10,
    [
      { stepType: "main", distanceM: miM(8), distanceMaxM: miM(10), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 4 x 2 km at 102-103% MP with 2 min walk / 0.5 mi easy cool-down",
    6.8,
    6.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 102, targetPacePercentMax: 103, repetitions: 4, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 14-16 x 500m at 108-110% MP with 30 sec walk rest / 0.5 mi easy cool-down",
    6.2,
    6.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 14, repetitionsMax: 16, restS: 30 },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 7 x (1600m at 106-107% MP, 400m at 95% MP) / 2 mi easy cool-down",
    12.4,
    12.4,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: 1600, targetPacePercentBasis: MP, targetPacePercentMin: 106, targetPacePercentMax: 107, repetitions: 7, instructions: "7x(1600m / 400m float)" },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: MP, targetPacePercentMin: 95, repetitions: 7, instructions: "float" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "5-7 mi moderate progressing to strong (to ~98% MP)",
    5,
    7,
    [{ stepType: "main", distanceM: miM(5), distanceMaxM: miM(7), targetPacePercentBasis: MP, targetPacePercentMin: 98, instructions: "moderate progressing to strong" }],
  ),
  // W9D3a -- Brody's directive overrides the worksheet's own hedge: exactly
  // this 4-pair, 14k sequence (4k@103/1k@105, 3k@103/1k@105, 2k@103/1k@105,
  // 1k@103/1k@105), encoded as 8 main-set steps.
  entry(
    "summit",
    "4 mi progressing to 95% MP + 4 strides / 4-1, 3-1, 2-1, 1-1 km at 103 / 105% MP with 2 min walk / 0.5 mi easy cool-down",
    13.1,
    13.1,
    [
      { stepType: "warmup", distanceM: miM(4), targetPacePercentBasis: MP, targetPacePercentMin: 95, instructions: "progressing easy to 95% MP, + 4 strides" },
      { stepType: "main", distanceM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2), instructions: "pair 1 of 4: 4k@103%" },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, restS: minS(2), instructions: "pair 1 of 4: 1k@105%" },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2), instructions: "pair 2 of 4: 3k@103%" },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, restS: minS(2), instructions: "pair 2 of 4: 1k@105%" },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2), instructions: "pair 3 of 4: 2k@103%" },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, restS: minS(2), instructions: "pair 3 of 4: 1k@105%" },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, restS: minS(2), instructions: "pair 4 of 4: 1k@103%" },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, instructions: "pair 4 of 4: 1k@105% (final)" },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "4 mi progressing to 95% MP + 4 strides / 8 x 500m at 108-110% MP with 30 sec walk; 3 min rest, then: 3-4 km at 110-112% MP / 0.5 mi easy cool-down",
    8.8,
    9.4,
    [
      { stepType: "warmup", distanceM: miM(4), targetPacePercentBasis: MP, targetPacePercentMin: 95, instructions: "progressing easy to 95% MP, + 4 strides" },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 8, restS: 30, instructions: "then 3 min rest before continuous block" },
      { stepType: "main", distanceM: kmM(3), distanceMaxM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 110, targetPacePercentMax: 112, instructions: "continuous, after 3 min rest" },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "9-12 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    9,
    12,
    [
      { stepType: "main", distanceM: miM(9), distanceMaxM: miM(12), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 8-10 x (1 km at 103-105% MP, 1 km at 90-92% MP) / 1 mi easy cool-down",
    12.1,
    14.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 105, repetitions: 8, repetitionsMax: 10, instructions: "alternating with 1 km @90-92%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, targetPacePercentMax: 92, repetitions: 8, repetitionsMax: 10 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "summit",
    "6-8 mi moderate progressing to strong (to ~98% MP)",
    6,
    8,
    [{ stepType: "main", distanceM: miM(6), distanceMaxM: miM(8), targetPacePercentBasis: MP, targetPacePercentMin: 98, instructions: "moderate progressing to strong" }],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 5-6 x 4 km at 101-103% MP with 3 min walk / 2 mi easy cool-down",
    16.5,
    19.0,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(4), targetPacePercentBasis: MP, targetPacePercentMin: 101, targetPacePercentMax: 103, repetitions: 5, repetitionsMax: 6, restS: minS(3) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "10-12 mi easy with 40 min of (1 min at ~110% MP effort, 3 min easy) in the middle",
    10,
    12,
    [
      { stepType: "main", distanceM: miM(10), distanceMaxM: miM(12), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 2 x (3 km, 2 km, 1 km) at 107%, 108%, 110% MP with 4 min walk/jog / 2 mi easy cool-down",
    11.4,
    11.4,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "interval", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 107, repetitions: 2, restS: minS(4), instructions: "2x(3km@107% / 2km@108% / 1km@110%); paces map to distances in order" },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, repetitions: 2, restS: minS(4) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, repetitions: 2, restS: minS(4) },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
  entry(
    "summit",
    "10-12 mi easy with 40 min of (1 min at ~95% 5k effort, 3 min easy) in the middle",
    10,
    12,
    [
      { stepType: "main", distanceM: miM(10), distanceMaxM: miM(12), instructions: "40 min of pickups embedded" },
      { stepType: "interval", durationS: minS(1), targetPacePercentBasis: FIVEK, targetPacePercentMin: 95, repetitions: 10, restS: minS(3), instructions: "within the miles" },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 5 x (1 km at 105% MP, 1 km at 96% MP, 1 km at 105% MP, 1 km at 90% MP) / 1.5 mi easy cool-down",
    15.0,
    15.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 5, instructions: "5x(1 km @105% / 1 km @96% / 1 km @105% / 1 km @90%)" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 96, repetitions: 5 },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 105, repetitions: 5 },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 5 },
      { stepType: "cooldown", distanceM: miM(1.5) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 8 x 1 km at 102% progressing to 106% MP with 1 min walk / 0.5 mi easy cool-down",
    6.8,
    6.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 102, targetPacePercentMax: 106, repetitions: 8, restS: minS(1), instructions: "progressing 102%->106% across reps" },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 12-15 x 500m at 108-110% MP with 30 sec walk / 1 mi easy cool-down",
    6.1,
    7.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 500, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, repetitionsMax: 15, restS: 30 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 3-4 x 2 km at 102-103% MP with 2 min walk / 0.5 mi easy cool-down",
    5.6,
    6.8,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 102, targetPacePercentMax: 103, repetitions: 3, repetitionsMax: 4, restS: minS(2) },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 12-16 x 400m at 108-110% MP with 25 sec walk / 0.5 mi easy cool-down",
    4.4,
    5.2,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: 400, targetPacePercentBasis: MP, targetPacePercentMin: 108, targetPacePercentMax: 110, repetitions: 12, repetitionsMax: 16, restS: 25 },
      { stepType: "cooldown", distanceM: miM(0.5) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 5 x (5 km at 100% MP, 1 km at 90% MP) / 1 mi easy cool-down",
    21.0,
    21.0,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(5), targetPacePercentBasis: MP, targetPacePercentMin: 100, repetitions: 5, instructions: "alternating with 1 km @90%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 90, repetitions: 5 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "summit",
    "1.5 mi progressive warm-up + 4 strides / 8-10 x (1 km at 103-105% MP, 1 km at 94-96% MP) / 1 mi easy cool-down",
    12.1,
    14.5,
    [
      { stepType: "warmup", distanceM: miM(1.5) },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 103, targetPacePercentMax: 105, repetitions: 8, repetitionsMax: 10, instructions: "alternating with 1 km @94-96%" },
      { stepType: "interval", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 94, targetPacePercentMax: 96, repetitions: 8, repetitionsMax: 10 },
      { stepType: "cooldown", distanceM: miM(1) },
    ],
  ),
  entry(
    "summit",
    "2 mi progressive warm-up + 4 strides / 3 km at 107% MP, 4 min walk/jog (optional) / 2 km at 108% MP, 4 min walk/jog / 2 km at 109% MP, 4 min walk/jog / 1 km at 110-112% MP / 2 mi easy cool-down",
    8.9,
    8.9,
    [
      { stepType: "warmup", distanceM: miM(2) },
      { stepType: "main", distanceM: kmM(3), targetPacePercentBasis: MP, targetPacePercentMin: 107, restS: minS(4), instructions: "first walk/jog optional" },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 108, restS: minS(4) },
      { stepType: "main", distanceM: kmM(2), targetPacePercentBasis: MP, targetPacePercentMin: 109, restS: minS(4) },
      { stepType: "main", distanceM: kmM(1), targetPacePercentBasis: MP, targetPacePercentMin: 110, targetPacePercentMax: 112, instructions: "final" },
      { stepType: "cooldown", distanceM: miM(2) },
    ],
  ),
];

const ALL_ENTRIES: OverrideEntry[] = [...CANYON, ...MESA, MESA_W17D7, ...RIDGE, ...PEAK, ...SUMMIT];

function normalize(text: string): string {
  return text.replace(/\n/g, " / ").trim();
}

const LOOKUP = new Map<string, StructuredDay>();
for (const e of ALL_ENTRIES) {
  LOOKUP.set(`${e.program}\u0000${normalize(e.workoutText)}`, e.structured);
}

/** All hand-authored overrides, for tests that want to assert coverage/shape without re-deriving the lookup key. */
export function allHandOverrides(): OverrideEntry[] {
  return ALL_ENTRIES;
}

export function lookupHandOverride(program: string, workoutText: string): StructuredDay | null {
  return LOOKUP.get(`${program}\u0000${normalize(workoutText)}`) ?? null;
}
