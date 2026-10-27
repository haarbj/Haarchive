"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { addDays } from "@/lib/week";
import type { StepInput } from "@/lib/private-coaching/steps";
import { stepInputToIntensityTargets, intensityTargetsToStepRow } from "@/lib/private-coaching/intensity-target";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import {
  validateDistanceRange,
  validateDurationRange,
  validateHrRange,
  validatePaceRange,
  validatePacePercentRange,
  validateRpeRange,
  validateWeeklyMileageRange,
} from "@/lib/private-coaching/workout-distance";

// training_programs / program_phase_definitions / program_duration_
// variants / program_variant_phases / program_days / program_day_steps /
// program_day_extras / program_phase_weeks RLS all scope to
// coach_id = auth.uid() (directly or via a join, see the migrations) --
// no coach_athletes relationship involved at all, exactly like
// templates/actions.ts, since a Program belongs to the coach's own
// library, not to any one athlete. The RLS-scoped client is sufficient
// for everything in this file; no service-role client needed.

export type ProgramInput = {
  id?: string;
  name: string;
  description: string | null;
  scalesDistanceWithMileage: boolean;
  scalesDurationWithMileage: boolean;
  // The framework's own overview -- shared across every duration variant
  // under this Program (a 12-week and an 18-week version of the same
  // methodology have ONE overview, never one per variant), so this lives
  // on the Program itself, not a variant. Every field is optional.
  initialMileageMin: number | null;
  initialMileageMax: number | null;
  peakMileageMin: number | null;
  peakMileageMax: number | null;
  typicalGoalTimes: string | null;
  recommendedFor: string | null;
  glossaryTerms: string[];
};

export async function saveProgram(input: ProgramInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.name.trim()) return { error: "Give this program a name." };

  const initialMileageCheck = validateWeeklyMileageRange(input.initialMileageMin, input.initialMileageMax);
  if (!initialMileageCheck.valid) return { error: initialMileageCheck.error };
  const peakMileageCheck = validateWeeklyMileageRange(input.peakMileageMin, input.peakMileageMax);
  if (!peakMileageCheck.valid) return { error: peakMileageCheck.error };

  const supabase = await createClient();
  const fields = {
    name: input.name.trim(),
    description: input.description,
    scales_distance_with_mileage: input.scalesDistanceWithMileage,
    scales_duration_with_mileage: input.scalesDurationWithMileage,
    initial_mileage_min: input.initialMileageMin,
    initial_mileage_max: input.initialMileageMax,
    peak_mileage_min: input.peakMileageMin,
    peak_mileage_max: input.peakMileageMax,
    typical_goal_times: input.typicalGoalTimes,
    recommended_for: input.recommendedFor,
    glossary_terms: input.glossaryTerms.length > 0 ? input.glossaryTerms : null,
  };

  let programId = input.id;
  if (programId) {
    const { error } = await supabase
      .from("training_programs")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", programId)
      .eq("coach_id", session.userId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("training_programs")
      .insert({ coach_id: session.userId, ...fields })
      .select("id")
      .single();
    if (error) return { error: error.message };
    programId = data.id;
  }

  revalidatePath("/coaching/programs");
  if (input.id) revalidatePath(`/coaching/programs/${input.id}`);
  return { id: programId };
}

export async function deleteProgram(programId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("training_programs").delete().eq("id", programId).eq("coach_id", session.userId);
  if (error) return { error: error.message };

  revalidatePath("/coaching/programs");
  return {};
}

export type PhaseDefinitionInput = {
  id?: string;
  programId: string;
  phaseKey: string;
  name: string | null;
  durationWeeksMin: number;
  durationWeeksMax: number;
  isOptional: boolean;
  notes: string | null;
  // Athlete-facing "why this phase" copy, carried onto the athlete's own
  // phase row at assignment time -- see phase-explainers.ts.
  explainer: string | null;
};

export async function savePhaseDefinition(input: PhaseDefinitionInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.phaseKey.trim()) return { error: "Give this phase a name." };
  if (!Number.isFinite(input.durationWeeksMin) || input.durationWeeksMin < 1) {
    return { error: "Minimum weeks must be at least 1." };
  }
  if (!Number.isFinite(input.durationWeeksMax) || input.durationWeeksMax < input.durationWeeksMin) {
    return { error: "Maximum weeks can't be less than the minimum." };
  }

  const supabase = await createClient();

  // Ownership of the parent program is enforced by RLS on the insert/
  // update itself (program_phase_definitions_all_own joins back to
  // training_programs.coach_id) -- no separate ownership check needed
  // here, same as templates/actions.ts's own reasoning.
  if (input.id) {
    const { error } = await supabase
      .from("program_phase_definitions")
      .update({
        phase_key: input.phaseKey.trim(),
        name: input.name,
        duration_weeks_min: input.durationWeeksMin,
        duration_weeks_max: input.durationWeeksMax,
        is_optional: input.isOptional,
        notes: input.notes,
        explainer: input.explainer,
      })
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath(`/coaching/programs/${input.programId}`);
    return { id: input.id };
  }

  const { data: existing } = await supabase
    .from("program_phase_definitions")
    .select("position")
    .eq("program_id", input.programId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  const nextPosition = (existing?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("program_phase_definitions")
    .insert({
      program_id: input.programId,
      phase_key: input.phaseKey.trim(),
      name: input.name,
      position: nextPosition,
      duration_weeks_min: input.durationWeeksMin,
      duration_weeks_max: input.durationWeeksMax,
      is_optional: input.isOptional,
      notes: input.notes,
      explainer: input.explainer,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/coaching/programs/${input.programId}`);
  return { id: data.id };
}

export async function reorderPhaseDefinitions(programId: string, orderedIds: string[]): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("program_phase_definitions")
      .update({ position: index + 1 })
      .eq("id", id)
      .eq("program_id", programId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/coaching/programs/${programId}`);
  return {};
}

export async function deletePhaseDefinition(phaseDefinitionId: string, programId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  // Cascades program_days/_steps/_extras/program_phase_weeks and
  // program_variant_phases rows referencing this phase (all FK on delete
  // cascade) -- the UI warns first if the phase is used by any variant
  // (see the Programs editor), this action itself doesn't re-check.
  const { error } = await supabase.from("program_phase_definitions").delete().eq("id", phaseDefinitionId);
  if (error) return { error: error.message };

  revalidatePath(`/coaching/programs/${programId}`);
  return {};
}

export type DurationVariantInput = {
  id?: string;
  programId: string;
  name: string;
  isDefault: boolean;
};

export async function saveDurationVariant(input: DurationVariantInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.name.trim()) return { error: "Give this plan length a name." };

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase
      .from("program_duration_variants")
      .update({ name: input.name.trim(), is_default: input.isDefault })
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath(`/coaching/programs/${input.programId}`);
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("program_duration_variants")
    .insert({ program_id: input.programId, name: input.name.trim(), is_default: input.isDefault })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/coaching/programs/${input.programId}`);
  return { id: data.id };
}

export async function deleteDurationVariant(variantId: string, programId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  // Cascades program_variant_phases rows only -- never the underlying
  // program_phase_definitions/program_days, which may be shared with
  // other variants (the whole point of the join table).
  const { error } = await supabase.from("program_duration_variants").delete().eq("id", variantId);
  if (error) return { error: error.message };

  revalidatePath(`/coaching/programs/${programId}`);
  return {};
}

// Delete-then-reinsert, mirroring saveTemplate's own steps/extras pattern.
// Validates every phaseDefinitionId actually belongs to this program --
// the one cross-table invariant a DB CHECK can't express (a variant and a
// phase definition each only carry their OWN parent program_id; nothing
// stops a caller from naming a phase definition that belongs to a
// different program entirely without this explicit check).
export async function setVariantPhases(
  variantId: string,
  programId: string,
  phaseDefinitionIds: string[],
): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();

  const { data: ownPhases, error: phasesError } = await supabase
    .from("program_phase_definitions")
    .select("id")
    .eq("program_id", programId);
  if (phasesError) return { error: phasesError.message };
  const ownPhaseIds = new Set((ownPhases ?? []).map((p) => p.id));
  if (phaseDefinitionIds.some((id) => !ownPhaseIds.has(id))) {
    return { error: "One of the selected phases doesn't belong to this program." };
  }

  const { error: deleteError } = await supabase.from("program_variant_phases").delete().eq("variant_id", variantId);
  if (deleteError) return { error: deleteError.message };

  if (phaseDefinitionIds.length > 0) {
    const { error: insertError } = await supabase.from("program_variant_phases").insert(
      phaseDefinitionIds.map((phaseDefinitionId, index) => ({
        variant_id: variantId,
        phase_definition_id: phaseDefinitionId,
        position: index + 1,
      })),
    );
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/coaching/programs/${programId}`);
  return {};
}

export type ProgramDayInput = {
  id?: string;
  programId: string;
  phaseDefinitionId: string;
  weekNumber: number;
  dayOfWeek: number;
  dayLabel: string | null;
  sessionSlot: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  paceReference: PaceReferenceKey | null;
  pacePercentBasis: PaceReferenceKey | null;
  pacePercentMin: number | null;
  pacePercentMax: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  isEventDay: boolean;
  notes: string | null;
  steps: StepInput[];
  extras: WorkoutExtraInput[];
};

export async function saveProgramDay(input: ProgramDayInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const distanceCheck = validateDistanceRange(input.plannedDistanceM, input.plannedDistanceMaxM);
  if (!distanceCheck.valid) return { error: distanceCheck.error };
  const durationCheck = validateDurationRange(input.plannedDurationS, input.plannedDurationMaxS);
  if (!durationCheck.valid) return { error: durationCheck.error };
  const paceCheck = validatePaceRange(input.plannedPaceSPerMi, input.plannedPaceMaxSPerMi);
  if (!paceCheck.valid) return { error: paceCheck.error };
  const hrCheck = validateHrRange(input.plannedHrBpm, input.plannedHrMaxBpm);
  if (!hrCheck.valid) return { error: hrCheck.error };
  const rpeCheck = validateRpeRange(input.plannedRpe, input.plannedRpeMax);
  if (!rpeCheck.valid) return { error: rpeCheck.error };
  const pacePercentCheck = validatePacePercentRange(input.pacePercentMin, input.pacePercentMax);
  if (!pacePercentCheck.valid) return { error: pacePercentCheck.error };
  if ((input.pacePercentMin != null) && input.pacePercentBasis == null) {
    return { error: "Choose a reference pace for this percent range." };
  }

  for (const step of input.steps) {
    const stepPercentCheck = validatePacePercentRange(step.targetPacePercentMin ?? null, step.targetPacePercentMax ?? null);
    if (!stepPercentCheck.valid) return { error: stepPercentCheck.error };
    if ((step.targetPacePercentMin ?? null) != null && step.targetPacePercentBasis == null) {
      return { error: "Choose a reference pace for this step's percent range." };
    }
  }

  const supabase = await createClient();

  // At most one day per program may be marked is_event_day (enforced by a
  // partial unique index, 20260925020000) -- checked here first for a real
  // error message rather than a raw constraint-violation string.
  if (input.isEventDay) {
    const { data: existingEventDay } = await supabase
      .from("program_days")
      .select("id")
      .eq("program_id", input.programId)
      .eq("is_event_day", true)
      .neq("id", input.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (existingEventDay) {
      return { error: "Another day in this program is already marked as race day -- unmark it first." };
    }
  }

  const dayFields = {
    week_number: input.weekNumber,
    day_of_week: input.dayOfWeek,
    day_label: input.dayLabel,
    session_slot: input.sessionSlot,
    planned_distance_m: input.plannedDistanceM,
    planned_distance_max_m: input.plannedDistanceMaxM,
    planned_duration_s: input.plannedDurationS,
    planned_duration_max_s: input.plannedDurationMaxS,
    planned_pace_s_per_mi: input.plannedPaceSPerMi,
    planned_pace_max_s_per_mi: input.plannedPaceMaxSPerMi,
    pace_reference: input.paceReference,
    pace_percent_basis: input.pacePercentBasis,
    pace_percent_min: input.pacePercentMin,
    pace_percent_max: input.pacePercentMax,
    planned_hr_bpm: input.plannedHrBpm,
    planned_hr_max_bpm: input.plannedHrMaxBpm,
    planned_rpe: input.plannedRpe,
    planned_rpe_max: input.plannedRpeMax,
    is_event_day: input.isEventDay,
    notes: input.notes,
  };

  let dayId = input.id;
  if (dayId) {
    const { error } = await supabase
      .from("program_days")
      .update({ ...dayFields, updated_at: new Date().toISOString() })
      .eq("id", dayId);
    if (error) return { error: error.message };

    const { error: deleteStepsError } = await supabase.from("program_day_steps").delete().eq("program_day_id", dayId);
    if (deleteStepsError) return { error: deleteStepsError.message };
    const { error: deleteExtrasError } = await supabase.from("program_day_extras").delete().eq("program_day_id", dayId);
    if (deleteExtrasError) return { error: deleteExtrasError.message };
  } else {
    const { data, error } = await supabase
      .from("program_days")
      .insert({ program_id: input.programId, phase_definition_id: input.phaseDefinitionId, ...dayFields })
      .select("id")
      .single();
    if (error) return { error: error.message };
    dayId = data.id;
  }
  if (!dayId) return { error: "Something went wrong saving this day." };

  if (input.steps.length > 0) {
    // Routed through the shared IntensityTarget contract (coaching-
    // platform-audit/05 §1.1), same as schedule/actions.ts's and
    // templates/actions.ts's step inserts -- see intensity-target.ts's
    // module comment. D2 (coaching-platform-audit/01 §5.2):
    // repetitions_max/rest_max_s exist on program_day_steps but were
    // previously never written here.
    const { error: stepsError } = await supabase.from("program_day_steps").insert(
      input.steps.map((step, index) => ({
        program_day_id: dayId,
        step_order: index,
        step_type: step.stepType,
        ...intensityTargetsToStepRow(stepInputToIntensityTargets(step)),
        repetitions: step.repetitions,
        repetitions_max: step.repetitionsMax,
        rest_s: step.restS,
        rest_max_s: step.restMaxS,
        instructions: step.instructions,
      })),
    );
    if (stepsError) return { error: stepsError.message };
  }

  if (input.extras.length > 0) {
    const { error: extrasError } = await supabase.from("program_day_extras").insert(
      input.extras.map((extra, index) => ({
        program_day_id: dayId,
        extra_order: index,
        kind: extra.kind,
        overview: extra.overview,
        count: extra.count,
        distance_m: extra.distanceM,
        duration_s: extra.durationS,
        items: extra.items,
      })),
    );
    if (extrasError) return { error: extrasError.message };
  }

  revalidatePath(`/coaching/programs/${input.programId}/phases/${input.phaseDefinitionId}`);
  return { id: dayId };
}

export async function deleteProgramDay(programDayId: string, programId: string, phaseDefinitionId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("program_days").delete().eq("id", programDayId);
  if (error) return { error: error.message };

  revalidatePath(`/coaching/programs/${programId}/phases/${phaseDefinitionId}`);
  return {};
}

export type ProgramPhaseWeekLabelInput = {
  programId: string;
  phaseDefinitionId: string;
  weekNumber: number;
  // The short tag shown inline next to a week's date on the athlete-facing
  // roadmap, and mirrored into training_week_plans.label at assignment
  // time -- see assign_program_generation.
  label: string | null;
  // A genuinely longer week-level narrative note (the week's own coaching
  // commentary/purpose, distinct from any one day's prescription) --
  // authoring/reference content that also flows into every already-
  // assigned athlete's own training_week_plans.notes for this
  // (phaseDefinitionId, weekNumber), both at assignment time
  // (assign_program_generation/resync_program_phase_generation) and, via
  // this action's own backfill below, on every later edit here too --
  // unlike label, which still only ever reaches an athlete at assignment
  // time. See the program_phase_weeks_notes and training_week_plans_
  // notes/notes_custom migrations.
  notes: string | null;
};

// Upsert-by-natural-key (phase_definition_id, week_number) -- a week either
// has a label/notes or it doesn't; there's no reason to track a separate
// row id on the client just to know whether to insert or update. The row
// itself is only deleted once BOTH label and notes are empty.
export async function saveProgramPhaseWeekLabel(input: ProgramPhaseWeekLabelInput): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();

  const label = input.label?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (!label && !notes) {
    const { error } = await supabase
      .from("program_phase_weeks")
      .delete()
      .eq("phase_definition_id", input.phaseDefinitionId)
      .eq("week_number", input.weekNumber);
    if (error) return { error: error.message };
    await propagateWeekNotesToAssignedAthletes(supabase, session.userId, input.phaseDefinitionId, input.weekNumber, null);
    revalidatePath(`/coaching/programs/${input.programId}/phases/${input.phaseDefinitionId}`);
    return {};
  }

  const { error } = await supabase.from("program_phase_weeks").upsert(
    {
      program_id: input.programId,
      phase_definition_id: input.phaseDefinitionId,
      week_number: input.weekNumber,
      label,
      notes,
    },
    { onConflict: "phase_definition_id,week_number" },
  );
  if (error) return { error: error.message };

  await propagateWeekNotesToAssignedAthletes(supabase, session.userId, input.phaseDefinitionId, input.weekNumber, notes);

  revalidatePath(`/coaching/programs/${input.programId}/phases/${input.phaseDefinitionId}`);
  return {};
}

type AssignedPhaseRow = { athlete_id: string; start_date: string; end_date: string };

// Pushes a framework week-note edit straight into every already-assigned
// athlete's training_week_plans.notes for this (phaseDefinitionId,
// weekNumber) -- the "assignment snapshot" from assign_program_generation/
// resync_program_phase_generation otherwise only ever reflects the
// framework note as it stood at assignment time (see this file's own
// ProgramPhaseWeekLabelInput.notes comment). Skips any athlete week a
// coach has deliberately customized directly (WeekPlanEditor/
// WeekPlanQuickEditModal, schedule/actions.ts's saveWeekPlan, which sets
// notes_is_custom) -- a framework-wide edit must never silently clobber
// that. A week whose computed date falls outside the athlete's own phase
// range (the phase was assigned with fewer weeks than this program
// definition has) is skipped, same bound program-generation.ts's own
// emptyWeeks check uses at generation time.
async function propagateWeekNotesToAssignedAthletes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  phaseDefinitionId: string,
  weekNumber: number,
  notes: string | null,
): Promise<void> {
  const { data: phaseRows } = await supabase
    .from("training_phases")
    .select("athlete_id, start_date, end_date")
    .eq("coach_id", coachId)
    .eq("source_program_phase_definition_id", phaseDefinitionId)
    .returns<AssignedPhaseRow[]>();

  for (const phase of phaseRows ?? []) {
    const weekStart = addDays(phase.start_date, (weekNumber - 1) * 7);
    if (weekStart > phase.end_date) continue;

    const { data: existing } = await supabase
      .from("training_week_plans")
      .select("notes_is_custom")
      .eq("athlete_id", phase.athlete_id)
      .eq("week_start", weekStart)
      .maybeSingle<{ notes_is_custom: boolean }>();

    if (existing) {
      if (existing.notes_is_custom) continue;
      await supabase
        .from("training_week_plans")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("athlete_id", phase.athlete_id)
        .eq("week_start", weekStart);
    } else if (notes) {
      await supabase.from("training_week_plans").insert({
        athlete_id: phase.athlete_id,
        coach_id: coachId,
        week_start: weekStart,
        notes,
      });
    }
  }
}
