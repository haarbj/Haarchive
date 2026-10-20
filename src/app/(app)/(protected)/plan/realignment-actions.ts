"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getActiveCoachRelationship } from "@/lib/private-coaching/athlete-coach";
import type { DisruptionWindow } from "@/lib/private-coaching/plan-realignment";
import { createOrFindRealignmentProposal } from "@/lib/private-coaching/realignment-service";

// Trigger (a): the athlete flags their own disruption -- "I was sick /
// traveling / couldn't train," with a date range -- from their own
// schedule. This never shows the athlete anything back: the proposal it
// creates is coach-review-only (realignment_proposals' own RLS has no
// athlete select-after-decide surface beyond their own row's status, and
// this page never renders the proposal itself) -- it just lands on the
// coach's side the same way trigger (b) does, through the exact same
// createOrFindRealignmentProposal used there.
export async function flagDisruption(disruption: DisruptionWindow, note: string | null): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session) return { error: "Not signed in." };
  if (disruption.startDate > disruption.endDate) return { error: "The start date has to be on or before the end date." };

  const supabase = await createClient();
  const relationship = await getActiveCoachRelationship(supabase, session.userId);
  if (!relationship) return { error: "You don't have an active coach to notify." };

  const { error } = await createOrFindRealignmentProposal(supabase, {
    athleteId: session.userId,
    coachId: relationship.coachId,
    disruption,
    triggeredBy: "athlete",
    triggeredByUserId: session.userId,
    note,
  });
  return error ? { error } : {};
}
