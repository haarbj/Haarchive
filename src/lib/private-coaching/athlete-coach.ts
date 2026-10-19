import type { createClient } from "@/lib/db/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ActiveCoachRelationship = {
  coachId: string;
  /** True only when the athlete's own coach_athletes row is a self-coach row (coach_id === athlete_id), not a real coach. */
  isSelfCoached: boolean;
};

/**
 * Resolves an athlete's one real "current coach" from coach_athletes,
 * when more than one row with status='active' can exist for the same
 * athlete at once. That's a real, intended possibility in this schema,
 * not an edge case to rule out: becomeSelfCoach (self-coach-actions.ts)
 * inserts a self-referential row (coach_id = athlete_id) for any
 * signed-in user who wants the coaching toolset for their own training,
 * and acceptPrivateCoachInvite (coaching-invite/[token]/actions.ts)
 * later inserts a SECOND, genuinely different row when that same person
 * accepts a real coach's invite -- it never deactivates the earlier
 * self-coach row, and nothing in the schema does either (the
 * coach_athletes_active_pair_idx unique index only dedupes identical
 * (coach_id, athlete_id) pairs; it says nothing about one athlete having
 * two different active coaches at once).
 *
 * Every caller that needs to know WHICH coach an athlete currently has
 * (as opposed to session.ts's isCoachedAthlete, which only needs "is
 * there any active row at all" and is unaffected by this ambiguity)
 * should go through this function rather than reading coach_athletes
 * directly with an unordered `.limit(1).maybeSingle()`, which can return
 * either row with no guaranteed preference and previously surfaced the
 * self-coach row even after a real invite was accepted.
 *
 * A genuine non-self coach always wins over a self-coach row. Among
 * multiple genuine coaches (a rare mid-transfer edge case -- an old
 * coach's row not yet ended while a new one is accepted), the most
 * recently started one wins.
 */
export async function getActiveCoachRelationship(supabase: Supabase, athleteId: string): Promise<ActiveCoachRelationship | null> {
  const { data: rows } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .returns<{ coach_id: string }[]>();

  if (!rows || rows.length === 0) return null;

  const realCoachRow = rows.find((row) => row.coach_id !== athleteId);
  const chosen = realCoachRow ?? rows[0];
  return { coachId: chosen.coach_id, isSelfCoached: chosen.coach_id === athleteId };
}
