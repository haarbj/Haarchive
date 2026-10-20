"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { DisruptionWindow } from "@/lib/private-coaching/plan-realignment";
import {
  acceptRealignmentProposal,
  createOrFindRealignmentProposal,
  dismissRealignmentProposal,
  listRealignmentProposals,
  type RealignmentEntryOverride,
  type RealignmentProposalRow,
} from "@/lib/private-coaching/realignment-service";

async function requireCoachForAthlete(athleteId: string) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." as const };
  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .maybeSingle();
  if (!relationship) return { error: "Not authorized." as const };
  return { supabase, coachId: session.userId };
}

// Trigger (b): the coach initiates realignment for an athlete from their
// schedule page. Trigger (a) -- the athlete flagging their own disruption
// -- lives in plan/realignment-actions.ts, both funneling through the
// exact same createOrFindRealignmentProposal so a repeat trigger over an
// already-dismissed disruption+plan can never produce two slightly
// different code paths' worth of near-duplicate proposals.
export async function initiateRealignment(
  athleteId: string,
  disruption: DisruptionWindow,
  note: string | null,
): Promise<{ error?: string; alreadyDismissed?: boolean; proposalId?: string }> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return auth;

  const { row, alreadyDismissed, error } = await createOrFindRealignmentProposal(auth.supabase, {
    athleteId,
    coachId: auth.coachId,
    disruption,
    triggeredBy: "coach",
    triggeredByUserId: auth.coachId,
    note,
  });
  if (error) return { error };
  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return { alreadyDismissed, proposalId: row?.id };
}

export async function loadRealignmentProposals(athleteId: string): Promise<RealignmentProposalRow[]> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return [];
  return listRealignmentProposals(auth.supabase, athleteId);
}

// Accept: applies every moved/shortened/dropped entry directly to
// scheduled_workouts, each forced back to a draft -- the coach's own
// separate Publish step afterward (unchanged, existing flow) is what
// notifies the athlete. Nothing here is reachable by anyone but the
// athlete's own active coach.
export async function acceptRealignment(
  athleteId: string,
  proposalId: string,
  overrides: Record<string, RealignmentEntryOverride> = {},
): Promise<{ error?: string }> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return auth;
  const result = await acceptRealignmentProposal(auth.supabase, proposalId, auth.coachId, overrides);
  if (!result.error) revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return result;
}

// Dismiss: the plan stays exactly as it was (nothing in
// acceptRealignmentProposal's write path ever ran); the proposal's own
// fingerprint now sits in the 'dismissed' state createOrFindRealignmentProposal
// checks before ever generating another one from the same disruption+plan.
export async function dismissRealignment(athleteId: string, proposalId: string): Promise<{ error?: string }> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return auth;
  const result = await dismissRealignmentProposal(auth.supabase, proposalId, auth.coachId);
  if (!result.error) revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return result;
}
