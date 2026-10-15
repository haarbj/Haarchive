// Scheduling Item 30's strength-training framework onto a generated
// program's real calendar days. Purely additive: every placement below
// attaches a WorkoutExtraInput (see extras.ts) to a day the generation
// already scheduled an easy run on. Nothing here creates a new day,
// moves a day, or touches a day that isn't an easy run -- a long run, a
// threshold day, an interval day, and every other hard or structured
// session pass through completely untouched. That is the actual
// mechanism behind "strength never displaces or precedes a key running
// session": the set of days this module is allowed to write to never
// includes one.
//
// Pure and deterministic, same discipline as program-generation.ts and
// advanced-techniques.ts: given the same days/phases/selections/gating
// input, it always produces the same placement. Called from
// assign-program-actions.ts, after resolveProgramGeneration, before the
// result is written.

import { splitDayLabel } from "@/lib/private-coaching/day-type-visuals";
import { phaseFamily, type PhaseFamily } from "@/lib/private-coaching/adjustment-playbook";
import { daysBetween, mostRecentMonday } from "@/lib/week";
import type { ResolvedProgramDay, ResolvedProgramPhase } from "@/lib/private-coaching/program-generation";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import {
  FOUNDATION_ROUTINES,
  heavyLiftingExtra,
  hillSprintsExtra,
  plyometricsExtra,
  routineToExtra,
} from "@/lib/private-coaching/strength-routines";

export type StrengthSelections = {
  /** The foundation (pedestal + hip stability). Default on for every athlete -- "when in doubt, stability work only." */
  foundation: boolean;
  heavyLifting: boolean;
  plyometrics: boolean;
  hillSprints: boolean;
};

export const DEFAULT_STRENGTH_SELECTIONS: StrengthSelections = {
  foundation: true,
  heavyLifting: false,
  plyometrics: false,
  hillSprints: false,
};

/**
 * Coach-asserted facts about this athlete right now, the same "the coach
 * has context this module cannot see" pattern specialBlockEligibility
 * and depletionWorkoutEligibility already use (advanced-techniques.ts) --
 * nothing here is read from a persisted diagnosis, and nothing here makes
 * one. An injury or setback case routes to setbacks.ts and a
 * professional, never to a judgment made inside this scheduling step.
 */
export type StrengthGatingInput = {
  injuryProne: boolean;
  reboundingFromSetback: boolean;
  experiencedAthlete: boolean;
};

export type StrengthOptionKey = "foundation" | "heavy-lifting" | "plyometrics" | "hill-sprints";

export type AppliedStrengthOption = {
  key: StrengthOptionKey;
  included: boolean;
  rationale: string;
};

const EASY_RUN_LABELS = new Set(["easy", "shakeout", "recovery"]);

function isEasyRunDay(dayLabel: string | null): boolean {
  if (!dayLabel) return false;
  const { base } = splitDayLabel(dayLabel);
  return EASY_RUN_LABELS.has(base.toLowerCase());
}

function phaseFamilyForDate(date: string, phases: ResolvedProgramPhase[]): PhaseFamily {
  const phase = phases.find((p) => date >= p.startDate && date <= p.endDate);
  return phaseFamily(phase?.phaseKey ?? null);
}

function totalWeeksAcross(phases: ResolvedProgramPhase[]): number {
  return phases.reduce((sum, phase) => sum + Math.round((daysBetween(phase.startDate, phase.endDate) + 1) / 7), 0);
}

/**
 * Plyometrics' hard eligibility gate -- the highest-injury-risk of the
 * three performance options. Never for a rebounding or injury-prone
 * athlete, reserved for healthy and experienced athletes, and never
 * offered without the eight-plus weeks the buildup needs to introduce it
 * slowly rather than as a late addition under time pressure.
 */
export function plyometricsEligibility(
  input: StrengthGatingInput & { totalWeeks: number },
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.injuryProne) reasons.push("Never for an injury-prone athlete.");
  if (input.reboundingFromSetback) reasons.push("Never when rebounding from a setback.");
  if (!input.experiencedAthlete) reasons.push("Reserved for healthy, experienced athletes.");
  if (input.totalWeeks < 8) reasons.push("Needs at least eight weeks in this buildup to build up safely.");
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Places every selected strength option onto the easy-run days already
 * present in `days`, respecting each option's own scheduling rule:
 *   - foundation: every easy-run day gets both routines.
 *   - heavy lifting: up to the first two easy-run days of each week,
 *     volume driven by that day's own phase family.
 *   - plyometrics: at most one easy-run day per week, never a day heavy
 *     lifting already claimed that week, and only once plyometricsEligibility
 *     actually clears.
 *   - hill sprints: every easy-run day.
 * Returns the days with extras appended (existing extras are untouched
 * and ordered before the new ones) plus a per-option summary meant for
 * the coach view -- which options actually landed anywhere, and why one
 * that was asked for didn't.
 */
export function scheduleStrengthTraining(
  days: ResolvedProgramDay[],
  phases: ResolvedProgramPhase[],
  selections: StrengthSelections,
  gating: StrengthGatingInput,
): { days: ResolvedProgramDay[]; appliedOptions: AppliedStrengthOption[] } {
  const totalWeeks = totalWeeksAcross(phases);
  const plyoGate = plyometricsEligibility({ ...gating, totalWeeks });

  const weekGroups = new Map<string, ResolvedProgramDay[]>();
  for (const day of days) {
    if (!isEasyRunDay(day.dayLabel)) continue;
    const weekStart = mostRecentMonday(new Date(`${day.scheduledDate}T00:00:00Z`));
    const group = weekGroups.get(weekStart);
    if (group) group.push(day);
    else weekGroups.set(weekStart, [day]);
  }

  const extrasToAddById = new Map<string, WorkoutExtraInput[]>();
  function addExtra(day: ResolvedProgramDay, extra: WorkoutExtraInput) {
    const list = extrasToAddById.get(day.sourceProgramDayId);
    if (list) list.push(extra);
    else extrasToAddById.set(day.sourceProgramDayId, [extra]);
  }

  let foundationPlaced = false;
  let heavyLiftingPlaced = false;
  let plyometricsPlaced = false;
  let hillSprintsPlaced = false;

  for (const group of weekGroups.values()) {
    const sorted = [...group].sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0));

    if (selections.foundation) {
      for (const day of sorted) {
        for (const routine of FOUNDATION_ROUTINES) addExtra(day, routineToExtra(routine));
        foundationPlaced = true;
      }
    }

    if (selections.hillSprints) {
      for (const day of sorted) {
        addExtra(day, hillSprintsExtra());
        hillSprintsPlaced = true;
      }
    }

    const heavyLiftingDays = selections.heavyLifting ? sorted.slice(0, 2) : [];
    for (const day of heavyLiftingDays) {
      addExtra(day, heavyLiftingExtra(phaseFamilyForDate(day.scheduledDate, phases)));
      heavyLiftingPlaced = true;
    }

    if (selections.plyometrics && plyoGate.eligible) {
      const heavyLiftingIds = new Set(heavyLiftingDays.map((d) => d.sourceProgramDayId));
      const plyoDay = sorted.find((d) => !heavyLiftingIds.has(d.sourceProgramDayId));
      if (plyoDay) {
        addExtra(plyoDay, plyometricsExtra());
        plyometricsPlaced = true;
      }
    }
  }

  const nextDays = days.map((day) => {
    const toAdd = extrasToAddById.get(day.sourceProgramDayId);
    if (!toAdd || toAdd.length === 0) return day;
    const startOrder = day.extras.length;
    const newExtras = toAdd.map((extra, i) => ({ ...extra, extraOrder: startOrder + i }));
    return { ...day, extras: [...day.extras, ...newExtras] };
  });

  const appliedOptions: AppliedStrengthOption[] = [
    {
      key: "foundation",
      included: foundationPlaced,
      rationale: selections.foundation
        ? "Modified pedestal + hip stability on every easy day -- the default foundation every athlete gets, performance options or not."
        : "Turned off for this assignment.",
    },
    {
      key: "heavy-lifting",
      included: heavyLiftingPlaced,
      rationale: selections.heavyLifting
        ? "Twice weekly, after an easy run, never before it. Full volume in the general phase, 60-70% maintenance volume once supportive or specific work begins."
        : "Not included for this assignment.",
    },
    {
      key: "plyometrics",
      included: plyometricsPlaced,
      rationale: !selections.plyometrics
        ? "Not included for this assignment."
        : plyoGate.eligible
          ? "Once weekly, after an easy run, on a day heavy lifting didn't already claim that week."
          : `Withheld: ${plyoGate.reasons.join(" ")}`,
    },
    {
      key: "hill-sprints",
      included: hillSprintsPlaced,
      rationale: selections.hillSprints
        ? "Appended after every easy run -- the most running-specific of the three, minimal soreness, usable year-round."
        : "Not included for this assignment.",
    },
  ];

  return { days: nextDays, appliedOptions };
}
