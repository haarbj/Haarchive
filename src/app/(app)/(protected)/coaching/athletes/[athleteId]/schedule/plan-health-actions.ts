"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  COMPLETION_NORM_NOTE,
  rearrangeGuidance,
  suggestRaceReplacement,
  type PlaybookGuidance,
} from "@/lib/private-coaching/adjustment-playbook";
import { getAthleteGoalRace } from "@/lib/private-coaching/goal-race";
import {
  classifyUpcomingSessions,
  runPlanHealthChecks,
  type ClassifiedSession,
  type PacePercentBasis,
  type PlanHealthFinding,
  type PlanHealthPhase,
  type PlanHealthWorkout,
} from "@/lib/private-coaching/plan-health";
import { mondaysInRange } from "@/lib/private-coaching/training-phases";

// Part B items 3 and 4, coach-only. Every function here checks
// isPrivateCoach AND an active coaching relationship before reading
// anything, and none of them writes to the athlete's plan: the only write
// in this file is a coach dismissing a piece of advice.
//
// There is deliberately no athlete-facing counterpart. Plan-health
// findings are coach decision support, and Part B is invisible to
// athletes.

export type PlaybookView = {
  error?: string;
  /** Normalising copy shown on every adjustment surface. */
  completionNote?: string;
  /** How to move things in the phase the athlete is in right now. */
  rearrange?: PlaybookGuidance;
  /** The phase that guidance is about, for the heading. */
  currentPhaseKey?: string | null;
  /** Only present when the coach asked about a specific race. */
  raceReplacement?: {
    guidance: PlaybookGuidance;
    candidates: { id: string; scheduledDate: string; dayLabel: string | null }[];
  };
};

export type PlanHealthView = {
  error?: string;
  findings?: PlanHealthFinding[];
  /** Upcoming sessions sorted into load-bearing / supporting / droppable. */
  upcoming?: ClassifiedSession[];
  raceDate?: string | null;
  /** How many findings exist but are already dismissed, so the panel can offer to show them. */
  dismissedCount?: number;
};

type WorkoutRow = {
  id: string;
  scheduled_date: string;
  day_label: string | null;
  notes_from_coach: string | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  pace_percent_basis: string | null;
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  is_optional: boolean;
};

type PhaseRow = {
  phase_type: string;
  start_date: string;
  end_date: string;
  source_program_volume_variant_id: string | null;
};

function toPacePercentBasis(value: string | null): PacePercentBasis | null {
  return value === "marathon" || value === "5k" ? value : null;
}

async function requireCoachOf(athleteId: string) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." as const };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." as const };

  return { session, supabase };
}

export async function loadPlanHealth(input: { athleteId: string; includeDismissed?: boolean }): Promise<PlanHealthView> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase } = auth;

  const goalRace = await getAthleteGoalRace(supabase, input.athleteId);
  const raceDate = goalRace?.goalDate ?? null;

  const { data: phaseRows } = await supabase
    .from("training_phases")
    .select("phase_type, start_date, end_date, source_program_volume_variant_id")
    .eq("athlete_id", input.athleteId)
    .order("start_date", { ascending: true })
    .returns<PhaseRow[]>();
  const phases: PlanHealthPhase[] = (phaseRows ?? []).map((p) => ({
    phaseKey: p.phase_type,
    startDate: p.start_date,
    endDate: p.end_date,
    weeks: mondaysInRange(p.start_date, p.end_date).length,
  }));

  const { data: workoutRows } = await supabase
    .from("scheduled_workouts")
    .select(
      "id, scheduled_date, day_label, notes_from_coach, planned_rpe, planned_rpe_max, pace_percent_basis, pace_percent_min, pace_percent_max, is_optional",
    )
    .eq("athlete_id", input.athleteId)
    .order("scheduled_date", { ascending: true })
    .returns<WorkoutRow[]>();

  // A workout's phase is whichever phase's date range contains it -- the
  // same containment rule training-phases.ts already uses, not a second
  // notion of "which phase is this in".
  const phaseKeyForDate = (date: string): string | null =>
    phases.find((p) => date >= p.startDate && date <= p.endDate)?.phaseKey ?? null;

  const workouts: PlanHealthWorkout[] = (workoutRows ?? []).map((w) => ({
    id: w.id,
    scheduledDate: w.scheduled_date,
    dayLabel: w.day_label,
    prescription: w.notes_from_coach,
    plannedRpe: w.planned_rpe,
    plannedRpeMax: w.planned_rpe_max,
    pacePercentBasis: toPacePercentBasis(w.pace_percent_basis),
    pacePercentMin: w.pace_percent_min,
    pacePercentMax: w.pace_percent_max,
    isOptional: w.is_optional,
    phaseKey: phaseKeyForDate(w.scheduled_date),
  }));

  // Peak mileage comes from the volume variant this plan was generated
  // with, when it was generated from a Program at all. Deliberately not
  // the athlete's current or highest mileage: the phase-length check is
  // about the volume this buildup is AIMING at.
  let peakMileage: number | null = null;
  const volumeVariantId = (phaseRows ?? []).find((p) => p.source_program_volume_variant_id)?.source_program_volume_variant_id;
  if (volumeVariantId) {
    const { data: variant } = await supabase
      .from("program_volume_variants")
      .select("peak_mileage")
      .eq("id", volumeVariantId)
      .maybeSingle<{ peak_mileage: number | null }>();
    peakMileage = variant?.peak_mileage ?? null;
  }

  const { data: profile } = await supabase
    .from("athlete_profiles")
    .select("years_running")
    .eq("user_id", input.athleteId)
    .maybeSingle<{ years_running: number | null }>();

  const allFindings = runPlanHealthChecks({
    workouts,
    phases,
    raceDate,
    peakMileage,
    experienceYears: profile?.years_running ?? null,
  });

  const { data: dismissals } = await supabase
    .from("coach_guidance_dismissals")
    .select("finding_key")
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId)
    .returns<{ finding_key: string }[]>();
  const dismissed = new Set((dismissals ?? []).map((d) => d.finding_key));

  const visible = input.includeDismissed ? allFindings : allFindings.filter((f) => !dismissed.has(f.key));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = classifyUpcomingSessions({ workouts, fromDate: today, raceDate });

  return {
    findings: visible,
    upcoming,
    raceDate,
    dismissedCount: allFindings.filter((f) => dismissed.has(f.key)).length,
  };
}


/**
 * Part E, coach-only. The adjustment playbook for this athlete's current
 * situation: how to move things in the phase they are in, the normalising
 * completion note, and -- when the coach asks about one -- which session a
 * race would replace.
 *
 * Reads only. Returns guidance to read, never an action taken.
 */
export async function loadAdjustmentPlaybook(input: {
  athleteId: string;
  /** Optional: a race the coach is considering adding. */
  raceDistanceM?: number | null;
  raceDate?: string | null;
}): Promise<PlaybookView> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { supabase } = auth;

  const today = new Date().toISOString().slice(0, 10);

  const { data: phaseRows } = await supabase
    .from("training_phases")
    .select("phase_type, start_date, end_date")
    .eq("athlete_id", input.athleteId)
    .lte("start_date", today)
    .gte("end_date", today)
    .limit(1)
    .returns<{ phase_type: string; start_date: string; end_date: string }[]>();
  const currentPhaseKey = phaseRows?.[0]?.phase_type ?? null;

  const view: PlaybookView = {
    completionNote: COMPLETION_NORM_NOTE,
    rearrange: rearrangeGuidance(currentPhaseKey),
    currentPhaseKey,
  };

  if (input.raceDistanceM && input.raceDate) {
    const { data: workoutRows } = await supabase
      .from("scheduled_workouts")
      .select(
        "id, scheduled_date, day_label, notes_from_coach, planned_rpe, planned_rpe_max, pace_percent_basis, pace_percent_min, pace_percent_max, is_optional",
      )
      .eq("athlete_id", input.athleteId)
      .returns<WorkoutRow[]>();

    const suggestion = suggestRaceReplacement({
      raceDistanceM: input.raceDistanceM,
      raceDate: input.raceDate,
      workouts: (workoutRows ?? []).map((w) => ({
        id: w.id,
        scheduledDate: w.scheduled_date,
        dayLabel: w.day_label,
        prescription: w.notes_from_coach,
        plannedRpe: w.planned_rpe,
        plannedRpeMax: w.planned_rpe_max,
        pacePercentBasis: toPacePercentBasis(w.pace_percent_basis),
        pacePercentMin: w.pace_percent_min,
        pacePercentMax: w.pace_percent_max,
        isOptional: w.is_optional,
        phaseKey: null,
      })),
    });

    view.raceReplacement = {
      guidance: suggestion.guidance,
      candidates: suggestion.candidates.map((c) => ({
        id: c.id,
        scheduledDate: c.scheduledDate,
        dayLabel: c.dayLabel,
      })),
    };
  }

  return view;
}

export async function dismissPlanHealthFinding(input: {
  athleteId: string;
  findingKey: string;
}): Promise<{ error?: string; ok?: true }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase } = auth;

  const { error } = await supabase
    .from("coach_guidance_dismissals")
    .upsert(
      { coach_id: session.userId, athlete_id: input.athleteId, finding_key: input.findingKey },
      { onConflict: "coach_id,athlete_id,finding_key" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { ok: true };
}

export async function restorePlanHealthFindings(input: { athleteId: string }): Promise<{ error?: string; ok?: true }> {
  const auth = await requireCoachOf(input.athleteId);
  if ("error" in auth) return { error: auth.error };
  const { session, supabase } = auth;

  const { error } = await supabase
    .from("coach_guidance_dismissals")
    .delete()
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId);
  if (error) return { error: error.message };

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return { ok: true };
}
