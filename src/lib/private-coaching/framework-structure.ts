// A separate, visibly-distinct interpretation layer on top of
// framework-seed.ts's pristine transcription. That file's own header
// forbids splitting a session's prose into program_day_steps or deriving
// a numeric distance/pace target from it -- Brody has explicitly
// authorized exactly that interpretation for this module only (see the
// task that created it), on the condition that nothing here guesses.
// Every rule below resolves a day's distance/steps ONLY when the source
// text states the arithmetic directly (a stated "mi"/"km" quantity, a
// stated rep count, a stated percent, a stated rest). The moment a
// session's total distance would require ASSUMING a pace (any reps or
// recovery stated only in minutes/seconds, with no distance anywhere to
// fall back on), this module refuses to compute one and flags the day for
// Brody's own labeling worksheet instead -- see buildLabelingWorksheet.ts
// and the worksheet type below.
//
// WHAT THIS DOES NOT ATTEMPT. Deeply nested multi-set structures ("3 sets
// of: (3 min at 98% 5k, 1 min jog, 3 min at 100-102% 5k, 4 min walk/jog)"),
// hybrid distance+time chains ("4 km at 101% MP, 2 min walk, 1 km at 105%
// MP, 2 min walk / ..."), and conditional/alternative prescriptions ("...
// if the marathon is on a Sunday ... or: ... if Saturday") are real,
// common shapes in these frameworks that this module deliberately does
// NOT try to parse -- a wrong parse of one of these would be a silent,
// undetectable training error. They fall through to the worksheet
// unstructured, exactly like a session this module can't recognize at
// all. Recognized shapes are the common ones: a plain easy/moderate/
// progression day (the majority), a continuous tempo/progression segment
// or chain of them stated in miles, and a warm-up + main-set + cool-down
// structure whose main set is either continuous-at-a-percent or simple
// reps (time- or distance-based).
//
// A TIME-BASED MAIN SET'S DAY TOTAL IS PERMANENTLY NULL, NOT A WORKSHEET
// QUESTION. When a main set is stated in minutes ("10 x 1.5 min at 100%
// 5k"), its distance contribution depends on the athlete's own resolved
// pace for that percent -- the exact same live, per-athlete resolution
// pace_percent_basis/_min/_max already gets everywhere else in this
// schema (see program-generation.ts's own comment on passing percent
// targets through "unresolved" for live resolution against fitness
// estimates). There is no single number Brody could write down that
// would be right for every athlete, so this isn't a labeling-worksheet
// question at all -- it's the same case workout-distance.ts's own
// getWorkoutPlannedDistanceM already documents for any duration-only
// step ("guessing one from pace would be fabricating data, not reading
// it... the weekly total simply omits it rather than estimating"). The
// day's warm-up/cool-down distance and the main set's own duration/reps/
// rest/pace-percent are still fully structured below; only the day-level
// total stays null, permanently, by design.
//
// RECOVERY JOGS ARE NEVER COUNTED TOWARD DISTANCE. A rep's own work
// distance/duration is read directly off the text; the jog/walk between
// reps is carried into the step as rest_s (a literal, stated number) but
// never converted to miles, because doing so would require assuming a
// recovery pace the text never states. This is a declared, uniform policy
// applied to every interval session alike, not a per-day judgment call.
//
// STRIDES NEVER ADD DISTANCE. "4-5 mi easy with 4 x 20 sec strides" is a
// days-already-counted-them 4-5 mi day, matching the task's own worked
// example ("5 mi progression + 0.5 mi CD" -> 5.5, no stride allowance) --
// strides happen within or appended to the stated run, not on top of it.

import { MILE_METERS } from "@/lib/race-distances";
import type { FrameworkSeedPlan, RawFramework, RawFrameworkSession } from "@/lib/private-coaching/framework-seed";
import { lookupHandOverride } from "@/lib/private-coaching/framework-structure-overrides";

export type PaceBasis = "5k" | "marathon";

export type SeedDayStep = {
  stepOrder: number;
  stepType: "warmup" | "main" | "interval" | "cooldown";
  durationS: number | null;
  durationMaxS: number | null;
  distanceM: number | null;
  distanceMaxM: number | null;
  targetPacePercentBasis: PaceBasis | null;
  targetPacePercentMin: number | null;
  targetPacePercentMax: number | null;
  repetitions: number | null;
  repetitionsMax: number | null;
  restS: number | null;
  restMaxS: number | null;
  instructions: string | null;
};

/**
 * One branch of a day whose prescription genuinely depends on an
 * external condition unknowable at template-authoring time (so far,
 * exactly one case: mesa W17D7's "if the marathon is on a Sunday ... or:
 * ... if Saturday"). Brody's own directive on this: bake both variants
 * into the template rather than picking one -- see HAND_STRUCTURED_
 * SESSIONS's own entry for mesa W17D7 and this file's closing note on
 * the (deliberately out-of-scope) auto-resolution follow-up.
 */
export type ConditionalVariant = {
  condition: "saturday-marathon" | "sunday-marathon";
  distanceMiMin: number | null;
  distanceMiMax: number | null;
  steps: SeedDayStep[] | null;
};

export type StructuredDay = {
  distanceMiMin: number | null;
  distanceMiMax: number | null;
  steps: SeedDayStep[] | null;
  /**
   * Set only for a day that branches on a condition no template can
   * resolve on its own -- when set, distanceMiMin/distanceMiMax/steps
   * above are deliberately null (there is no single answer) and the
   * real content lives here, one entry per condition. See
   * ConditionalVariant's own comment.
   */
  conditionalVariants?: ConditionalVariant[];
};

export type WorksheetEntry = {
  program: string;
  week: number;
  day: number;
  prescription: string;
  question: string;
};

const MARATHON_DISTANCE_MI = 26.2;

function mi(n: number): number {
  return Math.round(n * 100) / 100;
}

function kmToMi(km: number): number {
  return Math.round(((km * 1000) / MILE_METERS) * 10) / 10;
}

/** "1.5" / "1" -> 1.5. Both the ASCII hyphen and en/em dash appear as range separators, same as framework-seed.ts's own RANGE_SEPARATOR. */
const RANGE_SEPARATOR = /[-–—]/;
const NUM = /[\d.]+/;

function parseNumOrRange(raw: string): { min: number; max: number | null } {
  const parts = raw.trim().split(RANGE_SEPARATOR).map((p) => p.trim());
  const nums = parts.map(Number);
  return { min: nums[0], max: nums.length > 1 && Number.isFinite(nums[1]) ? nums[1] : null };
}

/** Every distinct "<N>[-<N>] mi|km" quantity in a clause, each optionally preceded by a "+" continuation marker -- the shape "X mi progression + Y mi easy cool-down" and "X mi\n+ Y mi easy cool-down" both use. */
const DISTANCE_TOKEN = new RegExp(`(?:^|\\+)\\s*(${NUM.source}(?:\\s*${RANGE_SEPARATOR.source}\\s*${NUM.source})?)\\s*(mi|km)\\b`, "gi");

function sumDistanceTokens(text: string): { min: number; max: number } | null {
  const matches = [...text.matchAll(DISTANCE_TOKEN)];
  if (matches.length === 0) return null;
  let min = 0;
  let max = 0;
  for (const m of matches) {
    const { min: lo, max: hi } = parseNumOrRange(m[1]);
    const unit = m[2].toLowerCase();
    const loMi = unit === "km" ? kmToMi(lo) : lo;
    const hiMi = hi == null ? loMi : unit === "km" ? kmToMi(hi) : hi;
    min += loMi;
    max += hiMi;
  }
  return { min: mi(min), max: mi(max) };
}

function isOff(text: string): boolean {
  return /^off\.?$/i.test(text.trim());
}

function isOffOr(text: string): boolean {
  return /^off\s+or\b/i.test(text.trim());
}

function isConditionalAlternative(text: string): boolean {
  return /if (?:the )?marathon is on a/i.test(text);
}

function isMarathonRaceDay(text: string): boolean {
  return /\bmarathon race\b/i.test(text);
}

// Built via the RegExp constructor rather than a literal -- this project's
// tsconfig target (ES2017) predates TS's support for named-group literal
// regex syntax, though the runtime itself handles named groups fine.
const PACE_BASIS_PATTERN = new RegExp("~?(?<pctLo>\\d[\\d.]*)(?:\\s*[-–—]\\s*(?<pctHi>\\d[\\d.]*))?%\\s*(?<basis>5k|mp|marathon)\\b", "i");

function paceBasisOf(label: string): PaceBasis {
  return /mp|marathon/i.test(label) ? "marathon" : "5k";
}

/** "<N>[-<N>] mi|km at <P>[-<P>]% <5k|MP>" (optionally "... pace", "... effort", "through rolling hills") -- a single continuous quality segment with nothing left over. */
function parseContinuousSegment(clause: string): { distMi: { min: number; max: number }; basis: PaceBasis; pctMin: number; pctMax: number | null } | null {
  const trimmed = clause.trim();
  const distMatch = new RegExp(`^(${NUM.source}(?:\\s*${RANGE_SEPARATOR.source}\\s*${NUM.source})?)\\s*(mi|km)\\s+at\\s+(.+)$`, "i").exec(trimmed);
  if (!distMatch) return null;
  const pctMatch = PACE_BASIS_PATTERN.exec(distMatch[3]);
  // Reject if the tail after "at" carries anything beyond the percent clause and
  // an innocuous trailing descriptor -- a second "at"/comma-joined target in the
  // same segment means this isn't really a single unambiguous clause.
  if (!pctMatch) return null;
  const tailAfterPct = distMatch[3].slice(pctMatch.index + pctMatch[0].length);
  if (/\d/.test(tailAfterPct)) return null;

  const { min: loD, max: hiD } = parseNumOrRange(distMatch[1]);
  const unit = distMatch[2].toLowerCase();
  const distMin = unit === "km" ? kmToMi(loD) : loD;
  const distMax = hiD == null ? distMin : unit === "km" ? kmToMi(hiD) : hiD;
  const g = pctMatch.groups!;
  const { min: loP, max: hiP } = parseNumOrRange(`${g.pctLo}${g.pctHi ? `-${g.pctHi}` : ""}`);

  return { distMi: { min: mi(distMin), max: mi(distMax) }, basis: paceBasisOf(g.basis), pctMin: loP, pctMax: hiP };
}

/** "<N>[-<N>] x|× <T> min at <P>[-<P>]% <5k|MP> with <R>[-<R>] sec|min jog" -- time-based reps, distance deliberately not computed. */
/** Named-group rest clause shared by both rep parsers: "with <R>[-<R>] sec|min jog". */
function parseRestGroups(g: Record<string, string | undefined>): { restS: number | null; restMaxS: number | null } {
  if (!g.restLo) return { restS: null, restMaxS: null };
  const restRange = parseNumOrRange(`${g.restLo}${g.restHi ? `-${g.restHi}` : ""}`);
  const mult = g.restUnit!.toLowerCase() === "min" ? 60 : 1;
  return {
    restS: Math.round(restRange.min * mult),
    restMaxS: restRange.max != null ? Math.round(restRange.max * mult) : null,
  };
}

// "pace" sometimes trails the basis label itself ("90-92% 5k pace with 45
// sec jog") -- an optional, inert word, not a second target to parse.
const REST_CLAUSE = `(?:\\s+pace)?(?:\\s+with\\s+(?<restLo>${NUM.source})(?:\\s*${RANGE_SEPARATOR.source}\\s*(?<restHi>${NUM.source}))?\\s*(?<restUnit>sec|min)\\s+jog)?\\.?$`;

function parseTimeReps(clause: string): {
  reps: { min: number; max: number | null };
  durationS: number;
  basis: PaceBasis;
  pctMin: number;
  pctMax: number | null;
  restS: number | null;
  restMaxS: number | null;
} | null {
  const re = new RegExp(
    `^(?<reps>${NUM.source}(?:\\s*${RANGE_SEPARATOR.source}\\s*${NUM.source})?)\\s*[×x]\\s*(?<durMin>${NUM.source})\\s*min\\s+at\\s+${PACE_BASIS_PATTERN.source}${REST_CLAUSE}`,
    "i",
  );
  const m = re.exec(clause.trim());
  if (!m?.groups) return null;
  const g = m.groups;
  const reps = parseNumOrRange(g.reps);
  const { min: pctMin, max: pctMax } = parseNumOrRange(`${g.pctLo}${g.pctHi ? `-${g.pctHi}` : ""}`);
  const { restS, restMaxS } = parseRestGroups(g);
  return { reps, durationS: Math.round(Number(g.durMin) * 60), basis: paceBasisOf(g.basis), pctMin, pctMax, restS, restMaxS };
}

/** "<N>[-<N>] x|× <D> km|m at <P>[-<P>]% <5k|MP> with <R>[-<R>] sec|min jog" -- distance-based reps, fully summable. */
function parseDistanceReps(clause: string): {
  reps: { min: number; max: number | null };
  distMi: number;
  basis: PaceBasis;
  pctMin: number;
  pctMax: number | null;
  restS: number | null;
  restMaxS: number | null;
} | null {
  const re = new RegExp(
    `^(?<reps>${NUM.source}(?:\\s*${RANGE_SEPARATOR.source}\\s*${NUM.source})?)\\s*[×x]\\s*(?<dist>${NUM.source})\\s*(?<unit>km|m)\\s+at\\s+${PACE_BASIS_PATTERN.source}${REST_CLAUSE}`,
    "i",
  );
  const m = re.exec(clause.trim());
  if (!m?.groups) return null;
  const g = m.groups;
  const reps = parseNumOrRange(g.reps);
  const distMi = g.unit.toLowerCase() === "km" ? kmToMi(Number(g.dist)) : mi(Number(g.dist) / MILE_METERS);
  const { min: pctMin, max: pctMax } = parseNumOrRange(`${g.pctLo}${g.pctHi ? `-${g.pctHi}` : ""}`);
  const { restS, restMaxS } = parseRestGroups(g);
  return { reps, distMi, basis: paceBasisOf(g.basis), pctMin, pctMax, restS, restMaxS };
}

/** "<N>[-<N>] mi progressive[ warm-up][ + N strides]" -- the frameworks' own fixed warm-up idiom. */
function parseWarmupClause(clause: string): { min: number; max: number } | null {
  const m = new RegExp(`^(${NUM.source}(?:\\s*${RANGE_SEPARATOR.source}\\s*${NUM.source})?)\\s*mi\\s+progressiv\\w*(?:\\s+warm-?up)?(?:\\s*\\+\\s*\\d+\\s*strides?)?\\.?$`, "i").exec(
    clause.trim(),
  );
  if (!m) return null;
  const { min, max } = parseNumOrRange(m[1]);
  return { min: mi(min), max: mi(max ?? min) };
}

/** "No cool-down" | "<N>[-<N>] mi (very )?easy cool-down" -- the frameworks' own fixed cool-down idiom. */
function parseCooldownClause(clause: string): { min: number; max: number } | "none" | null {
  const trimmed = clause.trim();
  if (/^no\s+cool-?down\.?$/i.test(trimmed)) return "none";
  const m = new RegExp(`^(${NUM.source}(?:\\s*${RANGE_SEPARATOR.source}\\s*${NUM.source})?)\\s*mi\\s+(?:very\\s+)?easy\\s+cool-?down\\.?$`, "i").exec(trimmed);
  if (!m) return null;
  const { min, max } = parseNumOrRange(m[1]);
  return { min: mi(min), max: mi(max ?? min) };
}

function splitClauses(text: string): string[] {
  return text
    .split(/\n|\s\/\s/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * The quality-session (percent-bearing) path: warm-up + main-set +
 * cool-down, where the main set is either one continuous segment, a chain
 * of continuous segments, or one reps clause (time- or distance-based).
 * Returns null -- not a worksheet verdict yet -- when the shape isn't one
 * of these recognized ones; the caller decides what to do with null.
 */
function parseQualitySession(clauses: string[]): StructuredDay | null {
  if (clauses.length < 2) return null;
  const warmup = parseWarmupClause(clauses[0]);
  if (!warmup) return null;

  // The real corpus sometimes spreads a chain of continuous MP-progression
  // segments across several newline-separated clauses rather than one
  // comma-joined line ("6 mi at 90% MP\n5 mi at 92% MP\n5-6 mi at 94% MP"),
  // so the last clause is checked for a cool-down shape and everything
  // else in between is the main set, however many clauses that spans.
  const lastParsed = parseCooldownClause(clauses[clauses.length - 1]);
  const cooldown = lastParsed === null || lastParsed === "none" ? null : lastParsed;
  const middleClauses = lastParsed === null ? clauses.slice(1) : clauses.slice(1, -1);
  if (middleClauses.length === 0) return null;

  const mainClause = middleClauses.join(", ");
  const steps: SeedDayStep[] = [
    { stepOrder: 1, stepType: "warmup", durationS: null, durationMaxS: null, distanceM: warmup.min * MILE_METERS, distanceMaxM: warmup.max !== warmup.min ? warmup.max * MILE_METERS : null, targetPacePercentBasis: null, targetPacePercentMin: null, targetPacePercentMax: null, repetitions: null, repetitionsMax: null, restS: null, restMaxS: null, instructions: null },
  ];

  // Chain of continuous segments, e.g. "6 mi at 88% MP, 5 mi at 90% MP, 5 mi at 92% MP, 3-4 mi at 95% MP".
  const chainParts = mainClause.split(/,|;/).map((p) => p.trim()).filter(Boolean);
  const chainSegments = chainParts.map(parseContinuousSegment);
  let mainDistMin = 0;
  let mainDistMax = 0;
  let mainResolvable = false;

  if (chainSegments.every((s) => s != null)) {
    mainResolvable = true;
    chainSegments.forEach((seg, i) => {
      if (!seg) return;
      mainDistMin += seg.distMi.min;
      mainDistMax += seg.distMi.max;
      steps.push({
        stepOrder: steps.length + 1,
        stepType: "main",
        durationS: null,
        durationMaxS: null,
        distanceM: seg.distMi.min * MILE_METERS,
        distanceMaxM: seg.distMi.max !== seg.distMi.min ? seg.distMi.max * MILE_METERS : null,
        targetPacePercentBasis: seg.basis,
        targetPacePercentMin: seg.pctMin,
        targetPacePercentMax: seg.pctMax,
        repetitions: null,
        repetitionsMax: null,
        restS: null,
        restMaxS: null,
        instructions: chainParts.length > 1 ? chainParts[i] : null,
      });
    });
  } else {
    const distReps = parseDistanceReps(mainClause);
    if (distReps) {
      mainResolvable = true;
      const repMin = distReps.reps.min;
      const repMax = distReps.reps.max ?? repMin;
      mainDistMin += repMin * distReps.distMi;
      mainDistMax += repMax * distReps.distMi;
      steps.push({
        stepOrder: steps.length + 1,
        stepType: "interval",
        durationS: null,
        durationMaxS: null,
        distanceM: distReps.distMi * MILE_METERS,
        distanceMaxM: null,
        targetPacePercentBasis: distReps.basis,
        targetPacePercentMin: distReps.pctMin,
        targetPacePercentMax: distReps.pctMax,
        repetitions: distReps.reps.min,
        repetitionsMax: distReps.reps.max,
        restS: distReps.restS,
        restMaxS: distReps.restMaxS,
        instructions: null,
      });
    } else {
      const timeReps = parseTimeReps(mainClause);
      if (timeReps) {
        // Time-based work: the main set's own distance can't be computed
        // without assuming a pace, so the day-level total stays
        // unresolved -- but every literally-stated number (duration,
        // reps, rest, percent) is still real, structured data.
        steps.push({
          stepOrder: steps.length + 1,
          stepType: "interval",
          durationS: timeReps.durationS,
          durationMaxS: null,
          distanceM: null,
          distanceMaxM: null,
          targetPacePercentBasis: timeReps.basis,
          targetPacePercentMin: timeReps.pctMin,
          targetPacePercentMax: timeReps.pctMax,
          repetitions: timeReps.reps.min,
          repetitionsMax: timeReps.reps.max,
          restS: timeReps.restS,
          restMaxS: timeReps.restMaxS,
          instructions: null,
        });
      } else {
        return null;
      }
    }
  }

  if (cooldown) {
    steps.push({
      stepOrder: steps.length + 1,
      stepType: "cooldown",
      durationS: null,
      durationMaxS: null,
      distanceM: cooldown.min * MILE_METERS,
      distanceMaxM: cooldown.max !== cooldown.min ? cooldown.max * MILE_METERS : null,
      targetPacePercentBasis: null,
      targetPacePercentMin: null,
      targetPacePercentMax: null,
      repetitions: null,
      repetitionsMax: null,
      restS: null,
      restMaxS: null,
      instructions: null,
    });
  }

  if (!mainResolvable) {
    // Time-based main set: steps are real, but no day-level total.
    return { distanceMiMin: null, distanceMiMax: null, steps };
  }

  const totalMin = warmup.min + mainDistMin + (cooldown?.min ?? 0);
  const totalMax = warmup.max + mainDistMax + (cooldown?.max ?? 0);
  return { distanceMiMin: mi(totalMin), distanceMiMax: mi(totalMax), steps };
}

/**
 * One session's full result: a structured day (possibly with a null
 * distance and/or null steps where genuinely unresolvable) plus an
 * optional worksheet question when something about the day needs Brody's
 * own judgment.
 */
export function structureSession(workout: string): { structured: StructuredDay; worksheetQuestion: string | null } {
  const text = workout.trim();

  if (isOff(text)) return { structured: { distanceMiMin: null, distanceMiMax: null, steps: null }, worksheetQuestion: null };
  if (isOffOr(text)) return { structured: { distanceMiMin: null, distanceMiMax: null, steps: null }, worksheetQuestion: null };
  if (isConditionalAlternative(text)) {
    return {
      structured: { distanceMiMin: null, distanceMiMax: null, steps: null },
      worksheetQuestion:
        "Total session distance? Two alternative prescriptions depending on race-day weekday (Sunday: progression + cool-down; Saturday: easy progressing to moderate alone) -- which applies isn't resolvable from the template alone.",
    };
  }

  const hasPercent = text.includes("%");

  if (!hasPercent) {
    if (isMarathonRaceDay(text)) {
      const others = text.replace(/marathon race/i, "");
      const rest = sumDistanceTokens(others);
      const min = mi((rest?.min ?? 0) + MARATHON_DISTANCE_MI);
      const max = mi((rest?.max ?? 0) + MARATHON_DISTANCE_MI);
      return { structured: { distanceMiMin: min, distanceMiMax: max, steps: null }, worksheetQuestion: null };
    }
    const sum = sumDistanceTokens(text);
    if (sum) return { structured: { distanceMiMin: sum.min, distanceMiMax: sum.max, steps: null }, worksheetQuestion: null };
    return {
      structured: { distanceMiMin: null, distanceMiMax: null, steps: null },
      worksheetQuestion: "Total session distance? No stated mi/km quantity found by the parser -- needs a hand read.",
    };
  }

  const clauses = splitClauses(text);
  const quality = parseQualitySession(clauses);
  if (quality) {
    // A null distanceMiMin here means the main set was time-based --
    // permanently unresolvable without assuming a pace, per this file's
    // own header, and deliberately NOT a worksheet question (Brody
    // confirmed: there's no single number that's right for every
    // athlete, so don't ask for one). Steps are already fully structured.
    return { structured: quality, worksheetQuestion: null };
  }

  return {
    structured: { distanceMiMin: null, distanceMiMax: null, steps: null },
    worksheetQuestion:
      "Total session distance and step structure? This session's shape (nested sets, a hybrid distance/time chain, or an irregular warm-up/cool-down clause) isn't one of the patterns this parser recognizes -- needs a hand read end to end.",
  };
}

/**
 * Walks a RawFramework in EXACTLY the same order buildFrameworkSeed does
 * (weeks -> days Monday-first -> sessions) so the i-th result here lines
 * up with the i-th SeedDay that function produces -- the index-based
 * mapping the task calls for, with zero changes to that pristine
 * transcription function.
 */
export function structureFramework(raw: RawFramework): { structured: StructuredDay[]; worksheet: WorksheetEntry[] } {
  const structured: StructuredDay[] = [];
  const worksheet: WorksheetEntry[] = [];
  const programName = raw.framework.trim();

  for (const week of raw.weeks) {
    week.days.forEach((day, dayIndex) => {
      for (const session of day.sessions) {
        const workoutText = (session as RawFrameworkSession).workout;
        // A hand-authored override (Brody's own labeling-worksheet answer,
        // encoded in framework-structure-overrides.ts) always wins over
        // the automatic parser and never produces a worksheet entry --
        // it's already been hand-read end to end.
        const override = lookupHandOverride(programName, workoutText);
        if (override) {
          structured.push(override);
          continue;
        }

        const { structured: day1, worksheetQuestion } = structureSession(workoutText);
        structured.push(day1);
        if (worksheetQuestion) {
          worksheet.push({
            program: programName,
            week: week.week,
            day: dayIndex + 1,
            prescription: session.workout,
            question: worksheetQuestion,
          });
        }
      }
    });
  }

  return { structured, worksheet };
}

/**
 * Merges this layer's output onto a FrameworkSeedPlan already built by
 * buildFrameworkSeed, by array index -- plan.days and structureFramework's
 * result walk the exact same raw.weeks/days/sessions traversal, so index i
 * in each always describes the same real session. buildFrameworkSeed
 * itself is never called or modified here; this only reads its output.
 */
export function attachFrameworkStructure(plan: FrameworkSeedPlan, raw: RawFramework): { plan: FrameworkSeedPlan; worksheet: WorksheetEntry[] } {
  const { structured, worksheet } = structureFramework(raw);
  if (structured.length !== plan.days.length) {
    throw new Error(`${raw.framework}: structured ${structured.length} sessions but buildFrameworkSeed produced ${plan.days.length} days -- traversal mismatch`);
  }
  const days = plan.days.map((day, i) => ({
    ...day,
    distanceMiMin: structured[i].distanceMiMin,
    distanceMiMax: structured[i].distanceMiMax,
    steps: structured[i].steps,
    conditionalVariants: structured[i].conditionalVariants,
  }));
  return { plan: { ...plan, days }, worksheet };
}

// ---------------------------------------------------------------------------
// FOLLOW-UP, OUT OF SCOPE HERE: conditionalVariants auto-resolution
// ---------------------------------------------------------------------------
//
// mesa W17D7 (and any future day shaped like it) is seeded with BOTH
// variants present on the SeedDay/program_days row -- this module's job
// stops at making that data exist. Resolving which variant actually
// applies to a given athlete's generated schedule is a separate,
// not-yet-built step in program-generation.ts (or wherever a program's
// days become a real ResolvedProgramDay), and Brody's own rule for that
// follow-up is: resolve from the athlete's target event date's weekday --
// a Saturday marathon selects "saturday-marathon", anything else selects
// "sunday-marathon", and a program with no target event date set defaults
// to "sunday-marathon". No coach-facing picker. Until that step exists, a
// day with conditionalVariants set has no top-level distance/steps at all
// (see ConditionalVariant's own comment) and will render exactly as empty
// as any other day this module left unresolved.
