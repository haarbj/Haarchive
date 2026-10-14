import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import type { ExtraPresetOption } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";
import { PhaseDaysGrid, type WeekLabelInfo } from "./phase-days-grid";
import type { ExistingProgramDay } from "./program-day-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type ProgramRow = { id: string; name: string };
type PhaseDefRow = { id: string; phase_key: string; name: string | null; duration_weeks_max: number };
type ProgramDayRow = {
  id: string;
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
  pace_reference: PaceReferenceKey | null;
  pace_percent_basis: PaceReferenceKey | null;
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
  is_event_day: boolean;
  is_optional: boolean;
  alternative_text: string | null;
  difficulty_label: string | null;
  notes: string | null;
  program_day_steps: {
    step_order: number;
    step_type: StepInput["stepType"];
    duration_s: number | null;
    duration_max_s: number | null;
    distance_m: number | null;
    distance_max_m: number | null;
    target_type: StepInput["targetType"];
    target_min: number | null;
    target_max: number | null;
    target_unit: string | null;
    target_pace_reference: PaceReferenceKey | null;
    target_pace_percent_basis: PaceReferenceKey | null;
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
type WeekLabelRow = { week_number: number; label: string | null; notes: string | null };
type ExtraPresetRow = {
  id: string;
  name: string;
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};

export default async function PhaseDaysPage({ params }: { params: Promise<{ programId: string; phaseDefinitionId: string }> }) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");
  const { programId, phaseDefinitionId } = await params;

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("training_programs")
    .select("id, name")
    .eq("id", programId)
    .eq("coach_id", session.userId)
    .maybeSingle<ProgramRow>();
  if (!program) notFound();

  const { data: phase } = await supabase
    .from("program_phase_definitions")
    .select("id, phase_key, name, duration_weeks_max")
    .eq("id", phaseDefinitionId)
    .eq("program_id", programId)
    .maybeSingle<PhaseDefRow>();
  if (!phase) notFound();

  const [{ data: dayRows }, { data: weekLabelRows }, { data: extraPresetRows }] = await Promise.all([
    supabase
      .from("program_days")
      .select(
        "id, week_number, day_of_week, day_label, session_slot, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max, is_event_day, is_optional, alternative_text, difficulty_label, notes, program_day_steps(*), program_day_extras(*)",
      )
      .eq("phase_definition_id", phaseDefinitionId)
      .returns<ProgramDayRow[]>(),
    supabase.from("program_phase_weeks").select("week_number, label, notes").eq("phase_definition_id", phaseDefinitionId).returns<WeekLabelRow[]>(),
    supabase
      .from("coach_extra_presets")
      .select("id, name, kind, overview, count, distance_m, duration_s, items")
      .eq("coach_id", session.userId)
      .order("name")
      .returns<ExtraPresetRow[]>(),
  ]);

  // One day slot can hold more than one session: Ridge, Peak and Summit
  // are built on AM/PM doubles (Summit authors 211 sessions across its 126
  // day slots). This used to be a Map keyed by day_of_week holding a single
  // day, which silently kept only whichever row happened to be read last,
  // hiding the other half of every double.
  const daysByWeek = new Map<number, Map<number, ExistingProgramDay[]>>();
  for (const row of dayRows ?? []) {
    const week = daysByWeek.get(row.week_number) ?? new Map<number, ExistingProgramDay[]>();
    const sessions = week.get(row.day_of_week) ?? [];
    sessions.push(toExistingProgramDay(row));
    week.set(row.day_of_week, sessions);
    daysByWeek.set(row.week_number, week);
  }
  // AM before PM, and a slot-less single session first -- a stable reading
  // order, never database row order.
  const slotRank = (slot: string | null) => (slot == null ? 0 : slot.toUpperCase() === "AM" ? 1 : 2);
  for (const week of daysByWeek.values()) {
    for (const sessions of week.values()) {
      sessions.sort((a, b) => slotRank(a.sessionSlot) - slotRank(b.sessionSlot) || (a.sessionSlot ?? "").localeCompare(b.sessionSlot ?? ""));
    }
  }

  const weekLabels = new Map<number, WeekLabelInfo>();
  for (const row of weekLabelRows ?? []) {
    if (row.label || row.notes) weekLabels.set(row.week_number, { label: row.label, notes: row.notes });
  }

  const extraPresets: ExtraPresetOption[] = (extraPresetRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    overview: p.overview,
    count: p.count,
    distanceM: p.distance_m,
    durationS: p.duration_s,
    items: p.items ?? [],
  }));

  return (
    <Container variant="content">
      <BackLink href={`/coaching/programs/${program.id}`}>{program.name}</BackLink>
      <Heading>{phase.name ?? phase.phase_key}</Heading>
      <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        Author each week&rsquo;s workouts by day of week -- these are abstract slots (Week 1, Monday), not real dates. Real
        dates are computed when you assign this program to an athlete.
      </p>

      <PhaseDaysGrid
        programId={program.id}
        phaseDefinitionId={phase.id}
        durationWeeksMax={phase.duration_weeks_max}
        daysByWeek={daysByWeek}
        weekLabels={weekLabels}
        extraPresets={extraPresets}
      />
    </Container>
  );
}

function toExistingProgramDay(row: ProgramDayRow): ExistingProgramDay {
  return {
    id: row.id,
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
    difficultyLabel: row.difficulty_label,
    notes: row.notes,
    extras: (row.program_day_extras ?? [])
      .slice()
      .sort((a, b) => a.extra_order - b.extra_order)
      .map(
        (e): WorkoutExtraInput => ({
          kind: e.kind,
          overview: e.overview,
          count: e.count,
          distanceM: e.distance_m,
          durationS: e.duration_s,
          items: e.items ?? [],
        }),
      ),
    steps: (row.program_day_steps ?? [])
      .slice()
      .sort((a, b) => a.step_order - b.step_order)
      .map(
        (s): StepInput => ({
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
        }),
      ),
  };
}
