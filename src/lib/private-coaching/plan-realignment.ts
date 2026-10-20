import { addDays, daysBetween } from "@/lib/week";
import { isBigSession, type PlanHealthWorkout } from "./plan-health";
import type { WorkoutType } from "@/lib/coaching-engine";

// Plan Realignment: when an athlete misses training, this proposes a
// revised version of the coming week -- move, shorten, or drop -- rather
// than letting missed workouts just accumulate. Pure rules over the real
// session taxonomy, deterministic, and advisory only: nothing here writes
// anything. A coach reviews the returned RealignmentProposal and decides
// (see realignment-actions.ts for the accept/dismiss/edit lifecycle).
//
// Key session vs filler, from the REAL taxonomy, not an invented label:
//   - Long run: workout_type === "long" -- a real, structured Postgres
//     enum value (public.workout_type), never day_label text.
//   - Key session: isBigSession (plan-health.ts, reused verbatim) --
//     plannedRpeMax ?? plannedRpe >= 8, and not optional. The exact
//     function Plan Health's own spacing check and load-bearing/
//     supporting/droppable classifier already use, so this engine can't
//     silently disagree with what the coach sees there about what counts
//     as demanding.
//   - Filler: everything else -- easy/recovery/moderate running with no
//     authored signal of real difficulty. Expendable by design.
// Long run and key session are tracked as two distinct "protected"
// categories (per the task's own "never back-to-back with another key
// session or the long run" wording) even though both get the same
// spacing protection below.

/** How many days must separate two protected (key/long) sessions for a realigned slot to count as safe -- "never back-to-back," not Plan Health's own 5-day forward-planning guideline (BIG_SESSION_SPACING_DAYS), which answers a different question (advisory spacing for a plan being built, not the tighter minimum viable in an emergency reshuffle). */
export const PROTECTED_SPACING_MIN_DAYS = 2;

export type RealignmentWorkout = {
  id: string;
  scheduledDate: string; // YYYY-MM-DD
  workoutType: WorkoutType | null;
  dayLabel: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  isOptional: boolean;
};

export type DisruptionWindow = { startDate: string; endDate: string };

export type RealignmentChangeKind = "unchanged" | "moved" | "shortened" | "dropped";

export type RealignmentEntry = {
  /** The original workout this entry is about. */
  original: RealignmentWorkout;
  changeKind: RealignmentChangeKind;
  /** Where it lands after realignment -- same as original.scheduledDate unless moved. */
  proposedDate: string;
  proposedDistanceM: number | null;
  proposedDurationS: number | null;
  /** One line, naming the rule that caused the change. Null for "unchanged". */
  reason: string | null;
  /** True only for a dropped key session or long run -- the one outcome the task says must be flagged prominently. */
  flagged: boolean;
  isKeySession: boolean;
  isLongRun: boolean;
};

export type RealignmentProposal = {
  disruptionWindow: DisruptionWindow;
  horizonStart: string;
  horizonEnd: string;
  entries: RealignmentEntry[];
  /** Sum of every horizon workout's planned distance, before realignment. */
  originalLoadM: number;
  /** Sum of every surviving/moved/shortened workout's distance, after realignment -- never exceeds originalLoadM, by construction (every operation preserves or reduces a session's own distance, never increases one). */
  proposedLoadM: number;
  /** True when a key session or the long run had no valid slot and had to be dropped -- surfaced separately so the UI can flag it prominently rather than burying it in the entry list. */
  hasProtectedDrop: boolean;
};

function midpointDistanceM(w: RealignmentWorkout): number | null {
  if (w.plannedDistanceM == null) return null;
  return w.plannedDistanceMaxM != null ? (w.plannedDistanceM + w.plannedDistanceMaxM) / 2 : w.plannedDistanceM;
}

function toPlanHealthWorkout(w: RealignmentWorkout): PlanHealthWorkout {
  return {
    id: w.id,
    scheduledDate: w.scheduledDate,
    dayLabel: w.dayLabel,
    prescription: null,
    plannedRpe: w.plannedRpe,
    plannedRpeMax: w.plannedRpeMax,
    pacePercentBasis: null,
    pacePercentMin: null,
    pacePercentMax: null,
    isOptional: w.isOptional,
    phaseKey: null,
  };
}

function isLongRun(w: RealignmentWorkout): boolean {
  return w.workoutType === "long";
}

function isKeySession(w: RealignmentWorkout): boolean {
  return !isLongRun(w) && isBigSession(toPlanHealthWorkout(w));
}

function isProtected(w: RealignmentWorkout): boolean {
  return isLongRun(w) || isKeySession(w);
}

/**
 * The next 7 days' revised workouts, given a disruption window --
 * deterministic: the same disruption window and the same horizon
 * workouts always produce the exact same proposal, since nothing here
 * reads a clock, generates an id, or branches on anything but its own
 * inputs.
 *
 * `horizonWorkouts` is every workout currently scheduled across the 7
 * days starting the day after `disruption.endDate` ("the return day")
 * through 6 days later. Workouts scheduled during the disruption itself
 * are deliberately not passed in at all -- missed volume is never made
 * up (rule 1), so this engine never looks at what was missed, only at
 * what's still ahead.
 */
export function proposeRealignment(disruption: DisruptionWindow, horizonWorkouts: RealignmentWorkout[]): RealignmentProposal {
  const horizonStart = addDays(disruption.endDate, 1);
  const horizonEnd = addDays(horizonStart, 6);
  const horizonDates = Array.from({ length: 7 }, (_, i) => addDays(horizonStart, i));

  const byDate = new Map<string, RealignmentWorkout[]>();
  for (const w of horizonWorkouts) {
    const list = byDate.get(w.scheduledDate) ?? [];
    list.push(w);
    byDate.set(w.scheduledDate, list);
  }

  const originalLoadM = horizonWorkouts.reduce((sum, w) => sum + (midpointDistanceM(w) ?? 0), 0);

  // Working state: current date assignment and distance for every
  // workout, mutated as rules apply. Started as a 1:1 copy of the
  // original schedule.
  const entries = new Map<string, RealignmentEntry>(
    horizonWorkouts.map((w) => [
      w.id,
      {
        original: w,
        changeKind: "unchanged",
        proposedDate: w.scheduledDate,
        proposedDistanceM: midpointDistanceM(w),
        proposedDurationS: w.plannedDurationS,
        reason: null,
        flagged: false,
        isKeySession: isKeySession(w),
        isLongRun: isLongRun(w),
      },
    ]),
  );

  // Where every protected session currently sits, keyed by workout id --
  // updated as sessions move, so spacing checks always see the live
  // arrangement, not the original one.
  const protectedPositions = new Map<string, string>();
  for (const w of horizonWorkouts) {
    if (isProtected(w)) protectedPositions.set(w.id, w.scheduledDate);
  }

  function spacingOk(candidateDate: string, excludingWorkoutId: string): boolean {
    for (const [id, date] of protectedPositions) {
      if (id === excludingWorkoutId) continue;
      if (Math.abs(daysBetween(date, candidateDate)) < PROTECTED_SPACING_MIN_DAYS) return false;
    }
    return true;
  }

  function isDateCurrentlyEmpty(date: string): boolean {
    return [...entries.values()].every((e) => !(e.changeKind !== "dropped" && e.proposedDate === date));
  }

  // How many rest days (dates with nothing scheduled) would remain across
  // the whole horizon if `aboutToOccupy` became occupied right now --
  // used to enforce rule 5 (never eliminate the last rest day to cram a
  // move in) before actually committing to a candidate slot.
  function restDaysIfOccupied(aboutToOccupy: string): number {
    let count = 0;
    for (const date of horizonDates) {
      if (date === aboutToOccupy) continue;
      if (isDateCurrentlyEmpty(date)) count += 1;
    }
    return count;
  }

  // Rule 2 + 3: the return day's own protected sessions can never land on
  // the return day (first day back is easy, regardless of what was
  // planned) -- find each one a spacing-safe, rest-day-respecting slot
  // elsewhere in the horizon (rule 3), or drop it if none exists (rule
  // 4). Processed in a stable, deterministic order (ascending workout id)
  // so two protected sessions on the same return day always resolve the
  // same way for the same input.
  const returnDay = horizonDates[0];
  const returnDayProtected = (byDate.get(returnDay) ?? []).filter(isProtected).sort((a, b) => a.id.localeCompare(b.id));

  for (const session of returnDayProtected) {
    const candidates = horizonDates.slice(1); // never the return day itself
    let placed = false;

    for (const candidateDate of candidates) {
      if (!spacingOk(candidateDate, session.id)) continue;

      // Rest-day floor (rule 5): reject a candidate that would leave zero
      // rest days remaining in the horizon once this session lands there.
      // Only matters when the candidate is itself currently a rest day --
      // landing on a day that already has a (bumped) filler session
      // doesn't touch the rest-day count at all.
      const wasEmpty = isDateCurrentlyEmpty(candidateDate);
      if (wasEmpty && restDaysIfOccupied(candidateDate) === 0) continue;

      // Occupied by another protected session already -- can't double up
      // two protected sessions on one day; that's not a valid slot.
      const occupants = [...entries.values()].filter(
        (e) => e.changeKind !== "dropped" && e.proposedDate === candidateDate && e.original.id !== session.id,
      );
      if (occupants.some((o) => o.isKeySession || o.isLongRun)) continue;

      // A filler occupant gets bumped to make room -- shortened when it
      // has a real distance to reduce, dropped when it doesn't (rule 4:
      // filler is expendable, sacrificed before any protected session
      // ever is).
      for (const occupant of occupants) {
        if (occupant.proposedDistanceM != null && occupant.proposedDistanceM > 0) {
          occupant.changeKind = "shortened";
          occupant.proposedDistanceM = occupant.proposedDistanceM / 2;
          occupant.proposedDurationS = occupant.proposedDurationS != null ? Math.round(occupant.proposedDurationS / 2) : null;
          occupant.reason = "Shortened: made room for the protected session moved from the return day";
        } else {
          occupant.changeKind = "dropped";
          occupant.proposedDistanceM = null;
          occupant.proposedDurationS = null;
          occupant.reason = "Dropped: made room for the protected session moved from the return day";
        }
      }

      const entry = entries.get(session.id)!;
      entry.changeKind = "moved";
      entry.proposedDate = candidateDate;
      entry.reason = "Moved: key session can't follow the return day";
      protectedPositions.set(session.id, candidateDate);
      placed = true;
      break;
    }

    if (!placed) {
      const entry = entries.get(session.id)!;
      entry.changeKind = "dropped";
      entry.proposedDistanceM = null;
      entry.proposedDurationS = null;
      entry.flagged = true;
      entry.reason = "Dropped: no spacing-safe day in the realignment window for this session";
      protectedPositions.delete(session.id);
    }
  }

  const finalEntries = [...entries.values()];
  const proposedLoadM = finalEntries.reduce((sum, e) => sum + (e.changeKind === "dropped" ? 0 : e.proposedDistanceM ?? 0), 0);
  const hasProtectedDrop = finalEntries.some((e) => e.flagged);

  return {
    disruptionWindow: disruption,
    horizonStart,
    horizonEnd,
    entries: finalEntries.sort((a, b) => a.original.scheduledDate.localeCompare(b.original.scheduledDate) || a.original.id.localeCompare(b.original.id)),
    originalLoadM,
    proposedLoadM,
    hasProtectedDrop,
  };
}

/**
 * A short, stable digest of exactly what the engine was given -- the
 * disruption window plus every horizon workout's own identity and
 * current values. Two calls with the same athlete and the same
 * underlying plan always produce the same fingerprint, which is what
 * lets a dismissed proposal be recognized again instead of silently
 * regenerated (see realignment-actions.ts).
 */
export function fingerprintRealignmentInput(athleteId: string, disruption: DisruptionWindow, horizonWorkouts: RealignmentWorkout[]): string {
  const sorted = [...horizonWorkouts].sort((a, b) => a.id.localeCompare(b.id));
  const parts = [
    athleteId,
    disruption.startDate,
    disruption.endDate,
    ...sorted.map(
      (w) =>
        `${w.id}:${w.scheduledDate}:${w.workoutType ?? ""}:${w.plannedDistanceM ?? ""}:${w.plannedDistanceMaxM ?? ""}:${w.plannedDurationS ?? ""}:${w.plannedRpe ?? ""}:${w.plannedRpeMax ?? ""}:${w.isOptional}`,
    ),
  ];
  return parts.join("|");
}
