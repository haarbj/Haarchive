import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { ProgramDetail, type PhaseDefinitionRow, type VariantRow } from "./program-detail";
import { DeleteProgramButton } from "./delete-program-button";
import { AssignToAthleteButton, type RosterOption } from "./assign-to-athlete-button";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  scales_distance_with_mileage: boolean;
  scales_duration_with_mileage: boolean;
  initial_mileage_min: number | null;
  initial_mileage_max: number | null;
  peak_mileage_min: number | null;
  peak_mileage_max: number | null;
  typical_goal_times: string | null;
  recommended_for: string | null;
  glossary_terms: string[] | null;
};
type PhaseDefRow = {
  id: string;
  phase_key: string;
  name: string | null;
  duration_weeks_min: number;
  duration_weeks_max: number;
  is_optional: boolean;
  notes: string | null;
  explainer: string | null;
};
type VariantDbRow = { id: string; name: string; is_default: boolean };
type VariantPhaseRow = { variant_id: string; phase_definition_id: string; position: number };
type DayWeekRow = { phase_definition_id: string; week_number: number };

export default async function ProgramDetailPage({ params }: { params: Promise<{ programId: string }> }) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");
  const { programId } = await params;

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("training_programs")
    .select(
      "id, name, description, scales_distance_with_mileage, scales_duration_with_mileage, initial_mileage_min, initial_mileage_max, peak_mileage_min, peak_mileage_max, typical_goal_times, recommended_for, glossary_terms",
    )
    .eq("id", programId)
    .eq("coach_id", session.userId)
    .maybeSingle<ProgramRow>();
  if (!program) notFound();

  const [{ data: phaseDefRows }, { data: variantRows }, { data: variantPhaseRows }, { data: dayWeekRows }, roster] = await Promise.all([
    supabase
      .from("program_phase_definitions")
      .select("id, phase_key, name, duration_weeks_min, duration_weeks_max, is_optional, notes, explainer")
      .eq("program_id", programId)
      .order("position")
      .returns<PhaseDefRow[]>(),
    supabase.from("program_duration_variants").select("id, name, is_default").eq("program_id", programId).order("name").returns<VariantDbRow[]>(),
    supabase
      .from("program_variant_phases")
      .select("variant_id, phase_definition_id, position")
      .order("position")
      .returns<VariantPhaseRow[]>(),
    supabase.from("program_days").select("phase_definition_id, week_number").eq("program_id", programId).returns<DayWeekRow[]>(),
    loadRoster(supabase, session.userId),
  ]);

  const phaseLabelById = new Map((phaseDefRows ?? []).map((p) => [p.id, p.name ?? p.phase_key]));
  const weeksWithContentByPhase = new Map<string, Set<number>>();
  for (const row of dayWeekRows ?? []) {
    const set = weeksWithContentByPhase.get(row.phase_definition_id) ?? new Set<number>();
    set.add(row.week_number);
    weeksWithContentByPhase.set(row.phase_definition_id, set);
  }

  const phaseDefinitions: PhaseDefinitionRow[] = (phaseDefRows ?? []).map((p) => ({
    id: p.id,
    phaseKey: p.phase_key,
    name: p.name,
    durationWeeksMin: p.duration_weeks_min,
    durationWeeksMax: p.duration_weeks_max,
    isOptional: p.is_optional,
    notes: p.notes,
    explainer: p.explainer,
    weeksWithContent: weeksWithContentByPhase.get(p.id)?.size ?? 0,
  }));

  const phasesByVariant = new Map<string, VariantPhaseRow[]>();
  for (const row of variantPhaseRows ?? []) {
    const list = phasesByVariant.get(row.variant_id) ?? [];
    list.push(row);
    phasesByVariant.set(row.variant_id, list);
  }

  const variants: VariantRow[] = (variantRows ?? []).map((v) => {
    const phases = (phasesByVariant.get(v.id) ?? []).slice().sort((a, b) => a.position - b.position);
    return {
      id: v.id,
      name: v.name,
      isDefault: v.is_default,
      phaseDefinitionIds: phases.map((p) => p.phase_definition_id),
      phaseLabels: phases.map((p) => phaseLabelById.get(p.phase_definition_id) ?? "?"),
    };
  });

  const scalingText = [
    program.scales_distance_with_mileage ? "Scales distance with target peak mileage" : null,
    program.scales_duration_with_mileage ? "Scales duration with target peak mileage" : null,
  ].filter(Boolean);

  const stats = [
    formatMileageRange("Initial mileage", program.initial_mileage_min, program.initial_mileage_max),
    formatMileageRange("Peak mileage", program.peak_mileage_min, program.peak_mileage_max),
    program.typical_goal_times ? `Typical goal times: ${program.typical_goal_times}` : null,
  ].filter((v): v is string => v != null);

  return (
    <Container variant="content">
      <BackLink href="/coaching/programs">Programs</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading>{program.name}</Heading>
        <div className="flex items-center gap-3 pt-2">
          <AssignToAthleteButton programId={program.id} roster={roster} />
          <Button href={`/coaching/programs/${program.id}/edit`} variant="outline" size="sm">
            Edit
          </Button>
          <DeleteProgramButton programId={program.id} programName={program.name} />
        </div>
      </div>

      {program.description ? <p className="mt-3 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{program.description}</p> : null}
      {stats.length > 0 ? <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{stats.join(" · ")}</p> : null}
      {program.recommended_for ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Recommended for: </span>
          {program.recommended_for}
        </p>
      ) : null}
      {program.glossary_terms && program.glossary_terms.length > 0 ? (
        <div className="mt-3 max-w-xl rounded-control border border-black/10 p-3 text-sm dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Glossary</p>
          <dl className="mt-1.5 space-y-0.5">
            {program.glossary_terms.map((entry, i) => (
              <div key={i} className="text-zinc-600 dark:text-zinc-300">
                {entry}
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {scalingText.length > 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{scalingText.join(" · ")}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          No mileage scaling -- every athlete gets this program&rsquo;s authored distances and durations exactly as written.
        </p>
      )}

      <ProgramDetail programId={program.id} phaseDefinitions={phaseDefinitions} variants={variants} />
    </Container>
  );
}

function formatMileageRange(label: string, min: number | null, max: number | null): string | null {
  if (min == null) return null;
  if (max == null || max === min) return `${label}: ${min}mi/wk`;
  return `${label}: ${min}-${max}mi/wk`;
}

// This coach's active roster, feeding AssignToAthleteButton's picker --
// same coach_athletes + profiles join the schedule page's own roster read
// uses (see that page's AthleteSwitcher wiring), duplicated here rather
// than shared since each is a one-off, request-scoped server read, not a
// reusable client concern.
async function loadRoster(supabase: Awaited<ReturnType<typeof createClient>>, coachId: string): Promise<RosterOption[]> {
  const { data: relationships } = await supabase
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .returns<{ athlete_id: string }[]>();
  const rosterIds = (relationships ?? []).map((r) => r.athlete_id);
  if (rosterIds.length === 0) return [];
  const { data: rosterProfiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", rosterIds)
    .returns<{ id: string; display_name: string }[]>();
  return (rosterProfiles ?? [])
    .map((p) => ({ athleteId: p.id, displayName: p.display_name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
