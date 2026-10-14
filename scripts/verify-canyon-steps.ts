#!/usr/bin/env -S npx tsx
// A coverage check for scripts/data/canyon-steps.ts against its source of
// truth, scripts/data/canyon-program.ts's own day-level `notes` field --
// not a DB script (reads no env vars, writes nothing). Two independent
// checks:
//
// 1. Every "N% 5k"/"N% MP"/"N-M% 5k"/"N-M% MP" percent token and every
//    "N x"/"N-M x" repetition-count token found in a day's own notes text
//    must appear somewhere in that day's authored steps (as a
//    targetPacePercentMin/Max or repetitions/repetitionsMax value) -- a
//    token present in the notes but missing from the steps means a real
//    prescription got dropped or mistranscribed while authoring.
// 2. Each phase's total planned distance (summed straight off
//    plannedDistanceM, unaffected by step authoring) must stay exactly
//    348.0 / 159.3 / 161.7 mi -- confirms this pass never touched the
//    day-level source data it's reading from.
//
// This is a coverage check, not a proof of correctness: it can't verify a
// percent was attached to the RIGHT segment of a multi-pace workout, only
// that every number mentioned in the notes shows up somewhere in the
// day's steps. It also can't parse Specific Week 2's own "98-100//100//
// 100//100-102//101-102 %" shorthand (a "//"-separated chain sharing one
// trailing "%") -- only the final segment carries a literal "%" sign, so
// only that last value is actually checked by the regex below; the other
// four segments in that one compound day were cross-checked by hand
// against canyon-steps.ts instead. Run manually:
//   npx tsx scripts/verify-canyon-steps.ts

import { CANYON_GENERAL_DAYS, CANYON_SUPPORTIVE_DAYS, CANYON_SPECIFIC_DAYS, type CanyonDayInput } from "./data/canyon-program";
import { CANYON_STEPS, type CanyonStepInput } from "./data/canyon-steps";

const MILE_METERS = 1609.344;

const PHASES: { key: "General" | "Supportive" | "Specific"; days: CanyonDayInput[]; expectedMiles: number }[] = [
  { key: "General", days: CANYON_GENERAL_DAYS, expectedMiles: 348.0 },
  { key: "Supportive", days: CANYON_SUPPORTIVE_DAYS, expectedMiles: 159.3 },
  { key: "Specific", days: CANYON_SPECIFIC_DAYS, expectedMiles: 161.7 },
];

// Only scans the table's own short first line of notes (before the blank
// line that introduces the PDF's prose commentary) -- the prose commentary
// often restates or elaborates numbers in ways that would produce false
// positives/negatives against this simple regex scan, and the table line
// is always the actual authoritative prescription anyway.
function firstLine(notes: string): string {
  return notes.split("\n")[0];
}

function percentTokens(text: string): { min: number; max: number }[] {
  const out: { min: number; max: number }[] = [];
  // Allows whitespace around the dash ("108– 110%") -- the source
  // table has at least one stray space there.
  const re = /(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const min = Number(m[1]);
    const max = m[2] ? Number(m[2]) : min;
    out.push({ min, max });
  }
  return out;
}

// Strides ("4x20s strides") are deliberately out of scope for
// program_day_steps -- the plan's own decision was to capture them as
// program_day_extras instead (a genuinely different, count/duration-only
// shape, not a paced interval) -- so a bare "Nx" immediately followed by a
// short duration + "strides" is not a missing step, it's out of this
// checker's scope entirely.
const STRIDES_RE = /\d+\s*[x×]\s*\d+s?\s*strides?/i;

function repTokens(text: string): { min: number; max: number }[] {
  if (STRIDES_RE.test(text)) return [];
  const out: { min: number; max: number }[] = [];
  const re = /(\d+)(?:\s*[-–]\s*(\d+))?\s*[x×]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const min = Number(m[1]);
    const max = m[2] ? Number(m[2]) : min;
    out.push({ min, max });
  }
  return out;
}

function stepHasPercent(steps: CanyonStepInput[], token: { min: number; max: number }): boolean {
  return steps.some((s) => s.targetPacePercentMin === token.min && (s.targetPacePercentMax ?? s.targetPacePercentMin) === token.max);
}

function stepHasReps(steps: CanyonStepInput[], token: { min: number; max: number }): boolean {
  return steps.some((s) => s.repetitions === token.min && (s.repetitionsMax ?? s.repetitions) === token.max);
}

// Documented, deliberate exceptions -- a nested "N sets of (M reps ...)"
// structure has no representation in program_day_steps (see canyon-
// steps.ts's own header comment), so it's folded into one step with
// repetitions = sets x reps, and the raw "M" from the notes (the inner
// rep count alone) will never literally match that folded value. Listed
// explicitly, by day, so a real coverage gap elsewhere can't hide behind a
// blanket exception.
const FOLDED_NESTED_SETS: { phaseKey: string; weekNumber: number; dayOfWeek: number }[] = [
  { phaseKey: "General", weekNumber: 6, dayOfWeek: 1 }, // "2 sets of: (6 x 500m ...)" -> repetitions: 12
];

let problems = 0;

for (const phase of PHASES) {
  for (const day of phase.days) {
    const entry = CANYON_STEPS.find((e) => e.phaseKey === phase.key && e.weekNumber === day.weekNumber && e.dayOfWeek === day.dayOfWeek);
    const line = firstLine(day.notes);
    const percents = percentTokens(line);
    const isFoldedNestedSet = FOLDED_NESTED_SETS.some(
      (f) => f.phaseKey === phase.key && f.weekNumber === day.weekNumber && f.dayOfWeek === day.dayOfWeek,
    );
    const reps = isFoldedNestedSet ? [] : repTokens(line);
    if (percents.length === 0 && reps.length === 0) continue; // nothing structured to check for this day

    if (!entry) {
      console.error(`MISSING STEPS: ${phase.key} W${day.weekNumber}D${day.dayOfWeek} ("${line}") has percent/rep tokens but no CANYON_STEPS entry.`);
      problems += 1;
      continue;
    }

    for (const token of percents) {
      if (!stepHasPercent(entry.steps, token)) {
        console.error(
          `MISSING PERCENT: ${phase.key} W${day.weekNumber}D${day.dayOfWeek} ("${line}") mentions ${token.min}${token.max !== token.min ? `-${token.max}` : ""}% but no step carries that exact target.`,
        );
        problems += 1;
      }
    }
    for (const token of reps) {
      if (!stepHasReps(entry.steps, token)) {
        console.error(
          `MISSING REPS: ${phase.key} W${day.weekNumber}D${day.dayOfWeek} ("${line}") mentions ${token.min}${token.max !== token.min ? `-${token.max}` : ""}x but no step carries that exact repetitions value.`,
        );
        problems += 1;
      }
    }
  }

  const totalMiles = phase.days.reduce((sum, d) => sum + (d.plannedDistanceM ?? 0), 0) / MILE_METERS;
  if (Math.abs(totalMiles - phase.expectedMiles) > 0.05) {
    console.error(`PHASE TOTAL CHANGED: ${phase.key} is ${totalMiles.toFixed(1)} mi, expected ${phase.expectedMiles.toFixed(1)} mi.`);
    problems += 1;
  } else {
    console.log(`${phase.key} phase total: ${totalMiles.toFixed(1)} mi (expected ${phase.expectedMiles.toFixed(1)} mi) -- OK`);
  }
}

const structuredDayCount = CANYON_STEPS.length;
console.log(`\n${structuredDayCount} structured days authored across all three phases.`);

if (problems > 0) {
  console.error(`\n${problems} coverage problem(s) found.`);
  process.exit(1);
}
console.log("\nAll percent and repetition tokens found in the source notes are covered by CANYON_STEPS.");
