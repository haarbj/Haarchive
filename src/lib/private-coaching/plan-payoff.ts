import { daysBetween } from "@/lib/week";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import type { DefaultPhaseKey } from "@/lib/private-coaching/phase-explainers";

// "Your Plan" welcome payoff: pure assembly + copy for the dedicated view
// a coached athlete lands on the first time they open their coaching home
// after a program is assigned. Every value this module touches is
// resolved elsewhere through the platform's existing, single-source-of-
// truth logic (goal-race.ts, pace-reference.ts, fitness-estimates.ts,
// calendar-data.ts) -- this file only arranges and labels what's already
// been resolved. Nothing here fetches, resolves a pace, or invents a
// number.

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

export type RaceCountdown = { kind: "upcoming"; days: number } | { kind: "today" } | { kind: "past"; daysAgo: number };

/** Pure day-granularity countdown -- `daysBetween` (week.ts) does the actual date math; this just labels the three cases a race can be in relative to today. */
export function raceCountdown(today: string, goalDate: string): RaceCountdown {
  const days = daysBetween(today, goalDate);
  if (days > 0) return { kind: "upcoming", days };
  if (days === 0) return { kind: "today" };
  return { kind: "past", daysAgo: -days };
}

export function formatRaceCountdown(countdown: RaceCountdown): string {
  switch (countdown.kind) {
    case "upcoming":
      return `${countdown.days} day${countdown.days === 1 ? "" : "s"}`;
    case "today":
      return "Today";
    case "past":
      return `${countdown.daysAgo} day${countdown.daysAgo === 1 ? "" : "s"} ago`;
  }
}

// ---------------------------------------------------------------------------
// Phase strip -- one-line purpose per phase, for the strip only (the full
// explainer, phase-explainers.ts, is a multi-paragraph read for the
// training roadmap page, not a glanceable strip).
// ---------------------------------------------------------------------------

export const PHASE_STRIP_PURPOSE: Record<DefaultPhaseKey, string> = {
  general: "Builds your aerobic ceiling, efficiency, and structural toughness -- the raw material everything later gets made from.",
  supportive: "Assembles running long and running fast into one ability, anchored to your current marathon pace.",
  specific: "Converges all of it on your goal marathon pace -- the key sessions are the phase.",
};

function normalizePhaseKeyLoose(phaseType: string): DefaultPhaseKey | null {
  const value = phaseType.toLowerCase();
  if (value.includes("general")) return "general";
  if (value.includes("supportive")) return "supportive";
  if (value.includes("specific")) return "specific";
  return null;
}

/** Null (not a placeholder string) for a phase type with no standard one-liner, e.g. a coach-authored "Base" or "Taper" -- the caller falls back to that phase's own stored explainer's first line, or omits the purpose line entirely, rather than showing something invented. */
export function phaseStripPurpose(phaseType: string): string | null {
  const key = normalizePhaseKeyLoose(phaseType);
  return key ? PHASE_STRIP_PURPOSE[key] : null;
}

// ---------------------------------------------------------------------------
// Pace table -- one-line "why" per named pace, in the platform's voice.
// Original copy, not transcribed or cited (CLAUDE.md §5/§15).
// ---------------------------------------------------------------------------

export const PACE_BAND_WHY: Record<PaceReferenceKey, string> = {
  easy: "Builds your aerobic ceiling and lets you absorb volume without digging a hole you can't recover from.",
  steady: "Extends how long you can hold a strong aerobic effort before fatigue starts compounding.",
  tempo: "Raises the pace you can sustain for a real stretch of time -- the edge of comfortable-hard.",
  interval: "Trains your aerobic ceiling itself, at the pace that actually taxes it.",
  "5k": "The index pace for your current fitness -- most of your easier prescriptions are set relative to this.",
  "10k": "A step toward marathon-relevant speed, closer to sustainable than 5K pace.",
  half: "Close to the territory marathon pace work lives in, without asking for marathon-length durability yet.",
  marathon: "The pace the whole plan is converging on -- what you aim to hold for all 26.2 miles.",
};

// ---------------------------------------------------------------------------
// First action -- a single priority rule, applied to real, already-
// fetched data (never a fresh query of its own).
// ---------------------------------------------------------------------------

export type PlanPayoffFirstAction =
  | { kind: "log_today"; workoutId: string; href: string }
  | { kind: "view_first_workout"; workoutId: string; href: string }
  | { kind: "checkin"; href: string };

/**
 * Today's own published workout wins (there's something to do right now);
 * otherwise the next upcoming published workout (nothing to do today, but
 * something to look at); otherwise the check-in flow, which is always a
 * valid destination regardless of what's scheduled -- never a dead end.
 */
export function pickFirstAction(input: { todayWorkoutId: string | null; nextUpcomingWorkoutId: string | null }): PlanPayoffFirstAction {
  if (input.todayWorkoutId) {
    return { kind: "log_today", workoutId: input.todayWorkoutId, href: `/coaching/workouts/${input.todayWorkoutId}` };
  }
  if (input.nextUpcomingWorkoutId) {
    return { kind: "view_first_workout", workoutId: input.nextUpcomingWorkoutId, href: `/coaching/workouts/${input.nextUpcomingWorkoutId}` };
  }
  return { kind: "checkin", href: "/coaching/checkin" };
}

export function firstActionLabel(action: PlanPayoffFirstAction): string {
  switch (action.kind) {
    case "log_today":
      return "Log today's workout";
    case "view_first_workout":
      return "View your first workout";
    case "checkin":
      return "Complete your check-in";
  }
}

// ---------------------------------------------------------------------------
// "How this works" -- three short, fixed items. Static copy, not derived
// from any table, since it describes the mechanics of the platform
// itself rather than this athlete's own data.
// ---------------------------------------------------------------------------

export type HowThisWorksItem = { title: string; body: string };

export const HOW_THIS_WORKS: HowThisWorksItem[] = [
  {
    title: "Log each workout",
    body: "Your RPE matters as much as the distance -- it's how your coach reads whether the week is landing the way it was meant to.",
  },
  {
    title: "Your weekly check-in",
    body: "A short reflection on the week just finished, due once that week is over -- not a daily habit, a once-a-week read on how training's going.",
  },
  {
    title: "Life happens",
    body: "If something disrupts training, tell your coach -- they can reshape the coming week around it rather than you trying to make up what you missed.",
  },
];
