import { isRpeNoteworthy } from "./completion-comparison";
import { getPhaseForWeek, weekPositionInPhase, type TrainingPhase } from "./training-phases";
import { formatWeekday } from "@/lib/format";
import { addDays, daysBetween } from "@/lib/week";

// The roster dashboard's own pure aggregation -- everything in this file
// takes plain, already-batch-fetched data (see roster-data.ts for the
// actual .in(...) queries) and is unit-testable without Supabase, the
// same split coach-home-data.ts/attention.ts already use for Coach Home.
// Deliberately NOT a reuse of attention.ts's computeAttentionFlags: that
// module's thresholds (isHighRpe's flat RPE>=9, "this calendar week"
// check-ins, an unbounded missed-workout count) answer a different
// question than this task's exact spec (a rolling 7-day window
// everywhere, isRpeNoteworthy's prescribed-vs-logged comparison, and a
// program-gated check-in flag) -- reusing it here would mean silently
// redefining what "the last 7 days" means on two different pages.
//
// The exact 7-day cutoff is decided HERE, inside the pure function, not
// in roster-data.ts's SQL -- the loader is free to over-fetch a coarser
// window (cheaper to get right, and the exact boundary stays testable
// without touching Supabase); this module is the single place that
// decides what "within the last 7 days" actually means.

const ATTENTION_WINDOW_DAYS = 7;

export type RosterProgramState =
  | { kind: "none" }
  | {
      kind: "active";
      /** The Program a phase was generated from, e.g. "Ridge" -- null for a freehand phase never assigned from a Program. */
      programName: string | null;
      /** phase.name when the coach gave this phase its own name (e.g. "Supportive"), falling back to the phase type (Base/Build/Peak/...) otherwise. */
      phaseLabel: string;
      /** "Wk 4 of 5" -- null when the current week doesn't land on a real week boundary within the phase (shouldn't normally happen, but weekPositionInPhase can return null). */
      weekLabel: string | null;
    };

export type RosterThisWeek = {
  plannedCount: number;
  completedCount: number;
  plannedDistanceM: number;
  completedDistanceM: number;
};

export type RosterAttentionReason = "missed_workout" | "rpe_spike" | "no_checkin" | "no_activity" | "intake_incomplete";

export type RosterAttentionBadge = {
  reason: RosterAttentionReason;
  /** A plain fact, never a judgment -- "Missed Tue," "RPE spike," "No check-in 9d," "No activity 7d". */
  detail: string;
};

export type RosterRecentCompletion = {
  completedAt: string; // ISO timestamp
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  loggedRpe: number | null;
};

export type RosterAttentionInput = {
  /** Every missed workout's scheduled_date the loader fetched (coarsely bounded is fine -- this function applies the real 7-day cutoff itself). */
  missedWorkoutDates: string[];
  /** Every completion the loader fetched (coarsely bounded is fine), regardless of date -- this function filters to the last 7 days and calls isRpeNoteworthy itself, the exact same function every workout tile already uses. */
  recentCompletions: RosterRecentCompletion[];
  /** Every scheduled workout's scheduled_date (any status) the loader fetched -- used only to answer "did this athlete have anything scheduled recently," the "despite scheduled workouts" qualifier on no_activity. */
  scheduledWorkoutDates: string[];
  /** Gates the no_checkin flag -- a program-less athlete has nothing to check in about. */
  hasActiveProgram: boolean;
  lastCheckinWeekStart: string | null;
  today: string; // YYYY-MM-DD, viewer-local -- see viewer-timezone.ts
  /** Whether this athlete's intake gap evaluation (intake-gaps.ts) found anything missing -- computed by the caller, not re-derived here, same reasoning as hasActiveProgram. */
  hasIncompleteIntake: boolean;
};

/**
 * The four attention signals, in priority order (missed work and an RPE
 * spike are the ones most worth a coach's actual attention; a missing
 * check-in or a quiet week are softer, "worth knowing" signals) -- an
 * athlete with none of these gets an empty array, which the row renders
 * as a clean row, never a "good job" badge of its own. Every detail
 * string states a fact; none of them grade, score, or use alarm language.
 */
export function computeRosterAttentionBadges(input: RosterAttentionInput): RosterAttentionBadge[] {
  const badges: RosterAttentionBadge[] = [];
  const windowStart = addDays(input.today, -ATTENTION_WINDOW_DAYS);

  const missedInWindow = input.missedWorkoutDates.filter((d) => d >= windowStart && d < input.today);
  if (missedInWindow.length > 0) {
    const sorted = [...missedInWindow].sort();
    const mostRecent = sorted[sorted.length - 1];
    const extra = sorted.length - 1;
    badges.push({
      reason: "missed_workout",
      detail: extra > 0 ? `Missed ${formatWeekday(mostRecent)} +${extra}` : `Missed ${formatWeekday(mostRecent)}`,
    });
  }

  const completionsInWindow = input.recentCompletions.filter((c) => {
    const date = c.completedAt.slice(0, 10);
    return date >= windowStart && date <= input.today;
  });
  if (completionsInWindow.some((c) => isRpeNoteworthy(c.plannedRpe, c.plannedRpeMax, c.loggedRpe))) {
    badges.push({ reason: "rpe_spike", detail: "RPE spike" });
  }

  if (input.hasActiveProgram) {
    if (input.lastCheckinWeekStart == null) {
      badges.push({ reason: "no_checkin", detail: "No check-in yet" });
    } else {
      const daysSince = daysBetween(input.lastCheckinWeekStart, input.today);
      if (daysSince > ATTENTION_WINDOW_DAYS) {
        badges.push({ reason: "no_checkin", detail: `No check-in ${daysSince}d` });
      }
    }
  }

  const hasScheduledInWindow = input.scheduledWorkoutDates.some((d) => d >= windowStart && d <= input.today);
  if (hasScheduledInWindow && completionsInWindow.length === 0) {
    badges.push({ reason: "no_activity", detail: "No activity 7d" });
  }

  // Neutral on purpose, last in priority order -- missing intake is
  // worth knowing, never worth leading with ahead of a real, time-
  // sensitive signal like a missed workout or an RPE spike.
  if (input.hasIncompleteIntake) {
    badges.push({ reason: "intake_incomplete", detail: "Intake incomplete" });
  }

  return badges;
}

export type RosterRowInput = {
  athleteId: string;
  coachAthleteId: string;
  displayName: string;
  avatarUrl: string | null;
  /** The Program name a phase was generated from, when it was -- null if source-less or no phase at all. */
  programName: string | null;
  /** All of this athlete's phases, not just the current one -- getPhaseForWeek resolves which one applies. */
  phases: TrainingPhase[];
  /** This week's Monday, viewer-local. */
  weekStart: string;
  thisWeek: RosterThisWeek | null;
  /** Most recent completed_workouts.completed_at across this athlete's whole history, or null if they've never logged anything. */
  lastActivityAt: string | null;
  lastCheckinWeekStart: string | null;
  nextRace: { raceName: string; goalDate: string } | null;
  attentionBadges: RosterAttentionBadge[];
};

export type RosterRow = {
  athleteId: string;
  coachAthleteId: string;
  displayName: string;
  avatarUrl: string | null;
  program: RosterProgramState;
  thisWeek: RosterThisWeek | null;
  lastActivityAt: string | null;
  lastCheckinWeekStart: string | null;
  nextRace: { raceName: string; goalDate: string } | null;
  attentionBadges: RosterAttentionBadge[];
};

export function buildRosterRow(input: RosterRowInput): RosterRow {
  const currentPhase = getPhaseForWeek(input.phases, input.weekStart);
  const program: RosterProgramState = currentPhase
    ? {
        kind: "active",
        programName: input.programName,
        phaseLabel: currentPhase.name ?? currentPhase.phaseType,
        weekLabel: formatWeekLabel(weekPositionInPhase(currentPhase, input.weekStart)),
      }
    : { kind: "none" };

  return {
    athleteId: input.athleteId,
    coachAthleteId: input.coachAthleteId,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    program,
    thisWeek: input.thisWeek,
    lastActivityAt: input.lastActivityAt,
    lastCheckinWeekStart: input.lastCheckinWeekStart,
    nextRace: input.nextRace,
    attentionBadges: input.attentionBadges,
  };
}

function formatWeekLabel(position: { week: number; of: number } | null): string | null {
  return position ? `Wk ${position.week} of ${position.of}` : null;
}

/**
 * Whether this athlete currently has an active program -- the same
 * getPhaseForWeek rule buildRosterRow itself uses, exposed separately so
 * roster-data.ts can gate the no_checkin attention flag on it before
 * assembling the full row (computeRosterAttentionBadges needs the
 * answer as a plain boolean input, not something it re-derives itself).
 */
export function hasActiveProgramForWeek(phases: TrainingPhase[], weekStart: string): boolean {
  return getPhaseForWeek(phases, weekStart) !== null;
}

export type RosterSortKey = "attention" | "name" | "race";

/**
 * Client-side sort over the already-loaded roster -- never re-queried
 * per sort change. Default ("attention"): most attention flags first,
 * ties broken by most-recently-active first (a never-active athlete
 * sorts last within a tie, not first). "name": alphabetical. "race":
 * soonest goal date first, athletes with no race sorted last.
 */
export function sortRosterRows(rows: RosterRow[], sortKey: RosterSortKey): RosterRow[] {
  const sorted = [...rows];
  if (sortKey === "name") {
    sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return sorted;
  }
  if (sortKey === "race") {
    sorted.sort((a, b) => {
      if (a.nextRace == null && b.nextRace == null) return 0;
      if (a.nextRace == null) return 1;
      if (b.nextRace == null) return -1;
      return a.nextRace.goalDate.localeCompare(b.nextRace.goalDate);
    });
    return sorted;
  }
  sorted.sort((a, b) => {
    if (a.attentionBadges.length !== b.attentionBadges.length) {
      return b.attentionBadges.length - a.attentionBadges.length;
    }
    if (a.lastActivityAt == null && b.lastActivityAt == null) return 0;
    if (a.lastActivityAt == null) return 1;
    if (b.lastActivityAt == null) return -1;
    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });
  return sorted;
}
