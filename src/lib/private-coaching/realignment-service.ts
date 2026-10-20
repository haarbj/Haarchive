import type { createClient } from "@/lib/db/server";
import { addDays } from "@/lib/week";
import {
  fingerprintRealignmentInput,
  proposeRealignment,
  type DisruptionWindow,
  type RealignmentProposal,
  type RealignmentWorkout,
} from "@/lib/private-coaching/plan-realignment";

// The Supabase-touching half of Plan Realignment -- fetches the horizon's
// real workouts, calls the pure engine (plan-realignment.ts), and owns
// the realignment_proposals row's whole lifecycle (create, accept,
// dismiss). Deliberately NOT a "use server" actions file itself (every
// export from one of those must be an async Server Action, the same
// constraint week.ts's own header comment documents) -- this is plain,
// shared logic that both the coach-side and athlete-side "use server"
// action files below import and wrap, so the two triggers (coach
// initiates, athlete flags a disruption) can never drift into two
// separately-maintained copies of the same proposal/accept/dismiss
// lifecycle.

type Supabase = Awaited<ReturnType<typeof createClient>>;

type WorkoutRow = {
  id: string;
  scheduled_date: string;
  workout_type: RealignmentWorkout["workoutType"];
  day_label: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  is_optional: boolean;
  published_at: string | null;
  day_label_legacy_title?: string | null;
};

async function fetchHorizonWorkouts(
  supabase: Supabase,
  athleteId: string,
  horizonStart: string,
  horizonEnd: string,
): Promise<{ rows: WorkoutRow[]; workouts: RealignmentWorkout[] }> {
  const { data } = await supabase
    .from("scheduled_workouts")
    .select(
      "id, scheduled_date, workout_type, day_label, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_rpe, planned_rpe_max, is_optional, published_at",
    )
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", horizonStart)
    .lte("scheduled_date", horizonEnd)
    .returns<WorkoutRow[]>();

  const rows = data ?? [];
  const workouts: RealignmentWorkout[] = rows.map((row) => ({
    id: row.id,
    scheduledDate: row.scheduled_date,
    workoutType: row.workout_type,
    dayLabel: row.day_label,
    plannedDistanceM: row.planned_distance_m,
    plannedDistanceMaxM: row.planned_distance_max_m,
    plannedDurationS: row.planned_duration_s,
    plannedDurationMaxS: row.planned_duration_max_s,
    plannedRpe: row.planned_rpe,
    plannedRpeMax: row.planned_rpe_max,
    isOptional: row.is_optional,
  }));
  return { rows, workouts };
}

export type RealignmentProposalRow = {
  id: string;
  athlete_id: string;
  coach_id: string;
  triggered_by: "athlete" | "coach";
  triggered_by_user_id: string;
  disruption_start_date: string;
  disruption_end_date: string;
  disruption_note: string | null;
  status: "pending" | "accepted" | "dismissed";
  fingerprint: string;
  proposal: RealignmentProposal;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

/**
 * The one place either trigger (athlete flags a disruption, coach
 * initiates one) creates a proposal. Computes it once, right now, from
 * the current plan -- re-opening this same proposal later (to show the
 * coach, or to look back at a decided one) reads the stored `proposal`
 * jsonb rather than re-running the engine, so a later edit to the plan
 * can't retroactively change what a past proposal says it proposed.
 *
 * If an identical disruption+plan was already dismissed (same
 * fingerprint, status 'dismissed'), returns that existing row instead of
 * inserting a near-duplicate -- the "don't regenerate an identical
 * proposal" requirement, enforced here rather than left to the caller.
 */
export async function createOrFindRealignmentProposal(
  supabase: Supabase,
  input: {
    athleteId: string;
    coachId: string;
    disruption: DisruptionWindow;
    triggeredBy: "athlete" | "coach";
    triggeredByUserId: string;
    note: string | null;
  },
): Promise<{ row: RealignmentProposalRow | null; alreadyDismissed: boolean; error?: string }> {
  const horizonStart = addDays(input.disruption.endDate, 1);
  const horizonEnd = addDays(horizonStart, 6);
  const { workouts } = await fetchHorizonWorkouts(supabase, input.athleteId, horizonStart, horizonEnd);

  const fingerprint = fingerprintRealignmentInput(input.athleteId, input.disruption, workouts);

  const { data: existingDismissed } = await supabase
    .from("realignment_proposals")
    .select("*")
    .eq("athlete_id", input.athleteId)
    .eq("fingerprint", fingerprint)
    .eq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RealignmentProposalRow>();

  if (existingDismissed) {
    return { row: existingDismissed, alreadyDismissed: true };
  }

  const proposal = proposeRealignment(input.disruption, workouts);

  const { data: inserted, error } = await supabase
    .from("realignment_proposals")
    .insert({
      athlete_id: input.athleteId,
      coach_id: input.coachId,
      triggered_by: input.triggeredBy,
      triggered_by_user_id: input.triggeredByUserId,
      disruption_start_date: input.disruption.startDate,
      disruption_end_date: input.disruption.endDate,
      disruption_note: input.note,
      fingerprint,
      proposal,
    })
    .select("*")
    .single<RealignmentProposalRow>();

  if (error) return { row: null, alreadyDismissed: false, error: error.message };
  return { row: inserted, alreadyDismissed: false };
}

export async function listRealignmentProposals(supabase: Supabase, athleteId: string): Promise<RealignmentProposalRow[]> {
  const { data } = await supabase
    .from("realignment_proposals")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .returns<RealignmentProposalRow[]>();
  return data ?? [];
}

/**
 * Applies every changed entry in an already-computed proposal directly
 * to scheduled_workouts -- moved (scheduled_date), shortened (distance/
 * duration), dropped (deleted) -- and marks the row 'accepted'. Every
 * touched workout is forced back to a draft (published_at = null)
 * regardless of its prior state: Accept is not Publish. The coach's own,
 * completely ordinary publish step afterward is what notifies the
 * athlete, through the exact notification path every other published
 * workout already uses -- nothing here calls createNotification.
 */
export type RealignmentEntryOverride = { proposedDate: string; proposedDistanceM: number | null; proposedDurationS: number | null };

/**
 * Accept always applies exactly what's currently shown to the coach --
 * the engine's own proposal, or, for any entry the coach tweaked in the
 * consent card's inline editor first, their edited values instead
 * (keyed by the original workout id). This is "Edit... without applying
 * it" in full: the override map only ever changes what Accept is about
 * to write, never writes anything on its own.
 */
export async function acceptRealignmentProposal(
  supabase: Supabase,
  proposalId: string,
  decidedBy: string,
  overrides: Record<string, RealignmentEntryOverride> = {},
): Promise<{ error?: string }> {
  const { data: row } = await supabase
    .from("realignment_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("status", "pending")
    .maybeSingle<RealignmentProposalRow>();
  if (!row) return { error: "That proposal is no longer pending." };

  for (const entry of row.proposal.entries) {
    const override = overrides[entry.original.id];
    if (entry.changeKind === "unchanged" && !override) continue;
    if (entry.changeKind === "dropped" && !override) {
      const { error } = await supabase.from("scheduled_workouts").delete().eq("id", entry.original.id);
      if (error) return { error: error.message };
      continue;
    }
    const proposedDate = override?.proposedDate ?? entry.proposedDate;
    const proposedDistanceM = override ? override.proposedDistanceM : entry.proposedDistanceM;
    const proposedDurationS = override ? override.proposedDurationS : entry.proposedDurationS;
    // "moved" and "shortened" both land here -- a move only ever changes
    // scheduled_date, a shorten only ever changes distance/duration, but
    // writing all three columns every time is simpler than branching and
    // harmless: a "moved" entry's proposedDistanceM/proposedDurationS are
    // already identical to its own original values.
    const { error } = await supabase
      .from("scheduled_workouts")
      .update({
        scheduled_date: proposedDate,
        planned_distance_m: proposedDistanceM,
        planned_duration_s: proposedDurationS,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.original.id);
    if (error) return { error: error.message };
  }

  const { error: statusError } = await supabase
    .from("realignment_proposals")
    .update({ status: "accepted", decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", proposalId);
  if (statusError) return { error: statusError.message };
  return {};
}

export async function dismissRealignmentProposal(supabase: Supabase, proposalId: string, decidedBy: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("realignment_proposals")
    .update({ status: "dismissed", decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", proposalId)
    .eq("status", "pending");
  if (error) return { error: error.message };
  return {};
}
