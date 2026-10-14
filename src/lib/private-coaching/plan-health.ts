// Part B: plan-health checks and the adaptation helper.
//
// Pure and DB-free. Everything here is ADVISORY: it returns findings and
// classifications, never a decision, never a block. A finding is a sentence
// a coach can read, disagree with, and dismiss. Nothing in this module can
// prevent a save, and nothing calls it as a gate.
//
// Two hard design rules:
//
//   1. SILENT WHEN SOUND. A check that fires on a healthy plan is worse
//      than no check, because it teaches the coach to ignore the whole
//      panel. Every check below has to find real evidence of the thing it
//      describes, and says nothing otherwise.
//
//   2. READ WHAT THE PRESCRIPTION SAYS, NEVER INFER WHAT IT MEANT. The
//      seeded frameworks state their sessions as prose ("13-14 mi at
//      98-100% MP"), so recognising a marathon-pace session means reading
//      percentages out of that text. That is reporting what is written. It
//      is NOT an attempt to infer intensity from distance, day of week, or
//      anything else the prescription does not state -- a plan whose
//      workouts say nothing about pace gets no pace findings, not guessed
//      ones.

import { PHASE_PROFILES, selectPhaseProfile } from "@/lib/private-coaching/race-anchored-planning";

export type PacePercentBasis = "5k" | "marathon";

export type PlanHealthWorkout = {
  id: string;
  /** ISO yyyy-mm-dd. */
  scheduledDate: string;
  dayLabel: string | null;
  /** The authored prescription text (notes_from_coach). */
  prescription: string | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  pacePercentBasis: PacePercentBasis | null;
  pacePercentMin: number | null;
  pacePercentMax: number | null;
  isOptional: boolean;
  /** The phase this date falls in, when it falls in one. */
  phaseKey: string | null;
};

export type PlanHealthPhase = {
  phaseKey: string;
  startDate: string;
  endDate: string;
  /** Whole weeks in the phase. */
  weeks: number;
};

/** A percent-of-a-reference-pace target, however it was expressed. */
export type PacePercentTarget = { basis: PacePercentBasis; min: number; max: number };

// "98-100% MP", "105% MP", "90-92% 5k", "~95% 5k effort". Both hyphen and
// en dash appear in real prescriptions.
const PACE_PERCENT_IN_PROSE = /(\d{2,3})(?:\s*[-–—]\s*(\d{2,3}))?\s*%\s*(MP|5k)\b/gi;

/**
 * Every percent-of-pace target a prescription states, in the order written.
 * A single value becomes a degenerate range (min === max) so callers only
 * ever handle one shape.
 */
export function extractPacePercents(text: string | null | undefined): PacePercentTarget[] {
  if (!text) return [];
  const found: PacePercentTarget[] = [];
  for (const match of text.matchAll(PACE_PERCENT_IN_PROSE)) {
    const first = Number(match[1]);
    const second = match[2] == null ? null : Number(match[2]);
    const basis: PacePercentBasis = match[3].toLowerCase() === "mp" ? "marathon" : "5k";
    const min = second == null ? first : Math.min(first, second);
    const max = second == null ? first : Math.max(first, second);
    found.push({ basis, min, max });
  }
  return found;
}

/** Both the structured target (when a coach set one) and everything the prose states. */
export function workoutPacePercents(workout: PlanHealthWorkout): PacePercentTarget[] {
  const structured: PacePercentTarget[] =
    workout.pacePercentBasis != null && workout.pacePercentMin != null
      ? [
          {
            basis: workout.pacePercentBasis,
            min: workout.pacePercentMin,
            max: workout.pacePercentMax ?? workout.pacePercentMin,
          },
        ]
      : [];
  return [...structured, ...extractPacePercents(workout.prescription)];
}

/**
 * Does this workout state a target against `basis` that overlaps
 * [bandMin, bandMax] percent? Overlap, not containment: a session written
 * as "98-100% MP" counts as marathon-pace work when asked about 100-105%,
 * because part of it genuinely is.
 */
export function targetsPaceBand(
  workout: PlanHealthWorkout,
  basis: PacePercentBasis,
  bandMin: number,
  bandMax: number,
): boolean {
  return workoutPacePercents(workout).some(
    (target) => target.basis === basis && target.max >= bandMin && target.min <= bandMax,
  );
}

/** Does this workout target marathon pace anywhere inside [min, max] percent? */
export function targetsMarathonPaceBand(workout: PlanHealthWorkout, bandMin: number, bandMax: number): boolean {
  return targetsPaceBand(workout, "marathon", bandMin, bandMax);
}

/**
 * A "big" session, for the purpose of spacing advice.
 *
 * Difficulty is the only honest signal available here: it is what the
 * frameworks actually publish per session, and it is what the coach sets by
 * hand. Distance is deliberately NOT used -- a 20-mile easy long run and a
 * 20-mile run at 95% of marathon pace are not the same demand, and treating
 * them alike is exactly the inference rule 2 above forbids. An optional
 * session is never counted as big, because the athlete may not do it.
 */
export function isBigSession(workout: PlanHealthWorkout): boolean {
  if (workout.isOptional) return false;
  const rpe = workout.plannedRpeMax ?? workout.plannedRpe;
  return rpe != null && rpe >= 8;
}

export type PlanHealthFinding = {
  /** Stable across re-renders and re-runs, so a dismissal keeps sticking. */
  key: string;
  title: string;
  detail: string;
  /** Dates the finding is about, for linking back into the calendar. */
  dates: string[];
};

export type PlanHealthInput = {
  workouts: PlanHealthWorkout[];
  phases: PlanHealthPhase[];
  /** ISO yyyy-mm-dd, or null when no goal race is set. */
  raceDate: string | null;
  /** The peak weekly mileage this buildup is aiming at, when known. */
  peakMileage: number | null;
  experienceYears: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / DAY_MS);
}

/** Marathon-pace rehearsal window before the race, in days out. */
export const MP_REHEARSAL_WINDOW = { minDaysOut: 14, maxDaysOut: 28 } as const;
/** How close two big sessions have to be before spacing is worth mentioning. */
export const BIG_SESSION_SPACING_DAYS = 5;

/**
 * Run every check. Returns only what it found real evidence for, in a
 * stable order. An empty array is the normal result for a sound plan.
 */
export function runPlanHealthChecks(input: PlanHealthInput): PlanHealthFinding[] {
  const findings: PlanHealthFinding[] = [];
  const workouts = [...input.workouts].sort((a, b) =>
    a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0,
  );

  findings.push(...checkMarathonPaceRehearsal(workouts, input.raceDate));
  findings.push(...checkBigSessionSpacing(workouts));
  findings.push(...checkSpecificPhaseLength(input));

  return findings;
}

/**
 * "No 100% MP session within 14-28 days of the race."
 *
 * Only runs when a race date exists AND the plan reaches into that window
 * at all: a plan that simply has not been built that far out yet is not an
 * unhealthy plan, and saying so would fire on every half-built schedule.
 */
function checkMarathonPaceRehearsal(workouts: PlanHealthWorkout[], raceDate: string | null): PlanHealthFinding[] {
  if (!raceDate) return [];

  const inWindow = workouts.filter((w) => {
    const out = daysBetween(w.scheduledDate, raceDate);
    return out >= MP_REHEARSAL_WINDOW.minDaysOut && out <= MP_REHEARSAL_WINDOW.maxDaysOut;
  });
  if (inWindow.length === 0) return [];

  // 98-102 rather than exactly 100: a session written as "98-100% MP" is a
  // marathon-pace rehearsal, and so is one at 101%.
  const rehearsals = inWindow.filter((w) => targetsMarathonPaceBand(w, 98, 102));
  if (rehearsals.length > 0) return [];

  return [
    {
      key: "mp-rehearsal-missing",
      title: "No session at marathon pace two to four weeks out",
      detail: `Nothing between ${MP_REHEARSAL_WINDOW.maxDaysOut} and ${MP_REHEARSAL_WINDOW.minDaysOut} days before the race asks for marathon pace. That window is the last place a full-size rehearsal of race pace, fueling and gear fits while still leaving time to recover from it. If this athlete has already done that work earlier, or you are deliberately keeping them off marathon pace, this is nothing to act on.`,
      dates: inWindow.map((w) => w.scheduledDate),
    },
  ];
}

/**
 * "Two big sessions within five days."
 *
 * Reports each close PAIR once, keyed by the two dates so dismissing one
 * pair does not dismiss the others.
 */
function checkBigSessionSpacing(workouts: PlanHealthWorkout[]): PlanHealthFinding[] {
  const big = workouts.filter(isBigSession);
  const findings: PlanHealthFinding[] = [];

  for (let i = 1; i < big.length; i += 1) {
    const previous = big[i - 1];
    const current = big[i];
    const gap = daysBetween(previous.scheduledDate, current.scheduledDate);
    if (gap <= 0 || gap >= BIG_SESSION_SPACING_DAYS) continue;

    findings.push({
      key: `big-session-spacing:${previous.scheduledDate}:${current.scheduledDate}`,
      title: `Two demanding sessions ${gap} day${gap === 1 ? "" : "s"} apart`,
      detail: `${describeWorkout(previous)} and ${describeWorkout(current)} are ${gap} day${gap === 1 ? "" : "s"} apart. A session this size usually wants two to three genuinely easy days after it before the next one, otherwise the second gets run on tired legs and neither lands properly. Deliberate back-to-back blocks are a real tactic, so if that is what this is, dismiss this.`,
      dates: [previous.scheduledDate, current.scheduledDate],
    });
  }

  return findings;
}

/**
 * "Specific phase is very long for this mileage."
 *
 * Compared against the same five real framework shapes the layout proposal
 * uses, so this check and that proposal can never disagree about what a
 * normal specific block looks like at a given volume.
 */
function checkSpecificPhaseLength(input: PlanHealthInput): PlanHealthFinding[] {
  if (input.peakMileage == null) return [];
  const specific = input.phases.find((p) => p.phaseKey.trim().toLowerCase() === "specific");
  if (!specific) return [];

  const profile = selectPhaseProfile(input.peakMileage, input.experienceYears);
  const longest = Math.max(...PHASE_PROFILES.map((p) => p.specific));
  // Two weeks of slack past this athlete's own profile, and never flagged
  // for a length that is normal somewhere in the methodology.
  const threshold = Math.max(profile.specific + 2, longest);
  if (specific.weeks <= threshold) return [];

  return [
    {
      key: `specific-phase-length:${specific.startDate}`,
      title: `Specific phase runs ${specific.weeks} weeks`,
      detail: `At a peak of about ${input.peakMileage} miles a week, a specific block of around ${profile.specific} weeks is the usual shape, and the longest anywhere in this methodology is ${longest}. Marathon-specific work leans on the general fitness built underneath it; venturing a long way past that base tends to flatten out rather than keep paying off. Consider moving some of these weeks into the general or supportive phase.`,
      dates: [specific.startDate, specific.endDate],
    },
  ];
}

function describeWorkout(workout: PlanHealthWorkout): string {
  return workout.dayLabel?.trim() ? `"${workout.dayLabel.trim()}"` : `the session on ${workout.scheduledDate}`;
}

// ---------------------------------------------------------------------------
// Adaptation helper (Part B item 4)
// ---------------------------------------------------------------------------

export type SessionLoadClass = "load-bearing" | "supporting" | "droppable";

export type ClassifiedSession = {
  workout: PlanHealthWorkout;
  loadClass: SessionLoadClass;
  /** Why it landed in that class, in one sentence, for the coach to read. */
  reason: string;
};

/** Specific-phase work in this band is what the race is actually built on. */
export const LOAD_BEARING_MP_BAND = { min: 95, max: 105 } as const;

/**
 * Which upcoming sessions are load-bearing and which can go, so a coach
 * retooling around illness, injury or life protects the right ones.
 *
 * ADVISORY. This marks nothing and moves nothing; it sorts what already
 * exists into three groups with a reason attached to each.
 *
 * The load-bearing test is specific-phase work at 95-105% of marathon
 * pace. That is the band the race is rehearsed in: slower is supportive
 * endurance, faster is supportive speed, and both of those are rebuildable
 * in a way that a missed 100% MP long session this late is not.
 */
export function classifyUpcomingSessions(input: {
  workouts: PlanHealthWorkout[];
  /** Only sessions on or after this date are classified. */
  fromDate: string;
  raceDate: string | null;
}): ClassifiedSession[] {
  return input.workouts
    .filter((w) => w.scheduledDate >= input.fromDate)
    .filter((w) => (input.raceDate ? w.scheduledDate <= input.raceDate : true))
    .sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0))
    .map((workout) => {
      if (workout.isOptional) {
        return {
          workout,
          loadClass: "droppable" as const,
          reason: "The plan already marks this session optional.",
        };
      }

      const inSpecific = workout.phaseKey?.trim().toLowerCase() === "specific";
      const inBand = targetsMarathonPaceBand(workout, LOAD_BEARING_MP_BAND.min, LOAD_BEARING_MP_BAND.max);

      if (inSpecific && inBand) {
        return {
          workout,
          loadClass: "load-bearing" as const,
          reason: `Specific-phase work at ${LOAD_BEARING_MP_BAND.min}-${LOAD_BEARING_MP_BAND.max}% of marathon pace. This is the session the race is rehearsed in; protect it and move easier days around it.`,
        };
      }

      if (inBand) {
        return {
          workout,
          loadClass: "supporting" as const,
          reason: "Close to marathon pace, but outside the specific phase. Worth keeping if it fits, not worth protecting at the cost of recovery.",
        };
      }

      if (isBigSession(workout)) {
        return {
          workout,
          loadClass: "supporting" as const,
          reason: "A demanding session that is not marathon-specific. Shortening it, or dropping it to make room to recover, costs less than it looks like.",
        };
      }

      return {
        workout,
        loadClass: "droppable" as const,
        reason: "Easy or supporting running. Skipping, shortening or redistributing this is the cheapest adjustment available.",
      };
    });
}

/** Days before the race inside which a change is worth a second look. */
export const ADAPTATION_WINDOW_DAYS = 28;

/** Is this date close enough to the race that moving or deleting a session deserves the helper? */
export function isInsideAdaptationWindow(date: string, raceDate: string | null): boolean {
  if (!raceDate) return false;
  const out = daysBetween(date, raceDate);
  return out >= 0 && out <= ADAPTATION_WINDOW_DAYS;
}
