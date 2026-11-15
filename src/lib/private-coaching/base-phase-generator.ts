import { buildTrainingLoadPlan } from "@/lib/training-load-planner-math";
import { zoneForRatio, type AcwrZone } from "@/lib/acwr";
import { WEEKLY_INCREASE_CAP } from "@/lib/coaching-engine/mileage-progression";

// Turns the Training Load Planner's own safe-build math into a week-by-week
// base phase a coach can review before adding it to an athlete's schedule
// (see the planner at /training-load-planner, src/lib/training-load-planner-math.ts).
//
// What's genuinely REUSED from the planner, not re-derived: the "beginner"
// path below calls buildTrainingLoadPlan() unmodified -- the exact same
// function the public tool calls -- so a beginner's assessment here is
// never different from what the Training Load Planner itself would say for
// the same numbers. The long-run cap also reuses WEEKLY_INCREASE_CAP (the
// platform's one 10% constant, from the coaching engine) rather than a
// second hardcoded 0.1.
//
// What's genuinely NEW (confirmed, by reading the planner's full math
// module, that none of this exists anywhere in the codebase today): the
// long-run-specific constraint, the running-days-per-week progression, the
// "previously-trained athlete restarting" step (which is explicitly allowed
// to exceed the 10% rule -- the 10% rule is for ongoing training once a
// plan has started, not for closing the gap into one), and the aggressive-
// build guardrail for that restart path. These are documented inline as new
// judgment calls, not something lifted from existing code.

export type BasePhaseAthleteType = "restarting" | "beginner";

export type BasePhaseInput = {
  startingWeeklyMiles: number;
  /** The plan's own authored starting mileage -- what this base phase builds toward. */
  targetWeeklyMiles: number;
  weeksAvailable: number;
  /**
   * Coach-asserted, same pattern as strength-scheduling.ts's gating facts --
   * never auto-diagnosed. "restarting": has run consistently before, just
   * currently below the plan's starting mileage (the feature's main case --
   * see its own module comment above). "beginner": no real aerobic base,
   * must follow the platform's standard 10% rule, same as everyone else's
   * ongoing training.
   */
  athleteType: BasePhaseAthleteType;
  currentDaysPerWeek: number;
  targetDaysPerWeek: number;
  /** Longest run in the prior 30 days, miles. Null if unknown -- falls back to a fraction of starting weekly mileage. */
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

// New constants for this feature -- no existing precedent (the Training
// Load Planner has no long-run or frequency concept at all, confirmed by
// reading its full implementation). Documented as judgment calls, not
// extracted values.
export const DEFAULT_RESTART_STEP_MILES = 5;
const LONG_RUN_SHARE_OF_WEEKLY_MILES = 0.3; // a common easy-based "long run is ~30% of the week" rule of thumb
const DAYS_ADDED_EVERY_N_WEEKS = 2;
const MAX_SEARCH_WEEKS = 520; // mirrors training-load-planner-math.ts's own sanity cap

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
  const plan = buildTrainingLoadPlan(history, input.targetWeeklyMiles, input.weeksAvailable);
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
        reason: `For a true beginner, a safe build-up follows the platform's standard 10% rule (the same math behind the Training Load Planner). From ${input.startingWeeklyMiles} mi/week, that reaches about ${alt.maxSafeMileageInGivenWeeks} mi/week in ${input.weeksAvailable} weeks -- short of the ${input.targetWeeklyMiles} mi/week target. Extend the base phase to about ${alt.weeksNeeded} weeks, or lower the plan's starting mileage.`,
        weeksNeeded: alt.weeksNeeded,
        maxSafeMileageInGivenWeeks: alt.maxSafeMileageInGivenWeeks,
      },
    };
  }

  return { weeks, reachesTarget: true, guardrail: { tooAggressive: false } };
}

// New: the restart-specific stepper. A previously-trained athlete closing
// the gap into a plan's start mileage is restart logic, not ongoing
// training -- it's explicitly allowed to run hotter than the 10%-per-week
// rule (the 10% rule applies once the plan itself has started). The zone
// classification below reuses zoneForRatio purely for the coach's
// situational awareness in the review table; it is never the gate here,
// since the whole premise of this path is that it's allowed to exceed what
// that classification would call "safe" for ongoing training.
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
    current = Math.round(Math.min(input.targetWeeklyMiles, current + stepMiles));
    mileages.push(current);
  }

  const zones: (AcwrZone | null)[] = mileages.map((m) => {
    history.push(m);
    const chronicWindow = history.slice(-5, -1);
    const chronic = chronicWindow.reduce((sum, v) => sum + v, 0) / chronicWindow.length;
    return chronic > 0 ? zoneForRatio(m / chronic) : null;
  });

  const reachesTarget = (mileages.at(-1) ?? input.startingWeeklyMiles) >= input.targetWeeklyMiles;
  const weeks = decorateWeeks(mileages, zones, input);

  if (!reachesTarget) {
    const weeksNeeded = weeksNeededForRestart(input.startingWeeklyMiles, input.targetWeeklyMiles, stepMiles);
    const maxSafe = mileages.at(-1) ?? input.startingWeeklyMiles;
    return {
      weeks,
      reachesTarget: false,
      guardrail: {
        tooAggressive: true,
        reason: `At a restart step of about ${stepMiles} mi/week, this reaches about ${maxSafe} mi/week in ${input.weeksAvailable} weeks -- short of the ${input.targetWeeklyMiles} mi/week target. Extend the base phase to about ${weeksNeeded} weeks, lower the plan's starting mileage, or raise the weekly step only if this athlete's own training history genuinely supports it.`,
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

// Adds the two things the Training Load Planner has no concept of at all:
// a long run (capped at no more than WEEKLY_INCREASE_CAP above the prior
// week's long run -- the binding constraint per this feature's own spec,
// not the weekly total) and a running-days-per-week ramp that adds at most
// one day every DAYS_ADDED_EVERY_N_WEEKS weeks, so frequency builds before
// volume does.
function decorateWeeks(mileages: number[], zones: (AcwrZone | null)[], input: BasePhaseInput): BasePhaseWeek[] {
  let lastLongRun = input.longestRunInLast30DaysMiles ?? input.startingWeeklyMiles * LONG_RUN_SHARE_OF_WEEKLY_MILES;

  return mileages.map((totalMiles, i) => {
    const weekNumber = i + 1;
    const daysPerWeek = Math.min(
      input.targetDaysPerWeek,
      input.currentDaysPerWeek + Math.floor(i / DAYS_ADDED_EVERY_N_WEEKS),
    );

    const desiredLongRun = totalMiles * LONG_RUN_SHARE_OF_WEEKLY_MILES;
    const maxLongRunThisWeek = lastLongRun * (1 + WEEKLY_INCREASE_CAP);
    const longRunMiles = Math.round(Math.min(desiredLongRun, maxLongRunThisWeek) * 10) / 10;
    const longRunCapped = desiredLongRun > maxLongRunThisWeek + 0.05;
    lastLongRun = longRunMiles;

    const notes: string[] = ["All miles easy. Run-walk as needed to complete the distance comfortably."];
    if (longRunCapped) {
      const remaining = Math.round((totalMiles - longRunMiles) * 10) / 10;
      notes.unshift(
        `Long run capped at ${longRunMiles} mi (no more than ~${Math.round(WEEKLY_INCREASE_CAP * 100)}% above last week's long run) -- the remaining ${remaining} mi is spread across the other easy days instead.`,
      );
    }

    return { weekNumber, totalMiles, daysPerWeek, longRunMiles, longRunCapped, acwrZone: zones[i] ?? null, notes };
  });
}
