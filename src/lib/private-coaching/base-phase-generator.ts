import { buildTrainingLoadPlan } from "@/lib/training-load-planner-math";
import { zoneForRatio, type AcwrZone } from "@/lib/acwr";
import { WEEKLY_INCREASE_CAP } from "@/lib/coaching-engine/mileage-progression";

// Turns the Training Load Planner's own safe-build math into a week-by-week
// base phase a coach can review before adding it to an athlete's schedule
// (see the planner at /training-load-planner, src/lib/training-load-planner-math.ts).
//
// REUSED, UNCHANGED from the planner (do not re-derive): the "beginner" path
// below still calls buildTrainingLoadPlan() unmodified -- the exact same
// function the public tool calls -- so a beginner's assessment here is
// never different from what the Training Load Planner itself would say for
// the same numbers. The long-run cap still reuses WEEKLY_INCREASE_CAP (the
// platform's one 10% constant) rather than a second hardcoded 0.1. The
// restart-step logic, the injury gate, and both guardrails are the same
// logic as before this revision -- only how a week's TOTAL splits into
// individual days changed (see below).
//
// REVISED in this pass: the within-week split used to be a flat 30%-long-
// run / evenly-split-easy-days guess. It's now the coach's actual method --
// built backwards from the target plan's first workout week, using a
// percentage template keyed to that week's own day count:
//   - A day count of 3-6 is composed as 1 long run + N medium-long runs
//     (MLRs, mirroring the plan's general-phase workout-day count) + however
//     many easy days are left. Easy days are what frequency ramps add/drop
//     first; the long run and MLRs are the fixed structural anchors at every
//     day count (confirmed against the task's own worked examples: a 3-day
//     week is always 1 long run + 2 MLRs + 0 easy days).
//   - Relative weights long=28, MLR=18 (each), easy=12 (each) are the 6-day
//     week's own given percentages (28+18+18+12+12+12=100). Dropping a role
//     at a lower day count and renormalizing the remaining weights to 100%
//     reproduces the spec's 3-day example exactly (9 mi -> 2.5/2.5/4, see
//     this module's own test coverage) without a separate special-cased
//     formula for low mileage -- the long run's larger share at low mileage
//     falls out of the renormalization on its own, same as the task says.
//   - The long run is still the binding constraint: after the template
//     assigns it a share, it's capped at no more than WEEKLY_INCREASE_CAP
//     above the previous week's actual long run, with any shortfall handed
//     back to the MLRs/easy days (weighted the same way), same mechanism as
//     before, just redistributing across whichever day types exist that
//     week instead of assuming easy days always exist (a 3-day week has
//     none).

export type BasePhaseAthleteType = "restarting" | "beginner";

export type BasePhaseTargetWeek = {
  /** The plan's own first workout week total mileage -- the base phase's endpoint. */
  totalMiles: number;
  /** That week's own day count (3-6; Sunday is always off, so 6 is the ceiling). */
  daysPerWeek: number;
  /** How many of those days are workout days (tempo/VO2/etc.) in the plan's general phase -- sets how many MLRs the base phase builds toward. Typically 2. */
  workoutDaysPerWeek: number;
};

export type BasePhaseInput = {
  startingWeeklyMiles: number;
  targetWeek: BasePhaseTargetWeek;
  weeksAvailable: number;
  /**
   * Coach-asserted, same pattern as strength-scheduling.ts's gating facts --
   * never auto-diagnosed. "restarting": has run consistently before, just
   * currently below the plan's starting mileage (the feature's main case).
   * "beginner": no real aerobic base, must follow the platform's standard
   * 10% rule, same as everyone else's ongoing training.
   */
  athleteType: BasePhaseAthleteType;
  /** Current running days/week. Clamped into the defined 3-6 template range -- see MIN_DAYS_PER_WEEK's own comment. */
  currentDaysPerWeek: number;
  /** Longest run in the prior 30 days, miles. Null if unknown -- falls back to the starting week's own template long-run share. */
  longestRunInLast30DaysMiles: number | null;
  /** Only applies to the "restarting" path; ignored for "beginner" (always the 10% rule). Defaults to DEFAULT_RESTART_STEP_MILES. */
  restartStepMiles?: number;
};

export type BasePhaseWeek = {
  weekNumber: number;
  totalMiles: number;
  daysPerWeek: number;
  longRunMiles: number;
  longRunCapped: boolean;
  /** One entry per MLR day this week (mirrors targetWeek.workoutDaysPerWeek, capped by how many non-long-run slots the day count has). */
  mlrMiles: number[];
  /** One entry per easy day this week -- the role frequency ramps add/drop first. */
  easyMiles: number[];
  /** Informational only -- see the restarting-path comment below on why this is never itself a block. */
  acwrZone: AcwrZone | null;
  notes: string[];
};

export type BasePhaseGuardrail =
  | { tooAggressive: true; reason: string; weeksNeeded: number; maxSafeMileageInGivenWeeks: number }
  | { tooAggressive: false };

export type BasePhasePlan = {
  weeks: BasePhaseWeek[];
  reachesTarget: boolean;
  guardrail: BasePhaseGuardrail;
};

export const DEFAULT_RESTART_STEP_MILES = 5;
export const DEFAULT_WORKOUT_DAYS_PER_WEEK = 2;
/** The smallest defined template -- an athlete running less than this starts at 3 (run-walk as needed within that frame), per Lydiard's staged-build concept applied in miles rather than minutes (see module header + task spec). */
export const MIN_DAYS_PER_WEEK = 3;
/** Sunday is always off, so 6 running days is the ceiling any template reaches. */
export const MAX_DAYS_PER_WEEK = 6;

const MAX_SEARCH_WEEKS = 520; // mirrors training-load-planner-math.ts's own sanity cap

// The 6-day week's own given percentages (28 + 18 + 18 + 12 + 12 + 12 =
// 100) are the canonical relative weights every other day count is derived
// from by dropping easy-day slots and renormalizing -- see this module's
// header comment for why that alone reproduces the spec's 3-day example
// (9 mi -> 2.5 / 2.5 / 4) with no separate low-mileage formula.
const LONG_RUN_WEIGHT = 28;
const MLR_WEIGHT = 18;
const EASY_WEIGHT = 12;

export const INJURY_RETURN_CRITERIA: readonly string[] = [
  "Pain-free daily activity for 5 consecutive days",
  "A pain-free 30-minute walk",
  "Progress through walk-run stages",
  "Advance only when there's no pain during the session or the next morning",
  "Roughly 10% per week or less once running resumes",
  "Clinician clearance and a RED-S screening completed",
];

export function hasReportedInjuryHistory(injuryHistoryText: string | null | undefined): boolean {
  return !!injuryHistoryText && injuryHistoryText.trim().length > 0;
}

function clampDays(days: number): number {
  return Math.max(MIN_DAYS_PER_WEEK, Math.min(MAX_DAYS_PER_WEEK, Math.round(days)));
}

// 1 long run is always the first slot; MLRs mirror the plan's general-phase
// workout count (capped by how many non-long-run slots this day count has);
// whatever's left is easy days. Confirmed against the task's own worked
// examples: 6 days -> 1 long + 2 MLR + 3 easy; 3 days -> 1 long + 2 MLR + 0
// easy, exactly "two MLRs plus one long run with no easy days."
function weekComposition(daysPerWeek: number, workoutDaysPerWeek: number): { mlrCount: number; easyCount: number } {
  const nonLongSlots = daysPerWeek - 1;
  const mlrCount = Math.max(0, Math.min(workoutDaysPerWeek, nonLongSlots));
  const easyCount = Math.max(0, nonLongSlots - mlrCount);
  return { mlrCount, easyCount };
}

function splitWeekMiles(totalMiles: number, mlrCount: number, easyCount: number): { longRunMiles: number; mlrMilesEach: number; easyMilesEach: number } {
  const totalWeight = LONG_RUN_WEIGHT + mlrCount * MLR_WEIGHT + easyCount * EASY_WEIGHT;
  return {
    longRunMiles: (LONG_RUN_WEIGHT / totalWeight) * totalMiles,
    mlrMilesEach: mlrCount > 0 ? (MLR_WEIGHT / totalWeight) * totalMiles : 0,
    easyMilesEach: easyCount > 0 ? (EASY_WEIGHT / totalWeight) * totalMiles : 0,
  };
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function generateBasePhasePlan(input: BasePhaseInput): BasePhasePlan {
  return input.athleteType === "beginner" ? generateBeginnerPath(input) : generateRestartPath(input);
}

// Direct, unmodified reuse of the Training Load Planner's own function --
// the exact same 10%/week cap + periodic cutback + "safe alternative"
// search the public tool uses. A true beginner's assessment here can never
// diverge from what /training-load-planner itself would say for the same
// starting mileage, goal, and weeks available.
function generateBeginnerPath(input: BasePhaseInput): BasePhasePlan {
  const history: [number, number, number, number] = [
    input.startingWeeklyMiles,
    input.startingWeeklyMiles,
    input.startingWeeklyMiles,
    input.startingWeeklyMiles,
  ];
  const plan = buildTrainingLoadPlan(history, input.targetWeek.totalMiles, input.weeksAvailable);
  const weeks = decorateWeeks(
    plan.weeks.map((w) => w.mileage),
    plan.weeks.map((w) => w.zone),
    input,
  );

  if (!plan.reachesGoal) {
    const alt = plan.safeAlternative!;
    return {
      weeks,
      reachesTarget: false,
      guardrail: {
        tooAggressive: true,
        reason: `For a true beginner, a safe build-up follows the platform's standard 10% rule (the same math behind the Training Load Planner). From ${input.startingWeeklyMiles} mi/week, that reaches about ${alt.maxSafeMileageInGivenWeeks} mi/week in ${input.weeksAvailable} weeks -- short of the ${input.targetWeek.totalMiles} mi/week target. Extend the base phase to about ${alt.weeksNeeded} weeks, or lower the plan's starting mileage.`,
        weeksNeeded: alt.weeksNeeded,
        maxSafeMileageInGivenWeeks: alt.maxSafeMileageInGivenWeeks,
      },
    };
  }

  return { weeks, reachesTarget: true, guardrail: { tooAggressive: false } };
}

// The restart-specific stepper, unchanged from before this revision. A
// previously-trained athlete closing the gap into a plan's start mileage is
// restart logic, not ongoing training -- it's explicitly allowed to run
// hotter than the 10%-per-week rule (that rule applies once the plan itself
// has started). The zone classification below is informational only in the
// review table; it is never the gate here.
function generateRestartPath(input: BasePhaseInput): BasePhasePlan {
  const stepMiles = input.restartStepMiles ?? DEFAULT_RESTART_STEP_MILES;
  const mileages: number[] = [];
  const history: number[] = [
    input.startingWeeklyMiles,
    input.startingWeeklyMiles,
    input.startingWeeklyMiles,
    input.startingWeeklyMiles,
  ];
  let current = input.startingWeeklyMiles;

  for (let i = 0; i < input.weeksAvailable; i++) {
    current = Math.round(Math.min(input.targetWeek.totalMiles, current + stepMiles));
    mileages.push(current);
  }

  const zones: (AcwrZone | null)[] = mileages.map((m) => {
    history.push(m);
    const chronicWindow = history.slice(-5, -1);
    const chronic = chronicWindow.reduce((sum, v) => sum + v, 0) / chronicWindow.length;
    return chronic > 0 ? zoneForRatio(m / chronic) : null;
  });

  const reachesTarget = (mileages.at(-1) ?? input.startingWeeklyMiles) >= input.targetWeek.totalMiles;
  const weeks = decorateWeeks(mileages, zones, input);

  if (!reachesTarget) {
    const weeksNeeded = weeksNeededForRestart(input.startingWeeklyMiles, input.targetWeek.totalMiles, stepMiles);
    const maxSafe = mileages.at(-1) ?? input.startingWeeklyMiles;
    return {
      weeks,
      reachesTarget: false,
      guardrail: {
        tooAggressive: true,
        reason: `At a restart step of about ${stepMiles} mi/week, this reaches about ${maxSafe} mi/week in ${input.weeksAvailable} weeks -- short of the ${input.targetWeek.totalMiles} mi/week target. Extend the base phase to about ${weeksNeeded} weeks, lower the plan's starting mileage, or raise the weekly step only if this athlete's own training history genuinely supports it.`,
        weeksNeeded,
        maxSafeMileageInGivenWeeks: maxSafe,
      },
    };
  }

  return { weeks, reachesTarget: true, guardrail: { tooAggressive: false } };
}

function weeksNeededForRestart(start: number, target: number, stepMiles: number): number {
  let current = start;
  let weeks = 0;
  while (current < target && weeks < MAX_SEARCH_WEEKS) {
    current = Math.round(Math.min(target, current + stepMiles));
    weeks += 1;
  }
  return weeks;
}

// Splits each week's total into long run / MLRs / easy days via the
// percentage template above, ramping the day count from the athlete's
// current frequency up to the target week's own day count (reaching it
// exactly in the final week, since that's the week handed off to the real
// plan), then applies the long-run cap (still WEEKLY_INCREASE_CAP, still
// the binding constraint, still redistributed on overflow -- now across
// whichever MLR/easy slots exist that week, since a 3-day week has no easy
// days to redistribute into).
function decorateWeeks(mileages: number[], zones: (AcwrZone | null)[], input: BasePhaseInput): BasePhaseWeek[] {
  const workoutDaysPerWeek = Math.max(1, input.targetWeek.workoutDaysPerWeek || DEFAULT_WORKOUT_DAYS_PER_WEEK);
  const startDays = clampDays(input.currentDaysPerWeek);
  const targetDays = clampDays(input.targetWeek.daysPerWeek);
  const totalWeeks = mileages.length;

  const startingComposition = weekComposition(startDays, workoutDaysPerWeek);
  const startingSplit = splitWeekMiles(input.startingWeeklyMiles, startingComposition.mlrCount, startingComposition.easyCount);
  let lastLongRun = input.longestRunInLast30DaysMiles ?? startingSplit.longRunMiles;

  return mileages.map((totalMiles, i) => {
    const weekNumber = i + 1;
    // Linear ramp from startDays to targetDays, landing exactly on
    // targetDays in the last week -- every intermediate value is itself a
    // whole number already inside [MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK],
    // so no extra snapping is needed.
    const fraction = totalWeeks > 1 ? weekNumber / totalWeeks : 1;
    const daysPerWeek = Math.round(startDays + fraction * (targetDays - startDays));

    const { mlrCount, easyCount } = weekComposition(daysPerWeek, workoutDaysPerWeek);
    const split = splitWeekMiles(totalMiles, mlrCount, easyCount);

    const maxLongRunThisWeek = lastLongRun * (1 + WEEKLY_INCREASE_CAP);
    const longRunCapped = split.longRunMiles > maxLongRunThisWeek + 0.05;
    const longRunMiles = roundToHalf(longRunCapped ? maxLongRunThisWeek : split.longRunMiles);
    const excess = longRunCapped ? split.longRunMiles - maxLongRunThisWeek : 0;

    const nonLongWeight = mlrCount * MLR_WEIGHT + easyCount * EASY_WEIGHT;
    const mlrMilesEach = split.mlrMilesEach + (excess > 0 && nonLongWeight > 0 ? (excess * MLR_WEIGHT) / nonLongWeight : 0);
    const easyMilesEach = split.easyMilesEach + (excess > 0 && nonLongWeight > 0 ? (excess * EASY_WEIGHT) / nonLongWeight : 0);

    lastLongRun = longRunMiles;

    const notes: string[] = ["All miles easy. Run-walk as needed to complete the distance comfortably."];
    if (longRunCapped) {
      notes.unshift(
        `Long run capped at ${longRunMiles} mi (no more than ~${Math.round(WEEKLY_INCREASE_CAP * 100)}% above last week's long run) -- the remaining ${roundToHalf(excess)} mi is spread across this week's ${mlrCount > 0 ? "medium-long" : ""}${mlrCount > 0 && easyCount > 0 ? " and easy " : easyCount > 0 ? "easy " : " "}runs instead.`,
      );
    }

    return {
      weekNumber,
      totalMiles,
      daysPerWeek,
      longRunMiles,
      longRunCapped,
      mlrMiles: Array.from({ length: mlrCount }, () => roundToHalf(mlrMilesEach)),
      easyMiles: Array.from({ length: easyCount }, () => roundToHalf(easyMilesEach)),
      acwrZone: zones[i] ?? null,
      notes,
    };
  });
}
