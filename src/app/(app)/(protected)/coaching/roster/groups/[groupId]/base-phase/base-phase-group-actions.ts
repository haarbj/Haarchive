"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { BasePhaseAthleteType, BasePhasePlan } from "@/lib/private-coaching/base-phase-generator";
import { loadGroupMembersForAssign } from "../assign-program/assign-program-group-actions";
import {
  addBasePhaseToSchedule,
  checkBasePhaseSchedule,
  loadProgramOptionsForBasePhase,
  previewBasePhase,
  type BasePhaseAnchor,
  type BasePhaseConflict,
  type BasePhaseProgramOption,
} from "../../../../athletes/[athleteId]/base-phase/actions";

// Group-aware base phase assignment -- the base-phase counterpart to
// commit 8721d64's group program assignment (assign-program-group-actions.ts
// in the sibling assign-program/ directory). Reuses that exact pattern:
// loadGroupMembersForAssign is imported directly (zero duplication, same
// membership-loading/ownership-check logic), and this file never
// re-implements the mileage math, the injury gate, the long-run guardrail,
// or the schedule-write path -- it loops the existing single-athlete
// previewBasePhase/checkBasePhaseSchedule/addBasePhaseToSchedule functions
// per member, the same "reuse the tested single-athlete functions" choice
// the program-assignment version made.

export async function loadProgramsForGroupBasePhase(): Promise<{ error?: string; programs?: BasePhaseProgramOption[] }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  const supabase = await createClient();
  return { programs: await loadProgramOptionsForBasePhase(supabase) };
}

export type GroupBasePhaseConfig = {
  startingWeeklyMiles: number;
  targetWeek: { totalMiles: number; daysPerWeek: number };
  weeksAvailable: number;
  athleteType: BasePhaseAthleteType;
  currentDaysPerWeek: number;
  longestRunInLast30DaysMiles: number | null;
  restartStepMiles?: number;
  anchor: BasePhaseAnchor;
};

export type GroupBasePhaseMemberPreview = {
  athleteId: string;
  name: string;
  /** Set when this member is excluded from the run entirely (injury history, or couldn't generate/schedule-check for them). */
  error?: string;
  conflict: BasePhaseConflict | null;
};

// One shared config for the whole group (same "organized by ability" premise
// as the group's own existence -- see groups-section.tsx's own comment) --
// but the injury gate and the schedule-conflict check are genuinely
// per-athlete, so each member is still individually previewed/checked. The
// mileage plan itself doesn't vary by athlete for a fixed config (same
// reasoning previewProgramAssignmentForGroup already relies on), so only
// the first success is kept as "the" shared plan shown once.
export async function previewBasePhaseForGroup(
  groupId: string,
  config: GroupBasePhaseConfig,
): Promise<{ error?: string; plan?: BasePhasePlan; members?: GroupBasePhaseMemberPreview[] }> {
  const loaded = await loadGroupMembersForAssign(groupId);
  if (loaded.error) return { error: loaded.error };
  const members = loaded.members ?? [];
  if (members.length === 0) return { error: "This group has no athletes yet." };

  let sharedPlan: BasePhasePlan | undefined;
  const results: GroupBasePhaseMemberPreview[] = [];

  for (const member of members) {
    const preview = await previewBasePhase(member.athleteId, {
      startingWeeklyMiles: config.startingWeeklyMiles,
      targetWeek: { ...config.targetWeek, workoutDaysPerWeek: 2 },
      weeksAvailable: config.weeksAvailable,
      athleteType: config.athleteType,
      currentDaysPerWeek: config.currentDaysPerWeek,
      longestRunInLast30DaysMiles: config.longestRunInLast30DaysMiles,
      restartStepMiles: config.restartStepMiles,
    });

    if (preview.blockedForInjuryHistory) {
      results.push({ athleteId: member.athleteId, name: member.name, error: "Has reported injury history -- needs manual planning, skipped.", conflict: null });
      continue;
    }
    if (preview.error || !preview.plan) {
      results.push({ athleteId: member.athleteId, name: member.name, error: preview.error ?? "Couldn't generate a template.", conflict: null });
      continue;
    }
    if (!sharedPlan) sharedPlan = preview.plan;

    const schedule = await checkBasePhaseSchedule(member.athleteId, config.anchor, preview.plan.weeks.length);
    if (schedule.error) {
      results.push({ athleteId: member.athleteId, name: member.name, error: schedule.error, conflict: null });
      continue;
    }
    results.push({ athleteId: member.athleteId, name: member.name, conflict: schedule.conflict ?? null });
  }

  if (!sharedPlan) return { error: "Couldn't generate a base phase for any athlete in the group.", members: results };
  return { plan: sharedPlan, members: results };
}

export type GroupBasePhaseOutcome = {
  error?: string;
  assigned?: { athleteId: string; name: string; daysCreated: number }[];
  skipped?: { athleteId: string; name: string; reason: string }[];
  failed?: { athleteId: string; name: string; error: string }[];
};

// decisions[athleteId] === true means the coach checked "clear and reassign"
// for that athlete in the review screen. A conflicting member left out of
// this map (or false) is skipped, never silently cleared -- same guarantee
// as the group program-assign flow's own decisions map.
export async function assignBasePhaseToGroup(
  groupId: string,
  config: GroupBasePhaseConfig,
  decisions: Record<string, boolean>,
): Promise<GroupBasePhaseOutcome> {
  const loaded = await loadGroupMembersForAssign(groupId);
  if (loaded.error) return { error: loaded.error };
  const members = loaded.members ?? [];
  if (members.length === 0) return { error: "This group has no athletes yet." };

  const assigned: GroupBasePhaseOutcome["assigned"] = [];
  const skipped: GroupBasePhaseOutcome["skipped"] = [];
  const failed: GroupBasePhaseOutcome["failed"] = [];

  for (const member of members) {
    // Re-previewed and re-checked here rather than trusting the review
    // screen's earlier snapshot -- membership, the coaching relationship,
    // injury history, and the athlete's own calendar can all change between
    // that screen loading and this submit (addBasePhaseToSchedule itself
    // also re-checks the overlap a third time, at write time).
    const preview = await previewBasePhase(member.athleteId, {
      startingWeeklyMiles: config.startingWeeklyMiles,
      targetWeek: { ...config.targetWeek, workoutDaysPerWeek: 2 },
      weeksAvailable: config.weeksAvailable,
      athleteType: config.athleteType,
      currentDaysPerWeek: config.currentDaysPerWeek,
      longestRunInLast30DaysMiles: config.longestRunInLast30DaysMiles,
      restartStepMiles: config.restartStepMiles,
    });
    if (preview.blockedForInjuryHistory) {
      skipped.push({ athleteId: member.athleteId, name: member.name, reason: "Reported injury history -- needs manual planning." });
      continue;
    }
    if (preview.error || !preview.plan) {
      failed.push({ athleteId: member.athleteId, name: member.name, error: preview.error ?? "Couldn't generate a template." });
      continue;
    }

    const schedule = await checkBasePhaseSchedule(member.athleteId, config.anchor, preview.plan.weeks.length);
    if (schedule.error) {
      failed.push({ athleteId: member.athleteId, name: member.name, error: schedule.error });
      continue;
    }
    const clear = decisions[member.athleteId] === true;
    if (schedule.conflict && !clear) {
      skipped.push({
        athleteId: member.athleteId,
        name: member.name,
        reason: "Overlapped an existing phase and wasn't checked to clear it.",
      });
      continue;
    }

    const result = await addBasePhaseToSchedule(
      member.athleteId,
      config.anchor,
      preview.plan.weeks.map((w) => ({ weekNumber: w.weekNumber, longRunMiles: w.longRunMiles, mlrMiles: w.mlrMiles, easyMiles: w.easyMiles })),
      clear,
    );
    if (result.error) {
      failed.push({ athleteId: member.athleteId, name: member.name, error: result.error });
      continue;
    }
    assigned.push({ athleteId: member.athleteId, name: member.name, daysCreated: result.daysCreated ?? 0 });
  }

  return { assigned, skipped, failed };
}
