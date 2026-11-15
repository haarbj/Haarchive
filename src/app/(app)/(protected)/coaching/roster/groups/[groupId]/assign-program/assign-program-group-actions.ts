"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { ResolvedProgramGeneration } from "@/lib/private-coaching/program-generation";
import type { AppliedStrengthOption } from "@/lib/private-coaching/strength-scheduling";
import {
  assignProgramToAthlete,
  previewProgramAssignment,
  type AssignProgramInput,
  type OverlappingPhase,
} from "../../../../athletes/[athleteId]/schedule/assign-program-actions";

// Group-aware program assignment, step 2 of the workflow
// 20261013010000_private_coaching_training_groups.sql deliberately deferred
// ("per-group program assignment is a separate, later change"). This file
// never duplicates assignment logic -- it loops the existing, tested
// single-athlete functions (previewProgramAssignment / assignProgramToAthlete)
// per group member, since each of those already re-derives the generation
// server-side and checks the caller actually coaches that specific athlete
// (loadResolvedGeneration's own coach_athletes check). A group is just a
// label over a set of athletes; it grants no assignment authority of its own.

export type GroupAssignMember = { athleteId: string; name: string };

// Re-selects training_groups by id -- RLS (training_groups_all_own) already
// scopes this to the caller's own groups, so "not found" and "not yours"
// are indistinguishable here on purpose (same pattern as groups-actions.ts).
export async function loadGroupMembersForAssign(
  groupId: string,
): Promise<{ error?: string; groupName?: string; members?: GroupAssignMember[] }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("training_groups")
    .select("id, name")
    .eq("id", groupId)
    .maybeSingle<{ id: string; name: string }>();
  if (!group) return { error: "That group isn't yours." };

  const { data: memberRows } = await supabase
    .from("training_group_members")
    .select("athlete_id")
    .eq("group_id", groupId)
    .returns<{ athlete_id: string }[]>();
  const athleteIds = (memberRows ?? []).map((m) => m.athlete_id);
  if (athleteIds.length === 0) return { groupName: group.name, members: [] };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", athleteIds)
    .returns<{ id: string; display_name: string }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return {
    groupName: group.name,
    members: athleteIds.map((id) => ({ athleteId: id, name: nameById.get(id) ?? "Athlete" })),
  };
}

export type GroupAssignConfig = Omit<AssignProgramInput, "athleteId">;

export type GroupMemberPreview = {
  athleteId: string;
  name: string;
  /** e.g. "You don't coach this athlete" if their membership went stale. */
  error?: string;
  overlappingPhases: OverlappingPhase[];
};

// The generation itself (weeks/days/warnings) never varies by athlete for a
// fixed program/variant/phase/anchor config -- loadResolvedGeneration's only
// athlete-specific step is the coach_athletes authorization check (see that
// function's own header). So every member is still previewed individually
// (that check has to run per athlete), but only the first success is kept
// as "the" shared generation shown once in the review screen; what varies
// is overlappingPhases, which is genuinely per-athlete (their own calendar).
export async function previewProgramAssignmentForGroup(
  groupId: string,
  config: GroupAssignConfig,
): Promise<{
  error?: string;
  generation?: ResolvedProgramGeneration;
  appliedStrengthOptions?: AppliedStrengthOption[];
  members?: GroupMemberPreview[];
}> {
  const loaded = await loadGroupMembersForAssign(groupId);
  if (loaded.error) return { error: loaded.error };
  const members = loaded.members ?? [];
  if (members.length === 0) return { error: "This group has no athletes yet." };

  const results: GroupMemberPreview[] = [];
  let sharedGeneration: ResolvedProgramGeneration | undefined;
  let sharedStrengthOptions: AppliedStrengthOption[] | undefined;

  for (const member of members) {
    const preview = await previewProgramAssignment({ ...config, athleteId: member.athleteId });
    if (preview.error) {
      results.push({ athleteId: member.athleteId, name: member.name, error: preview.error, overlappingPhases: [] });
      continue;
    }
    if (!sharedGeneration) sharedGeneration = preview.result;
    if (!sharedStrengthOptions) sharedStrengthOptions = preview.appliedStrengthOptions;
    results.push({ athleteId: member.athleteId, name: member.name, overlappingPhases: preview.overlappingPhases ?? [] });
  }

  if (!sharedGeneration) {
    return { error: "Couldn't generate this program for any athlete in the group.", members: results };
  }

  return { generation: sharedGeneration, appliedStrengthOptions: sharedStrengthOptions, members: results };
}

export type GroupAssignOutcome = {
  error?: string;
  assigned?: { athleteId: string; name: string; workoutsCreated: number; phasesCreated: number }[];
  skipped?: { athleteId: string; name: string; reason: string }[];
  failed?: { athleteId: string; name: string; error: string }[];
};

// decisions[athleteId] === true means "this athlete had a conflict and the
// coach checked 'clear and reassign' for them in the review screen" -- a
// conflicting athlete left out of this map (or false) is skipped, never
// silently cleared. confirmedWarnings is shared across the whole group
// since the warnings themselves are structural to the program/variant/
// phase/anchor choice, not athlete-specific (see previewProgramAssignmentForGroup).
export async function assignProgramToGroup(
  groupId: string,
  config: GroupAssignConfig,
  confirmedWarnings: boolean,
  decisions: Record<string, boolean>,
): Promise<GroupAssignOutcome> {
  const loaded = await loadGroupMembersForAssign(groupId);
  if (loaded.error) return { error: loaded.error };
  const members = loaded.members ?? [];
  if (members.length === 0) return { error: "This group has no athletes yet." };

  const assigned: GroupAssignOutcome["assigned"] = [];
  const skipped: GroupAssignOutcome["skipped"] = [];
  const failed: GroupAssignOutcome["failed"] = [];

  for (const member of members) {
    // Re-previewed here rather than trusting the review screen's earlier
    // snapshot -- membership, the coaching relationship, and the athlete's
    // own calendar can all change between loading that screen and this
    // submit (assignProgramToAthlete itself re-derives the generation the
    // same way; this mirrors that same "never trust the client" discipline
    // for the overlap check specifically).
    const preview = await previewProgramAssignment({ ...config, athleteId: member.athleteId });
    if (preview.error) {
      failed.push({ athleteId: member.athleteId, name: member.name, error: preview.error });
      continue;
    }
    const hasOverlap = (preview.overlappingPhases?.length ?? 0) > 0;
    const clear = decisions[member.athleteId] === true;
    if (hasOverlap && !clear) {
      skipped.push({
        athleteId: member.athleteId,
        name: member.name,
        reason: "Overlapped an existing training phase and wasn't checked to clear it.",
      });
      continue;
    }

    const result = await assignProgramToAthlete({
      ...config,
      athleteId: member.athleteId,
      confirmedWarnings,
      clearOverlapping: clear,
    });
    if (result.error) {
      failed.push({ athleteId: member.athleteId, name: member.name, error: result.error });
      continue;
    }
    assigned.push({
      athleteId: member.athleteId,
      name: member.name,
      workoutsCreated: result.workoutsCreated ?? 0,
      phasesCreated: result.phasesCreated ?? 0,
    });
  }

  return { assigned, skipped, failed };
}
