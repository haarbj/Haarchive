"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";
import { todayForViewer } from "@/lib/viewer-timezone";
import {
  resolveProgramGeneration,
  type GenerateProgramAnchor,
  type GeneratePhaseSelection,
  type ProgramDayContent,
  type ProgramPhaseDefinition,
  type ProgramPhaseWeekLabel,
  type ProgramPhaseWeekVolume,
  type ResolvedProgramGeneration,
} from "@/lib/private-coaching/program-generation";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import {
  proposePhaseLayout,
  weeksAvailableBetween,
  type PhaseLayoutProposal,
  type PlannablePhase,
} from "@/lib/private-coaching/race-anchored-planning";
import { mondaysInRange } from "@/lib/private-coaching/training-phases";
import { MILE_METERS } from "@/lib/race-distances";
import { mostRecentMonday } from "@/lib/week";
import {
  scheduleStrengthTraining,
  type AppliedStrengthOption,
  type StrengthGatingInput,
  type StrengthSelections,
} from "@/lib/private-coaching/strength-scheduling";

export type AssignProgramInput = {
  programId: string;
  variantId: string;
  /**
   * The peak-volume variant the coach chose (program_volume_variants.id),
   * which supplies every week's authored goal mileage. Null only for a
   * program that has no volume variants at all -- if a program defines
   * them, assignment fails rather than quietly generating a plan with no
   * weekly targets, since picking the level is exactly the judgment the
   * mileage-match check exists to inform.
   */
  volumeVariantId: string | null;
  athleteId: string;
  phaseSelections: GeneratePhaseSelection[];
  anchor: GenerateProgramAnchor;
  targetPeakWeeklyMiles: number | null;
  targetPeakWeeklyDurationS: number | null;
  /** Item 30's foundation + three performance options -- see strength-scheduling.ts. */
  strengthSelections: StrengthSelections;
  strengthGating: StrengthGatingInput;
};

// Which PaceReferenceKey values this Program's variant actually uses as a
// pace_percent_basis (day- or step-level) -- purely informational (see
// assign-program-form.tsx: "this program needs a 5K and marathon estimate
// from the athlete"). This platform never lets a coach enter or edit an
// athlete's own fitness estimate on their behalf -- same "the athlete owns
// and edits their own onboarding-style data" boundary race_results/
// injuries/athlete_profiles already draw (see the private-coaching
// existing-table-access migration's own comment) -- so nothing here
// collects a time; it only tells the coach which distances matter for this
// program so they know what to ask the athlete to set in their own
// settings.
export async function loadUsedPaceReferenceBases(programId: string, variantId: string): Promise<{ error?: string; bases?: PaceReferenceKey[] }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: program } = await supabase.from("training_programs").select("id").eq("id", programId).maybeSingle();
  if (!program) return { error: "Program not found." };

  const { data: variantPhaseRows } = await supabase
    .from("program_variant_phases")
    .select("phase_definition_id")
    .eq("variant_id", variantId)
    .returns<{ phase_definition_id: string }[]>();
  const phaseDefinitionIds = (variantPhaseRows ?? []).map((r) => r.phase_definition_id);
  if (phaseDefinitionIds.length === 0) return { bases: [] };

  const { data: dayRows } = await supabase
    .from("program_days")
    .select("id, pace_percent_basis")
    .in("phase_definition_id", phaseDefinitionIds)
    .returns<{ id: string; pace_percent_basis: PaceReferenceKey | null }[]>();
  const dayIds = (dayRows ?? []).map((d) => d.id);

  const { data: stepRows } = dayIds.length
    ? await supabase
        .from("program_day_steps")
        .select("target_pace_percent_basis")
        .in("program_day_id", dayIds)
        .returns<{ target_pace_percent_basis: PaceReferenceKey | null }[]>()
    : { data: [] as { target_pace_percent_basis: PaceReferenceKey | null }[] };

  const bases = new Set<PaceReferenceKey>();
  for (const row of dayRows ?? []) if (row.pace_percent_basis) bases.add(row.pace_percent_basis);
  for (const row of stepRows ?? []) if (row.target_pace_percent_basis) bases.add(row.target_pace_percent_basis);

  return { bases: [...bases] };
}

/**
 * Part A item 1: propose a phase layout working backwards from race day.
 *
 * ADVISORY ONLY. This writes nothing and generates nothing -- it returns
 * week counts and the reasoning behind them, which the assign form drops
 * into the same inputs the coach was going to fill in by hand. They can
 * change any of it before previewing, and nothing happens until they do.
 *
 * Peak mileage comes from the coach's own choice for this assignment (the
 * selected volume variant, or the target peak they typed), never from the
 * athlete's current mileage: the layout is being planned for the volume
 * this buildup is aiming at. Experience comes from the athlete's own
 * profile, which the coach can read but not edit.
 */
export async function proposePhaseLayoutFromRaceDay(input: {
  programId: string;
  variantId: string;
  athleteId: string;
  raceDate: string;
  /** Defaults to today when the coach has not picked a start date. */
  startDate: string | null;
  peakMileage: number | null;
}): Promise<{ error?: string; proposal?: PhaseLayoutProposal; weeksAvailable?: number; spareDays?: number }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const { data: variantPhaseRows } = await supabase
    .from("program_variant_phases")
    .select("position, program_phase_definitions(id, phase_key, duration_weeks_min, duration_weeks_max, is_optional)")
    .eq("variant_id", input.variantId)
    .order("position", { ascending: true })
    .returns<
      {
        position: number;
        program_phase_definitions: {
          id: string;
          phase_key: string;
          duration_weeks_min: number;
          duration_weeks_max: number;
          is_optional: boolean;
        } | null;
      }[]
    >();
  const phases: PlannablePhase[] = (variantPhaseRows ?? [])
    .map((row) => row.program_phase_definitions)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({
      phaseDefinitionId: p.id,
      phaseKey: p.phase_key,
      durationWeeksMin: p.duration_weeks_min,
      durationWeeksMax: p.duration_weeks_max,
      isOptional: p.is_optional,
    }));
  if (phases.length === 0) return { error: "This plan length has no phases configured." };

  // Peak mileage: the coach's choice for this assignment, falling back to
  // the program's own range when they have not chosen one yet.
  let peakMileage = input.peakMileage;
  if (peakMileage == null) {
    const { data: program } = await supabase
      .from("training_programs")
      .select("peak_mileage_min, peak_mileage_max")
      .eq("id", input.programId)
      .maybeSingle<{ peak_mileage_min: number | null; peak_mileage_max: number | null }>();
    peakMileage = program?.peak_mileage_max ?? program?.peak_mileage_min ?? null;
  }
  if (peakMileage == null) {
    return { error: "Choose a peak weekly volume, or set one on the program, before laying phases out from race day." };
  }

  // years_running is the athlete's own profile data -- readable by their
  // coach, never editable by them (see the existing-table-access
  // migration). Absent is a real answer: the proposal then goes on mileage
  // alone rather than assuming a background.
  const { data: profile } = await supabase
    .from("athlete_profiles")
    .select("years_running")
    .eq("user_id", input.athleteId)
    .maybeSingle<{ years_running: number | null }>();

  const start = input.startDate ?? (await todayForViewer());
  const { weeks, spareDays } = weeksAvailableBetween(start, input.raceDate);
  if (weeks === 0) {
    return { error: "That race date is less than a week away, so there is nothing to lay out." };
  }

  return {
    proposal: proposePhaseLayout({
      phases,
      weeksAvailable: weeks,
      peakMileage,
      experienceYears: profile?.years_running ?? null,
    }),
    weeksAvailable: weeks,
    spareDays,
  };
}

type LoadResult = { error: string } | { generation: GenerateProgramGeneration; appliedStrengthOptions: AppliedStrengthOption[] };
type GenerateProgramGeneration = ResolvedProgramGeneration;

/**
 * The selected peak-volume variant's authored goal mileage, one row per
 * phase week. Returns an error (never an empty list) when the program
 * defines volume variants but none was chosen, or when the chosen one
 * doesn't belong to this program -- silently assigning a framework with no
 * weekly targets would look like it worked and leave every week blank.
 */
async function loadWeekVolumes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: AssignProgramInput,
  phaseDefinitionIds: string[],
): Promise<{ error: string } | { weekVolumes: ProgramPhaseWeekVolume[] }> {
  const { data: variantRows } = await supabase
    .from("program_volume_variants")
    .select("id")
    .eq("program_id", input.programId)
    .returns<{ id: string }[]>();
  const available = variantRows ?? [];

  if (available.length === 0) {
    // A hand-authored program with no volume variants -- week totals keep
    // being derived from its own authored day distances.
    if (input.volumeVariantId) return { error: "This program has no peak-volume options to choose from." };
    return { weekVolumes: [] };
  }

  if (!input.volumeVariantId) return { error: "Choose a peak weekly volume for this program before assigning it." };
  if (!available.some((v) => v.id === input.volumeVariantId)) {
    return { error: "That peak weekly volume doesn't belong to this program." };
  }

  const { data: volumeRows } = await supabase
    .from("program_phase_week_volumes")
    .select("phase_definition_id, week_number, goal_mileage_min, goal_mileage_max")
    .eq("volume_variant_id", input.volumeVariantId)
    .in("phase_definition_id", phaseDefinitionIds)
    .returns<{ phase_definition_id: string; week_number: number; goal_mileage_min: number | null; goal_mileage_max: number | null }[]>();

  return {
    weekVolumes: (volumeRows ?? []).map((v) => ({
      phaseDefinitionId: v.phase_definition_id,
      weekNumber: v.week_number,
      goalMileageMin: v.goal_mileage_min,
      goalMileageMax: v.goal_mileage_max,
    })),
  };
}

async function loadResolvedGeneration(input: AssignProgramInput): Promise<LoadResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", input.athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const { data: program } = await supabase
    .from("training_programs")
    .select("id, scales_distance_with_mileage, scales_duration_with_mileage")
    .eq("id", input.programId)
    .maybeSingle<{ id: string; scales_distance_with_mileage: boolean; scales_duration_with_mileage: boolean }>();
  if (!program) return { error: "Program not found." };

  const { data: variantPhaseRows } = await supabase
    .from("program_variant_phases")
    .select("position, program_phase_definitions(id, phase_key, name, duration_weeks_min, duration_weeks_max, is_optional, explainer)")
    .eq("variant_id", input.variantId)
    .order("position", { ascending: true })
    .returns<
      {
        position: number;
        program_phase_definitions: {
          id: string;
          phase_key: string;
          name: string | null;
          duration_weeks_min: number;
          duration_weeks_max: number;
          is_optional: boolean;
          explainer: string | null;
        } | null;
      }[]
    >();
  const variantPhases: ProgramPhaseDefinition[] = (variantPhaseRows ?? [])
    .map((row) => row.program_phase_definitions)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({
      id: p.id,
      phaseKey: p.phase_key,
      name: p.name,
      durationWeeksMin: p.duration_weeks_min,
      durationWeeksMax: p.duration_weeks_max,
      isOptional: p.is_optional,
      explainer: p.explainer,
    }));
  if (variantPhases.length === 0) return { error: "This plan length has no phases configured." };

  const phaseDefinitionIds = variantPhases.map((p) => p.id);

  const { data: dayRows } = await supabase
    .from("program_days")
    .select(
      "id, phase_definition_id, week_number, day_of_week, day_label, session_slot, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max, is_event_day, is_optional, alternative_text, notes, program_day_steps(*), program_day_extras(*)",
    )
    .in("phase_definition_id", phaseDefinitionIds)
    .returns<ProgramDayRow[]>();

  const days: ProgramDayContent[] = (dayRows ?? []).map(toProgramDayContent);

  const { data: weekLabelRows } = await supabase
    .from("program_phase_weeks")
    .select("phase_definition_id, week_number, label, notes")
    .in("phase_definition_id", phaseDefinitionIds)
    .returns<{ phase_definition_id: string; week_number: number; label: string | null; notes: string | null }[]>();
  const weekLabels: ProgramPhaseWeekLabel[] = (weekLabelRows ?? [])
    .filter((w) => w.label != null || w.notes != null)
    .map((w) => ({ phaseDefinitionId: w.phase_definition_id, weekNumber: w.week_number, label: w.label, notes: w.notes }));

  const volumeResult = await loadWeekVolumes(supabase, input, phaseDefinitionIds);
  if ("error" in volumeResult) return { error: volumeResult.error };

  const generationResult = resolveProgramGeneration({
    variantPhases,
    phaseSelections: input.phaseSelections,
    days,
    weekLabels,
    weekVolumes: volumeResult.weekVolumes,
    scalesDistanceWithMileage: program.scales_distance_with_mileage,
    scalesDurationWithMileage: program.scales_duration_with_mileage,
    targetPeakWeeklyMiles: input.targetPeakWeeklyMiles,
    targetPeakWeeklyDurationS: input.targetPeakWeeklyDurationS,
    anchor: input.anchor,
  });

  if ("error" in generationResult) return { error: generationResult.error };

  // Strength training placement happens here, after the generation
  // itself resolves, rather than inside resolveProgramGeneration --
  // program-generation.ts stays methodology-agnostic (its own header
  // comment says so explicitly), and this feature is specifically Item
  // 30's framework, not something every Program needs to know about.
  const { days: daysWithStrength, appliedOptions } = scheduleStrengthTraining(
    generationResult.result.days,
    generationResult.result.phases,
    input.strengthSelections,
    input.strengthGating,
  );

  return {
    generation: { ...generationResult.result, days: daysWithStrength },
    appliedStrengthOptions: appliedOptions,
  };
}

type ProgramDayRow = {
  id: string;
  phase_definition_id: string;
  week_number: number;
  day_of_week: number;
  day_label: string | null;
  session_slot: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: ProgramDayContent["paceReference"];
  pace_percent_basis: ProgramDayContent["pacePercentBasis"];
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  is_event_day: boolean;
  is_optional: boolean;
  alternative_text: string | null;
  notes: string | null;
  program_day_steps: {
    step_order: number;
    step_type: ProgramDayContent["steps"][number]["stepType"];
    duration_s: number | null;
    duration_max_s: number | null;
    distance_m: number | null;
    distance_max_m: number | null;
    target_type: ProgramDayContent["steps"][number]["targetType"];
    target_min: number | null;
    target_max: number | null;
    target_unit: string | null;
    target_pace_reference: ProgramDayContent["steps"][number]["targetPaceReference"];
    target_pace_percent_basis: ProgramDayContent["steps"][number]["targetPacePercentBasis"];
    target_pace_percent_min: number | null;
    target_pace_percent_max: number | null;
    repetitions: number | null;
    repetitions_max: number | null;
    rest_s: number | null;
    rest_max_s: number | null;
    instructions: string | null;
  }[];
  program_day_extras: {
    extra_order: number;
    kind: string;
    overview: string | null;
    count: number | null;
    distance_m: number | null;
    duration_s: number | null;
    items: string[] | null;
  }[];
};

function toProgramDayContent(row: ProgramDayRow): ProgramDayContent {
  return {
    id: row.id,
    phaseDefinitionId: row.phase_definition_id,
    weekNumber: row.week_number,
    dayOfWeek: row.day_of_week,
    dayLabel: row.day_label,
    sessionSlot: row.session_slot,
    plannedDistanceM: row.planned_distance_m,
    plannedDistanceMaxM: row.planned_distance_max_m,
    plannedDurationS: row.planned_duration_s,
    plannedDurationMaxS: row.planned_duration_max_s,
    plannedPaceSPerMi: row.planned_pace_s_per_mi,
    plannedPaceMaxSPerMi: row.planned_pace_max_s_per_mi,
    paceReference: row.pace_reference,
    pacePercentBasis: row.pace_percent_basis,
    pacePercentMin: row.pace_percent_min,
    pacePercentMax: row.pace_percent_max,
    plannedHrBpm: row.planned_hr_bpm,
    plannedHrMaxBpm: row.planned_hr_max_bpm,
    plannedRpe: row.planned_rpe,
    plannedRpeMax: row.planned_rpe_max,
    isEventDay: row.is_event_day,
    isOptional: row.is_optional,
    alternativeText: row.alternative_text,
    notes: row.notes,
    steps: (row.program_day_steps ?? [])
      .slice()
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => ({
        stepOrder: s.step_order,
        stepType: s.step_type,
        durationS: s.duration_s,
        durationMaxS: s.duration_max_s,
        distanceM: s.distance_m,
        distanceMaxM: s.distance_max_m,
        targetType: s.target_type,
        targetMin: s.target_min,
        targetMax: s.target_max,
        targetUnit: s.target_unit,
        targetPaceReference: s.target_pace_reference,
        targetPacePercentBasis: s.target_pace_percent_basis,
        targetPacePercentMin: s.target_pace_percent_min,
        targetPacePercentMax: s.target_pace_percent_max,
        repetitions: s.repetitions,
        repetitionsMax: s.repetitions_max,
        restS: s.rest_s,
        restMaxS: s.rest_max_s,
        instructions: s.instructions,
      })),
    extras: (row.program_day_extras ?? [])
      .slice()
      .sort((a, b) => a.extra_order - b.extra_order)
      .map((e) => ({
        extraOrder: e.extra_order,
        kind: e.kind,
        overview: e.overview,
        count: e.count,
        distanceM: e.distance_m,
        durationS: e.duration_s,
        items: e.items ?? [],
      })),
  };
}

export type OverlappingPhase = {
  id: string;
  phaseType: string;
  name: string | null;
  startDate: string;
  endDate: string;
  workoutCount: number;
  weekPlanCount: number;
};

// Every existing training_phases row for this athlete whose own date
// range intersects any of `phases`' resolved spans -- what
// assign_program_generation's own overlap check (the "This date range
// overlaps an existing training phase" abort) is really testing for,
// surfaced here ahead of time so the preview can show the coach exactly
// what "clear the overlapping block and assign" would remove before they
// commit to it. Counts mirror clearPhaseTraining's own scoping (every
// scheduled_workouts/training_week_plans row inside that phase's own
// start/end range, not just rows the Program itself would have touched).
async function findOverlappingPhases(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  phases: ResolvedProgramGeneration["phases"],
): Promise<OverlappingPhase[]> {
  const { data: existingPhases } = await supabase
    .from("training_phases")
    .select("id, phase_type, name, start_date, end_date")
    .eq("athlete_id", athleteId)
    .returns<{ id: string; phase_type: string; name: string | null; start_date: string; end_date: string }[]>();

  const overlapping = (existingPhases ?? []).filter((existing) =>
    phases.some((p) => p.startDate <= existing.end_date && p.endDate >= existing.start_date),
  );
  if (overlapping.length === 0) return [];

  const results: OverlappingPhase[] = [];
  for (const phase of overlapping) {
    const { count: workoutCount } = await supabase
      .from("scheduled_workouts")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .gte("scheduled_date", phase.start_date)
      .lte("scheduled_date", phase.end_date);
    const weeks = mondaysInRange(phase.start_date, phase.end_date);
    const { count: weekPlanCount } = weeks.length
      ? await supabase
          .from("training_week_plans")
          .select("id", { count: "exact", head: true })
          .eq("athlete_id", athleteId)
          .in("week_start", weeks)
      : { count: 0 };
    results.push({
      id: phase.id,
      phaseType: phase.phase_type,
      name: phase.name,
      startDate: phase.start_date,
      endDate: phase.end_date,
      workoutCount: workoutCount ?? 0,
      weekPlanCount: weekPlanCount ?? 0,
    });
  }
  return results;
}

export async function previewProgramAssignment(
  input: AssignProgramInput,
): Promise<{
  error?: string;
  result?: ResolvedProgramGeneration;
  overlappingPhases?: OverlappingPhase[];
  appliedStrengthOptions?: AppliedStrengthOption[];
}> {
  const loaded = await loadResolvedGeneration(input);
  if ("error" in loaded) return { error: loaded.error };

  const supabase = await createClient();
  const overlappingPhases = await findOverlappingPhases(supabase, input.athleteId, loaded.generation.phases);
  return { result: loaded.generation, overlappingPhases, appliedStrengthOptions: loaded.appliedStrengthOptions };
}

export type AssignProgramResult = {
  error?: string;
  phasesCreated?: number;
  workoutsCreated?: number;
  skippedDates?: string[];
  clearedWorkouts?: number;
  clearedWeekPlans?: number;
  clearedPhases?: number;
  appliedStrengthOptions?: AppliedStrengthOption[];
};

export async function assignProgramToAthlete(
  input: AssignProgramInput & { confirmedWarnings: boolean; clearOverlapping?: boolean },
): Promise<AssignProgramResult> {
  const loaded = await loadResolvedGeneration(input);
  if ("error" in loaded) return { error: loaded.error };
  const generation = loaded.generation;

  const hasWarnings =
    generation.warnings.emptyPhaseDefinitionIds.length > 0 ||
    generation.warnings.emptyWeeks.length > 0 ||
    generation.warnings.daysAfterEventDate.length > 0 ||
    generation.warnings.outOfRangeDays.length > 0;
  if (hasWarnings && !input.confirmedWarnings) {
    const categories = [
      generation.warnings.emptyPhaseDefinitionIds.length > 0 && "empty phases",
      generation.warnings.emptyWeeks.length > 0 && "empty weeks",
      generation.warnings.daysAfterEventDate.length > 0 && "workouts scheduled after your event date",
      generation.warnings.outOfRangeDays.length > 0 && "authored content outside the selected phase lengths",
    ].filter(Boolean);
    return { error: `This program has ${categories.join(", ")}. Confirm you want to assign it as-is.` };
  }

  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const supabase = await createClient();

  if (!input.clearOverlapping) {
    const overlappingPhases = await findOverlappingPhases(supabase, input.athleteId, generation.phases);
    if (overlappingPhases.length > 0) {
      return {
        error:
          "This date range overlaps an existing training phase for this athlete. Preview again and choose \"Clear the overlapping block and assign\" to replace it.",
      };
    }
  }

  const { data, error } = await supabase.rpc("assign_program_generation", {
    p_program_id: input.programId,
    p_variant_id: input.variantId,
    p_athlete_id: input.athleteId,
    p_clear_overlapping: input.clearOverlapping ?? false,
    p_phases: generation.phases.map((p) => ({
      phaseDefinitionId: p.phaseDefinitionId,
      phaseKey: p.phaseKey,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      // Copied onto the athlete's own phase row here and never read from
      // the Program again, which is what makes their explanation survive
      // a later edit or deletion of the Program it came from.
      explainer: p.explainer,
      // Recorded as provenance so a later resync keeps this athlete on the
      // same peak-volume level instead of re-deciding it. Null for a
      // program with no volume variants.
      volumeVariantId: input.volumeVariantId,
    })),
    p_days: generation.days.map((d) => ({
      sourceProgramDayId: d.sourceProgramDayId,
      scheduledDate: d.scheduledDate,
      dayLabel: d.dayLabel,
      sessionSlot: d.sessionSlot,
      isOptional: d.isOptional,
      alternativeText: d.alternativeText,
      plannedDistanceM: d.plannedDistanceM,
      plannedDistanceMaxM: d.plannedDistanceMaxM,
      plannedDurationS: d.plannedDurationS,
      plannedDurationMaxS: d.plannedDurationMaxS,
      plannedPaceSPerMi: d.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: d.plannedPaceMaxSPerMi,
      paceReference: d.paceReference,
      // Previously omitted here entirely -- ProgramDayContent/ResolvedProgramDay
      // both carry these (read correctly from program_days above), but this
      // RPC payload never forwarded them, so every pace-percent-based day
      // (Canyon's own "90-92% MP" long runs, etc.) would silently lose its
      // pace target the moment a Program was assigned to an athlete, even
      // though the source program_days row had it set correctly.
      pacePercentBasis: d.pacePercentBasis,
      pacePercentMin: d.pacePercentMin,
      pacePercentMax: d.pacePercentMax,
      plannedHrBpm: d.plannedHrBpm,
      plannedHrMaxBpm: d.plannedHrMaxBpm,
      plannedRpe: d.plannedRpe,
      plannedRpeMax: d.plannedRpeMax,
      notes: d.notes,
      steps: d.steps.map((s) => ({
        stepOrder: s.stepOrder,
        stepType: s.stepType,
        durationS: s.durationS,
        durationMaxS: s.durationMaxS,
        distanceM: s.distanceM,
        distanceMaxM: s.distanceMaxM,
        targetType: s.targetType,
        targetMin: s.targetMin,
        targetMax: s.targetMax,
        targetUnit: s.targetUnit,
        targetPaceReference: s.targetPaceReference,
        // Same previously-missing forwarding as the day-level fields above.
        targetPacePercentBasis: s.targetPacePercentBasis,
        targetPacePercentMin: s.targetPacePercentMin,
        targetPacePercentMax: s.targetPacePercentMax,
        repetitions: s.repetitions,
        repetitionsMax: s.repetitionsMax,
        restS: s.restS,
        restMaxS: s.restMaxS,
        instructions: s.instructions,
      })),
      extras: d.extras.map((e) => ({
        extraOrder: e.extraOrder,
        kind: e.kind,
        overview: e.overview,
        count: e.count,
        distanceM: e.distanceM,
        durationS: e.durationS,
        items: e.items,
      })),
    })),
    p_weeks: generation.weeks.map((w) => ({ weekStart: w.weekStart, targetVolumeMin: w.targetVolumeMin, targetVolumeMax: w.targetVolumeMax, label: w.label, notes: w.notes })),
  });
  if (error) return { error: error.message };

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "program_assigned",
    entity_type: "training_programs",
    entity_id: input.programId,
    metadata: { athleteId: input.athleteId, variantId: input.variantId, ...data },
  });

  // One summary notification for the whole assignment, not one per workout --
  // the RPC above writes every scheduled_workouts row directly rather than
  // going through saveScheduledWorkout, so nothing else notifies the athlete
  // that a program landed on their calendar at all. Fired once here
  // regardless of how many days/weeks it created.
  const { data: program } = await supabase
    .from("training_programs")
    .select("name")
    .eq("id", input.programId)
    .maybeSingle<{ name: string }>();
  await createNotification({
    userId: input.athleteId,
    type: "program_assigned",
    content: program?.name
      ? `Your coach assigned "${program.name}" to your schedule`
      : "Your coach assigned a new training block to your schedule",
    relatedEntityId: input.athleteId,
  });

  revalidatePath(`/coaching/athletes/${input.athleteId}/schedule`);
  return {
    phasesCreated: data?.phasesCreated,
    workoutsCreated: data?.workoutsCreated,
    skippedDates: data?.skippedDates,
    clearedWorkouts: data?.clearedWorkouts,
    clearedWeekPlans: data?.clearedWeekPlans,
    clearedPhases: data?.clearedPhases,
    appliedStrengthOptions: loaded.appliedStrengthOptions,
  };
}

export type PhaseResyncPreview = {
  generation: ResolvedProgramGeneration;
  currentWorkoutCount: number;
  currentWeekPlanCount: number;
};

// Shared by previewPhaseResync and resyncPhaseFromProgram -- re-derives
// exactly what assigning this one phase fresh, today, from its own
// source Program would produce, scoped to the phase's own existing date
// range and week count (never re-anchored, never re-lengthened: a resync
// pulls in content/structure changes to the Program, not a different
// plan length). The target peak is read back from what's already
// assigned rather than asked for again -- same "never trust a client-
// computed number, recompute server-side" discipline as the rest of
// this file, and it means a resync preserves the athlete's current
// volume unless a coach deliberately rescales it afterward via
// rescalePhaseMileage.
async function loadPhaseResyncGeneration(
  phaseId: string,
  athleteId: string,
): Promise<{ error: string } | { phase: { startDate: string; endDate: string }; generation: ResolvedProgramGeneration }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const { data: phase } = await supabase
    .from("training_phases")
    .select("id, phase_type, name, start_date, end_date, source_program_id, source_program_phase_definition_id, source_program_duration_variant_id, source_program_volume_variant_id")
    .eq("id", phaseId)
    .eq("athlete_id", athleteId)
    .eq("coach_id", session.userId)
    .maybeSingle<{
      id: string;
      phase_type: string;
      name: string | null;
      start_date: string;
      end_date: string;
      source_program_id: string | null;
      source_program_phase_definition_id: string | null;
      source_program_duration_variant_id: string | null;
      source_program_volume_variant_id: string | null;
    }>();
  if (!phase) return { error: "Couldn't find that phase." };
  if (!phase.source_program_id || !phase.source_program_phase_definition_id) {
    return { error: "This phase wasn't generated from a Program, so it can't be resynced." };
  }

  const { data: program } = await supabase
    .from("training_programs")
    .select("id, scales_distance_with_mileage, scales_duration_with_mileage")
    .eq("id", phase.source_program_id)
    .maybeSingle<{ id: string; scales_distance_with_mileage: boolean; scales_duration_with_mileage: boolean }>();
  if (!program) return { error: "This phase's source Program no longer exists, so it can't be resynced." };

  const { data: phaseDefinition } = await supabase
    .from("program_phase_definitions")
    .select("id, phase_key, name, duration_weeks_min, duration_weeks_max, is_optional, explainer")
    .eq("id", phase.source_program_phase_definition_id)
    .maybeSingle<{
      id: string;
      phase_key: string;
      name: string | null;
      duration_weeks_min: number;
      duration_weeks_max: number;
      is_optional: boolean;
      explainer: string | null;
    }>();
  if (!phaseDefinition) return { error: "This phase's source Program phase no longer exists, so it can't be resynced." };

  const weekCount = mondaysInRange(phase.start_date, phase.end_date).length;

  const { data: dayRows } = await supabase
    .from("program_days")
    .select(
      "id, phase_definition_id, week_number, day_of_week, day_label, session_slot, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max, is_event_day, is_optional, alternative_text, notes, program_day_steps(*), program_day_extras(*)",
    )
    .eq("phase_definition_id", phaseDefinition.id)
    .returns<ProgramDayRow[]>();
  const days: ProgramDayContent[] = (dayRows ?? []).map(toProgramDayContent);

  const { data: weekLabelRows } = await supabase
    .from("program_phase_weeks")
    .select("phase_definition_id, week_number, label, notes")
    .eq("phase_definition_id", phaseDefinition.id)
    .returns<{ phase_definition_id: string; week_number: number; label: string | null; notes: string | null }[]>();
  const weekLabels: ProgramPhaseWeekLabel[] = (weekLabelRows ?? [])
    .filter((w) => w.label != null || w.notes != null)
    .map((w) => ({ phaseDefinitionId: w.phase_definition_id, weekNumber: w.week_number, label: w.label, notes: w.notes }));

  // A resync keeps the peak-volume level this phase was generated with --
  // it re-pulls the Program's current CONTENT, it doesn't re-decide which
  // volume variant the athlete is on. A phase generated before volume
  // variants existed has no variant recorded and keeps deriving its week
  // totals from authored day distances, exactly as it did originally.
  let weekVolumes: ProgramPhaseWeekVolume[] = [];
  if (phase.source_program_volume_variant_id) {
    const { data: volumeRows } = await supabase
      .from("program_phase_week_volumes")
      .select("phase_definition_id, week_number, goal_mileage_min, goal_mileage_max")
      .eq("volume_variant_id", phase.source_program_volume_variant_id)
      .eq("phase_definition_id", phaseDefinition.id)
      .returns<{ phase_definition_id: string; week_number: number; goal_mileage_min: number | null; goal_mileage_max: number | null }[]>();
    weekVolumes = (volumeRows ?? []).map((v) => ({
      phaseDefinitionId: v.phase_definition_id,
      weekNumber: v.week_number,
      goalMileageMin: v.goal_mileage_min,
      goalMileageMax: v.goal_mileage_max,
    }));
  }

  // Current actual peak, read back from what's already assigned (same
  // "recompute from real rows, never from a remembered input" discipline
  // rescalePhaseMileage's own header comment explains) -- a resync keeps
  // the athlete's existing volume, it doesn't ask the coach to re-enter it.
  let targetPeakWeeklyMiles: number | null = null;
  let targetPeakWeeklyDurationS: number | null = null;
  if (program.scales_distance_with_mileage || program.scales_duration_with_mileage) {
    const { data: existingWorkouts } = await supabase
      .from("scheduled_workouts")
      .select("scheduled_date, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s")
      .eq("athlete_id", athleteId)
      .gte("scheduled_date", phase.start_date)
      .lte("scheduled_date", phase.end_date)
      .returns<{
        scheduled_date: string;
        planned_distance_m: number | null;
        planned_distance_max_m: number | null;
        planned_duration_s: number | null;
        planned_duration_max_s: number | null;
      }[]>();

    const metersByWeek = new Map<string, number>();
    const secondsByWeek = new Map<string, number>();
    for (const row of existingWorkouts ?? []) {
      const weekStart = mostRecentMonday(new Date(`${row.scheduled_date}T00:00:00Z`));
      const meters = row.planned_distance_max_m ?? row.planned_distance_m;
      if (meters != null) metersByWeek.set(weekStart, (metersByWeek.get(weekStart) ?? 0) + meters);
      const seconds = row.planned_duration_max_s ?? row.planned_duration_s;
      if (seconds != null) secondsByWeek.set(weekStart, (secondsByWeek.get(weekStart) ?? 0) + seconds);
    }
    if (program.scales_distance_with_mileage && metersByWeek.size > 0) {
      targetPeakWeeklyMiles = Math.max(...metersByWeek.values()) / MILE_METERS;
    }
    if (program.scales_duration_with_mileage && secondsByWeek.size > 0) {
      targetPeakWeeklyDurationS = Math.max(...secondsByWeek.values());
    }
  }

  const generationResult = resolveProgramGeneration({
    variantPhases: [
      {
        id: phaseDefinition.id,
        phaseKey: phaseDefinition.phase_key,
        name: phaseDefinition.name,
        durationWeeksMin: phaseDefinition.duration_weeks_min,
        durationWeeksMax: phaseDefinition.duration_weeks_max,
        isOptional: false,
        explainer: phaseDefinition.explainer,
      },
    ],
    phaseSelections: [{ phaseDefinitionId: phaseDefinition.id, include: true, weeks: weekCount }],
    days,
    weekLabels,
    weekVolumes,
    scalesDistanceWithMileage: program.scales_distance_with_mileage,
    scalesDurationWithMileage: program.scales_duration_with_mileage,
    targetPeakWeeklyMiles,
    targetPeakWeeklyDurationS,
    anchor: { kind: "startDate", startDate: phase.start_date, targetEventDate: null },
  });

  if ("error" in generationResult) return { error: generationResult.error };
  return { phase: { startDate: phase.start_date, endDate: phase.end_date }, generation: generationResult.result };
}

export async function previewPhaseResync(phaseId: string, athleteId: string): Promise<{ error?: string; preview?: PhaseResyncPreview }> {
  const loaded = await loadPhaseResyncGeneration(phaseId, athleteId);
  if ("error" in loaded) return { error: loaded.error };

  const supabase = await createClient();
  const { count: currentWorkoutCount } = await supabase
    .from("scheduled_workouts")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", loaded.phase.startDate)
    .lte("scheduled_date", loaded.phase.endDate);
  const weeks = mondaysInRange(loaded.phase.startDate, loaded.phase.endDate);
  const { count: currentWeekPlanCount } = weeks.length
    ? await supabase
        .from("training_week_plans")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId)
        .in("week_start", weeks)
    : { count: 0 };

  return {
    preview: {
      generation: loaded.generation,
      currentWorkoutCount: currentWorkoutCount ?? 0,
      currentWeekPlanCount: currentWeekPlanCount ?? 0,
    },
  };
}

export type ResyncPhaseResult = { error?: string; clearedWorkouts?: number; clearedWeekPlans?: number; workoutsCreated?: number };

// Replaces this one phase's real, assigned content with a fresh pull from
// its source Program -- the resync half of the gap the provenance
// migration's own comment flagged (editing a Program never reached an
// already-assigned athlete). Re-derives the generation from scratch here
// too (never trusts a client-supplied payload for the actual write), then
// writes it atomically via resync_program_phase_generation, which clears
// every scheduled_workouts/training_week_plans row in the phase's own
// date range first -- draft and already-published workouts alike; the
// caller's own confirm dialog is what makes that an explicit, informed
// choice rather than a silent one.
export async function resyncPhaseFromProgram(phaseId: string, athleteId: string): Promise<ResyncPhaseResult> {
  const loaded = await loadPhaseResyncGeneration(phaseId, athleteId);
  if ("error" in loaded) return { error: loaded.error };
  const generation = loaded.generation;

  const session = await getAppSession();
  if (!session) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resync_program_phase_generation", {
    p_phase_id: phaseId,
    p_athlete_id: athleteId,
    p_days: generation.days.map((d) => ({
      sourceProgramDayId: d.sourceProgramDayId,
      scheduledDate: d.scheduledDate,
      dayLabel: d.dayLabel,
      sessionSlot: d.sessionSlot,
      isOptional: d.isOptional,
      alternativeText: d.alternativeText,
      plannedDistanceM: d.plannedDistanceM,
      plannedDistanceMaxM: d.plannedDistanceMaxM,
      plannedDurationS: d.plannedDurationS,
      plannedDurationMaxS: d.plannedDurationMaxS,
      plannedPaceSPerMi: d.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: d.plannedPaceMaxSPerMi,
      paceReference: d.paceReference,
      pacePercentBasis: d.pacePercentBasis,
      pacePercentMin: d.pacePercentMin,
      pacePercentMax: d.pacePercentMax,
      plannedHrBpm: d.plannedHrBpm,
      plannedHrMaxBpm: d.plannedHrMaxBpm,
      plannedRpe: d.plannedRpe,
      plannedRpeMax: d.plannedRpeMax,
      notes: d.notes,
      steps: d.steps.map((s) => ({
        stepOrder: s.stepOrder,
        stepType: s.stepType,
        durationS: s.durationS,
        durationMaxS: s.durationMaxS,
        distanceM: s.distanceM,
        distanceMaxM: s.distanceMaxM,
        targetType: s.targetType,
        targetMin: s.targetMin,
        targetMax: s.targetMax,
        targetUnit: s.targetUnit,
        targetPaceReference: s.targetPaceReference,
        targetPacePercentBasis: s.targetPacePercentBasis,
        targetPacePercentMin: s.targetPacePercentMin,
        targetPacePercentMax: s.targetPacePercentMax,
        repetitions: s.repetitions,
        repetitionsMax: s.repetitionsMax,
        restS: s.restS,
        restMaxS: s.restMaxS,
        instructions: s.instructions,
      })),
      extras: d.extras.map((e) => ({
        extraOrder: e.extraOrder,
        kind: e.kind,
        overview: e.overview,
        count: e.count,
        distanceM: e.distanceM,
        durationS: e.durationS,
        items: e.items,
      })),
    })),
    p_weeks: generation.weeks.map((w) => ({ weekStart: w.weekStart, targetVolumeMin: w.targetVolumeMin, targetVolumeMax: w.targetVolumeMax, label: w.label, notes: w.notes })),
  });
  if (error) return { error: error.message };

  // A resync is the one supported way for a coach to push a corrected
  // explainer onto training that's already assigned, so it refreshes the
  // phase's own copy alongside the days the RPC just regenerated. Done
  // here rather than inside the RPC because that function receives only
  // day and week payloads, never phase metadata, and a coach-initiated,
  // idempotent refresh has no need to share the RPC's transaction.
  await supabase
    .from("training_phases")
    .update({ explainer: generation.phases[0]?.explainer ?? null })
    .eq("id", phaseId)
    .eq("athlete_id", athleteId);

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "program_phase_resynced",
    entity_type: "training_phases",
    entity_id: phaseId,
    metadata: { athleteId, ...data },
  });

  revalidatePath(`/coaching/athletes/${athleteId}/schedule`);
  return { clearedWorkouts: data?.clearedWorkouts, clearedWeekPlans: data?.clearedWeekPlans, workoutsCreated: data?.workoutsCreated };
}
