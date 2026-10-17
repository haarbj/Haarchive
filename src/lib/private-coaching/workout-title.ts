// A descriptive title for a seeded framework/recovery-program day, derived
// from the exact same structured data layer framework-structure.ts and
// framework-structure-overrides.ts (Prompt 21) already attach to each
// SeedDay -- the day's prose notes, its day-level distance, and its
// structured steps (warm-up / main-set / cool-down, each with a pace
// percent where one is stated).
//
// WHY THIS EXISTS. program_days.day_label is null for every framework-
// seeded day (framework-seed.ts never sets it -- these web-PDF
// transcriptions don't name their own sessions the way Brody's own
// hand-authored canyon-program.ts does), and scheduled_workouts.title is
// equally never set at assignment. getWorkoutDisplayLabel's own fallback
// chain (day_label -> title -> "Workout") is what a coach actually sees,
// so every assigned framework day read as a bare "Workout" card with no
// way to tell an easy run from an interval session without opening it.
//
// VOCABULARY. Matches the terms the frameworks' own `structural_features`
// arrays already use ("Kenyan-style progression runs", "Float-recovery
// cruise intervals", "Alternating-kilometer sessions at/around MP") and
// canyon-program.ts's own precedent dayLabel values (Easy/Very Easy/
// Intervals/Kenyan Progression/LR/MLR/OFF/RACE/Steady State) -- extended,
// not reinvented, to cover every distinct session shape across all five
// frameworks and the recovery program. See classifyWorkoutTitle's own
// comment below for the exact decision order.
//
// NEVER "Workout". A day this module cannot confidently name still gets a
// real word describing its one actually-known characteristic (its stated
// effort word, or a generic "Quality"/"Training Day" when even that is
// missing) -- the fallback chain bottoms out in a real label, never the
// bare placeholder this module exists to replace.

export type TitleStep = {
  stepType: "warmup" | "main" | "interval" | "cooldown" | "recovery";
  targetPacePercentBasis?: string | null;
  targetPacePercentMin?: number | null;
  targetPacePercentMax?: number | null;
  repetitions?: number | null;
  restS?: number | null;
  restMaxS?: number | null;
};

export type TitleInput = {
  /** The verbatim prescription this day's title is being derived from. Null is treated the same as empty -- every seeded day has real notes, but this stays defensive for a hand-authored day that doesn't. */
  notes: string | null;
  /** Day-level distance, miles -- null is a real, common state (every time-based-main-set day Prompt 21 left unresolved), not an error. */
  distanceMiMin: number | null;
  /** Null (not merely empty) for every day with no structured steps at all -- recovery days always, and any framework day the parser/overrides couldn't structure. */
  steps: TitleStep[] | null;
};

/** 10mi+ is this module's own, explicit threshold for "long run" when the prose doesn't already say so via "rolling hills" -- matches the shortest the frameworks' own Saturday long runs ever author (see framework-structure-overrides.ts's own transcribed distances), so it never misclassifies a weekday medium-long run as an LR. */
const LONG_RUN_THRESHOLD_MI = 10;

/** The split between a "Moderate LR" and a genuinely "Quality LR" (the task's own "MP-or-faster segments" line) -- see classifyFromSteps' own comment on where this number comes from. */
const QUALITY_THRESHOLD_PERCENT = 85;

function isLongRun(notes: string, distanceMiMin: number | null): boolean {
  if (/rolling hills|through hills/i.test(notes)) return true;
  return distanceMiMin != null && distanceMiMin >= LONG_RUN_THRESHOLD_MI;
}

function hasStrides(notes: string): boolean {
  return /\d+\s*[×x]\s*\d+\s*sec\s+strides/i.test(notes);
}

function hasEmbeddedPickups(notes: string): boolean {
  return /\d+\s*min\s+of\s*\(/i.test(notes);
}

function isProgression(notes: string): boolean {
  return /progression/i.test(notes) && !/sets of|sets:/i.test(notes);
}

function isUphillRepeats(notes: string): boolean {
  return /uphill/i.test(notes);
}

/**
 * "N x M min/sec at P% of marathon pace" or "N x M min/sec fast" --
 * timed repeats at a stated percent of pace, with a jog/walk recovery
 * named alongside them (e.g. recovery program T21.2's "5-8 x 3 min at
 * 105% of marathon pace, 45 sec jog"). Checked ahead of the effort-tier
 * read below specifically because these recovery-program sessions always
 * carry a trailing warm-up/cool-down note containing the word "easy"
 * (WARM_UP_NOTE in post-race.ts), which would otherwise outrank every
 * other signal and misclassify a hard repeats session as "Easy". Distinct
 * from hasStrides (always a literal "strides" day) and from
 * isUphillRepeats (checked first, so an uphill repeats day still reads as
 * "Hill Repeats").
 */
function hasTimedRepeatsAtPace(notes: string): boolean {
  return /\d+(?:-\d+)?\s*[×x]\s*\d+\s*(?:min|sec)\s+(?:at\s+\d+(?:-\d+)?%|fast)/i.test(notes) && !hasStrides(notes);
}

/**
 * The GENERAL version of hasTimedRepeatsAtPace's own fix, above --
 * generalized from "recovery days' time-based reps phrasing specifically"
 * to "any stated percent of pace or effort, anywhere in the prose,
 * however it's structured." hasTimedRepeatsAtPace only recognizes ONE
 * shape ("N x M min/sec at P%"), which is the recovery program's own
 * idiom (post-race.ts) -- it does not recognize the frameworks' own much
 * more varied quality-session phrasing: distance-based reps ("N x Dkm at
 * P% MP"), nested multi-part sets ("3 sets of: 2 km at 108% MP, 2 min
 * walk/jog, 1 km at 110-112% MP, ..."), or a bare continuous segment
 * ("4-5 mi strong at 98-100% of marathon pace"). Those are exactly the
 * shapes framework-structure.ts's own header documents as "deliberately
 * NOT attempted" by the automatic parser (deeply nested multi-set
 * structures, hybrid distance/time chains) -- every one of those falls
 * through to a labeling-worksheet entry AND, until a hand override in
 * framework-structure-overrides.ts supplies real steps for it, to this
 * exact prose-only fallback. A session like that should never read as
 * "Easy" just because its own trailing cool-down clause contains the word
 * -- that's the live bug this function exists to close.
 *
 * Reads every "P[-P]% of marathon pace" / "P[-P]% MP" / "P[-P]% 5k"
 * occurrence in the prose and returns the HIGHEST stated percent, or null
 * if none appear at all. The caller compares this against
 * QUALITY_THRESHOLD_PERCENT -- the same threshold classifyFromSteps
 * already uses to split a structured long run into "Quality LR" vs
 * "Moderate LR" -- so a prose-only day is held to the identical bar a
 * structured one already is, not a separately-invented one. A float-
 * recovery leg stated at a genuinely low percent (e.g. Cruise Intervals'
 * own "75% 5k" float pace) never crosses this threshold on its own, so it
 * can't falsely trigger quality classification by itself -- only the
 * session's own actual work pace does.
 */
const QUALITY_PACE_PATTERN = /(\d{2,3})(?:\s*[-–]\s*\d{2,3})?\s*%\s*(?:of\s*)?(?:marathon(?:\s*pace)?|mp|5k(?:\s*pace)?)/gi;

function peakStatedQualityPercent(notes: string): number | null {
  let peak: number | null = null;
  for (const match of notes.matchAll(QUALITY_PACE_PATTERN)) {
    const value = Number(match[1]);
    if (peak == null || value > peak) peak = value;
  }
  return peak;
}

/** "N x ..." or "N sets of" -- a stated repeat count, distinguishing a reps-based quality session (-> Intervals) from a single continuous quality segment (-> Steady State/Quality LR). Prose-only heuristic, same spirit as the rest of this fallback: approximate, never fabricated. */
function hasRepsLanguage(notes: string): boolean {
  return /\d+(?:-\d+)?\s*[×x]\s*\d/.test(notes) || /\bsets?\s+of\b/i.test(notes);
}

/** "very easy" takes priority over a bare "easy" substring match (every "very easy" string also contains "easy"). */
type EffortTier = "veryEasy" | "easy" | "moderate" | "strong" | "unknown";

function effortTierFromNotes(notes: string): EffortTier {
  // "progressing to moderate/strong" and "moderate progressing to strong"
  // both read by their OWN ending tier -- the back half of the run is
  // what the athlete spends most of the harder effort at.
  if (/to\s+strong|strong\s*\(/i.test(notes)) return "strong";
  if (/to\s+moderate/i.test(notes)) return "moderate";
  if (/very\s+easy/i.test(notes)) return "veryEasy";
  if (/\bmoderate\b/i.test(notes)) return "moderate";
  if (/\bstrong\b/i.test(notes)) return "strong";
  if (/\beasy\b/i.test(notes)) return "easy";
  return "unknown";
}

/** A day with no structured steps -- every recovery day, plus any framework day the parser/overrides layer couldn't resolve into steps -- classified purely from its own prose and (when known) its day-level distance. */
function classifyPlainDay(notes: string, distanceMiMin: number | null): string {
  const trimmed = notes.trim();
  if (/^off\.?$/i.test(trimmed)) return "Off";
  if (/^off\s+or\b/i.test(trimmed)) return "Off or Easy";
  if (/\bmarathon race\b/i.test(trimmed)) return "Race";

  const longRun = isLongRun(trimmed, distanceMiMin);

  if (isProgression(trimmed)) return longRun ? "Easy LR" : "Kenyan Progression Run";
  if (isUphillRepeats(trimmed)) return "Hill Repeats";
  if (hasTimedRepeatsAtPace(trimmed)) return "Intervals";

  const tier = effortTierFromNotes(trimmed);

  // Strides/pickups are a recognizable, named pattern on top of an
  // otherwise-easy run -- but only worth calling out on its own for a
  // normal-length day; on a long run they're a minor detail inside what's
  // still fundamentally an LR.
  if (!longRun && hasStrides(trimmed)) return "Easy + Strides";
  if (!longRun && hasEmbeddedPickups(trimmed)) return "Fartlek";

  // The general fix: a stated quality percent ANYWHERE in the prose wins
  // over the naive effort-word scan below, the same way hasTimedRepeatsAtPace
  // already does for its own narrower shape. Checked last among the named-
  // pattern branches (after progression/uphill/timed-reps/strides/pickups,
  // which already produce a correct, more specific label when they match)
  // so this only ever catches what nothing more specific already named --
  // typically a nested multi-set or distance-based-reps session that
  // framework-structure.ts's own parser documents it deliberately does not
  // attempt, and that has no hand override (yet) supplying real steps.
  const peakPercent = peakStatedQualityPercent(trimmed);
  if (peakPercent != null && peakPercent >= QUALITY_THRESHOLD_PERCENT) {
    if (longRun) return "Quality LR";
    return hasRepsLanguage(trimmed) ? "Intervals" : "Steady State";
  }

  if (longRun) {
    switch (tier) {
      case "strong":
        return "Quality LR";
      case "moderate":
        return "Moderate LR";
      default:
        return "Easy LR"; // veryEasy, easy, and unknown-but-long all read as the easy long run.
    }
  }

  switch (tier) {
    case "veryEasy":
      return "Very Easy";
    case "moderate":
      return "Moderate";
    case "strong":
      return "Strong";
    case "easy":
      return "Easy";
    default:
      // No recognizable effort word at all and nothing else matched --
      // the real fallback floor. Still never the bare "Workout" this
      // module exists to replace.
      return distanceMiMin != null ? "Training Day" : "Quality";
  }
}

/**
 * A day WITH structured steps (warm-up/main/cool-down, Prompt 21's own
 * layer) -- classified from the shape of its non-warm-up/cool-down
 * ("work") steps, which is a strictly more reliable signal than prose
 * text once it exists, since it's exactly the data the parser/overrides
 * layer already committed to.
 */
function classifyFromSteps(steps: TitleStep[], notes: string, distanceMiMin: number | null): string {
  const workSteps = steps.filter((s) => s.stepType !== "warmup" && s.stepType !== "cooldown");
  if (workSteps.length === 0) return classifyPlainDay(notes, distanceMiMin);

  const longRun = isLongRun(notes, distanceMiMin);
  const pacedWorkSteps = workSteps.filter((s) => s.targetPacePercentBasis != null && s.targetPacePercentMin != null);

  // No percent anywhere in the work steps at all (e.g. an "easy with
  // pickups" day whose fartlek burst has no stated percent) -- fall back
  // to prose, same as a day with no steps at all.
  if (pacedWorkSteps.length === 0) return classifyPlainDay(notes, distanceMiMin);

  const withReps = pacedWorkSteps.filter((s) => (s.repetitions ?? 0) > 1);

  // Exactly two reps-bearing steps, each targeting a DIFFERENT percent,
  // neither carrying its own rest duration -- the float-recovery
  // structure framework-structure.ts encodes a "1200m @ 90-92% 5k, 400m
  // float @ 75-80% 5k" alternating pair as (see that file's own "RECOVERY
  // JOGS ARE NEVER COUNTED" comment: a float leg's own pace percent IS the
  // recovery, there's no separate rest_s to read). This is literally what
  // the frameworks' own structural_features call "float-recovery cruise
  // intervals" and "alternating-kilometer sessions at/around MP".
  if (
    withReps.length === 2 &&
    withReps[0].restS == null &&
    withReps[1].restS == null &&
    withReps[0].targetPacePercentMin !== withReps[1].targetPacePercentMin
  ) {
    return "Cruise Intervals";
  }

  // One or more reps-bearing steps that DO carry a real rest duration
  // (walk/jog between reps, not a float leg) -- the classic track-style
  // interval or ladder session, time- or distance-measured alike.
  if (withReps.length > 0) return "Intervals";

  // No reps at all -- one or more continuous segments. On a long run,
  // "MP-or-faster" (the task's own line) is read as the PEAK stated
  // percent crossing QUALITY_THRESHOLD_PERCENT below -- these frameworks'
  // own long-run percents split cleanly into two real bands: a sub-85%
  // continuous effort (5k-based long runs state 65-80%, matching
  // canyon-program.ts's own "~65-75% 5k pace" = moderate-effort
  // definition) versus 85%+ MP, which is explicitly one of the
  // frameworks' own named key workouts ("long fast runs at 90-95% MP").
  // Below that split, it's "Moderate LR", not "Quality LR".
  if (longRun) {
    const peakPercent = Math.max(...pacedWorkSteps.map((s) => s.targetPacePercentMin!));
    return peakPercent >= QUALITY_THRESHOLD_PERCENT ? "Quality LR" : "Moderate LR";
  }

  // Off the long run, the same shape distinction still matters: a single
  // continuous segment is a steady-state/tempo effort; a chain of several
  // (the frameworks' own multi-stage MP-progression runs, e.g. "6mi@88%MP,
  // 5mi@90%MP, 5mi@92%MP, 3-4mi@95%MP") is a progression in literal pace
  // terms, distinct from the unstructured, no-percent "Kenyan-style
  // progression run" of the general phase.
  return pacedWorkSteps.length > 1 ? "MP Progression" : "Steady State";
}

/**
 * The one entry point. Never returns "Workout" -- every path bottoms out
 * in a real word describing the day's one most-knowable characteristic,
 * down to "Training Day"/"Quality" as the absolute last resort for a day
 * with no distance, no steps, and no recognizable prose at all (a
 * genuinely unstructured conditional-variant day like mesa W17D7 before
 * auto-resolution picks a branch still has real prose to read, so it
 * resolves through classifyPlainDay like any other steps-less day, not
 * through this last-resort branch).
 */
export function classifyWorkoutTitle(input: TitleInput): string {
  const notes = input.notes ?? "";
  if (input.steps && input.steps.length > 0) return classifyFromSteps(input.steps, notes, input.distanceMiMin);
  return classifyPlainDay(notes, input.distanceMiMin);
}
