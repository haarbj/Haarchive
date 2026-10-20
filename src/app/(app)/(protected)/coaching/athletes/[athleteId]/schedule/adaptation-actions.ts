"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  acceptAdaptationCard,
  createOrRefreshAdaptationCards,
  dismissAdaptationCard,
  listAdaptationCards,
  type AdaptationCardRow,
} from "@/lib/private-coaching/adaptation-cards-service";
import { todayForViewer } from "@/lib/viewer-timezone";

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

// Runs the signal engine fresh and persists any newly-firing, non-
// suppressed cards, then returns this athlete's full card history (every
// status) for the schedule page's own card panel + audit list. Coach-only,
// mirroring realignment-actions.ts's exact authorization shape -- an
// athlete's own session can never reach this (no athlete-facing route
// calls it, and the table itself has no athlete RLS policy regardless).
export async function loadAdaptationCards(athleteId: string): Promise<AdaptationCardRow[]> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return [];
  await createOrRefreshAdaptationCards(auth.supabase, athleteId, auth.coachId, await todayForViewer());
  return listAdaptationCards(auth.supabase, athleteId);
}

// Accept: applies exactly the card's stated action (draft workout
// insert/update, or a check-in request notification) and marks the card
// accepted. `chosenDate` is required for fitness_up cards only -- the
// task's own spec: "coach picks the day on Accept."
export async function acceptAdaptationCardAction(athleteId: string, cardId: string, chosenDate?: string): Promise<{ error?: string }> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return auth;
  const result = await acceptAdaptationCard(auth.supabase, cardId, auth.coachId, { chosenDate });
  if (!result.error) revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return result;
}

// Dismiss: nothing else changes -- the card's own fingerprint now
// suppresses regeneration of identical evidence for
// DISMISSAL_SUPPRESSION_DAYS (see adaptation-cards-service.ts), after
// which even identical evidence may re-fire.
export async function dismissAdaptationCardAction(athleteId: string, cardId: string): Promise<{ error?: string }> {
  const auth = await requireCoachForAthlete(athleteId);
  if ("error" in auth) return auth;
  const result = await dismissAdaptationCard(auth.supabase, cardId, auth.coachId);
  if (!result.error) revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return result;
}
