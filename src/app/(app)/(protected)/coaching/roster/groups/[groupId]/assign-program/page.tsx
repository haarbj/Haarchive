import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { loadGroupMembersForAssign } from "./assign-program-group-actions";
import { AssignProgramGroupForm } from "./assign-program-group-form";
import type { ProgramOption } from "../../../../athletes/[athleteId]/schedule/assign-program-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Assign Program to Group",
  robots: { index: false, follow: false },
};

type ProgramRow = {
  id: string;
  name: string;
  scales_distance_with_mileage: boolean;
  scales_duration_with_mileage: boolean;
  framework_key: string | null;
};
type VariantRow = { id: string; program_id: string; name: string };
type PhaseDefRow = {
  id: string;
  program_id: string;
  phase_key: string;
  name: string | null;
  duration_weeks_min: number;
  duration_weeks_max: number;
  is_optional: boolean;
};
type VariantPhaseRow = { variant_id: string; phase_definition_id: string; position: number };
type VolumeVariantRow = {
  id: string;
  program_id: string;
  name: string;
  position: number;
  peak_mileage: number | null;
  initial_mileage: number | null;
};

// Duplicated from the single-athlete schedule page's own loadProgramOptions
// (coaching/athletes/[athleteId]/schedule/page.tsx) rather than extracted
// into a shared module -- that page is a live, heavily-used coach flow, and
// refactoring it to export a helper for this unrelated group-assign feature
// isn't a risk worth taking for one ~70-line query. Keep the two in sync by
// hand if the program-options shape ever changes. RLS scopes every one of
// these four tables to coach_id = auth.uid() already (see the Programs
// migrations), so no explicit coach filter is needed here either.
async function loadProgramOptions(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ProgramOption[]> {
  const { data: programRows } = await supabase
    .from("training_programs")
    .select("id, name, scales_distance_with_mileage, scales_duration_with_mileage, framework_key")
    .order("name")
    .returns<ProgramRow[]>();
  const programIds = (programRows ?? []).map((p) => p.id);
  if (programIds.length === 0) return [];

  const [{ data: variantRows }, { data: phaseDefRows }, { data: variantPhaseRows }, { data: volumeVariantRows }] = await Promise.all([
    supabase.from("program_duration_variants").select("id, program_id, name").in("program_id", programIds).order("name").returns<VariantRow[]>(),
    supabase
      .from("program_phase_definitions")
      .select("id, program_id, phase_key, name, duration_weeks_min, duration_weeks_max, is_optional")
      .in("program_id", programIds)
      .returns<PhaseDefRow[]>(),
    supabase.from("program_variant_phases").select("variant_id, phase_definition_id, position").order("position").returns<VariantPhaseRow[]>(),
    supabase
      .from("program_volume_variants")
      .select("id, program_id, name, position, peak_mileage, initial_mileage")
      .in("program_id", programIds)
      .order("position")
      .returns<VolumeVariantRow[]>(),
  ]);

  const phaseDefById = new Map((phaseDefRows ?? []).map((p) => [p.id, p]));
  const variantPhasesByVariant = new Map<string, VariantPhaseRow[]>();
  for (const row of variantPhaseRows ?? []) {
    const list = variantPhasesByVariant.get(row.variant_id) ?? [];
    list.push(row);
    variantPhasesByVariant.set(row.variant_id, list);
  }
  const variantsByProgram = new Map<string, VariantRow[]>();
  for (const row of variantRows ?? []) {
    const list = variantsByProgram.get(row.program_id) ?? [];
    list.push(row);
    variantsByProgram.set(row.program_id, list);
  }
  const volumeVariantsByProgram = new Map<string, VolumeVariantRow[]>();
  for (const row of volumeVariantRows ?? []) {
    const list = volumeVariantsByProgram.get(row.program_id) ?? [];
    list.push(row);
    volumeVariantsByProgram.set(row.program_id, list);
  }

  return (programRows ?? []).map((program) => ({
    id: program.id,
    name: program.name,
    scalesDistanceWithMileage: program.scales_distance_with_mileage,
    scalesDurationWithMileage: program.scales_duration_with_mileage,
    frameworkKey: program.framework_key,
    variants: (variantsByProgram.get(program.id) ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      phases: (variantPhasesByVariant.get(variant.id) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((vp) => phaseDefById.get(vp.phase_definition_id))
        .filter((p): p is PhaseDefRow => p != null)
        .map((p) => ({
          id: p.id,
          label: p.name ?? p.phase_key,
          isOptional: p.is_optional,
          durationWeeksMin: p.duration_weeks_min,
          durationWeeksMax: p.duration_weeks_max,
        })),
    })),
    volumeVariants: (volumeVariantsByProgram.get(program.id) ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      peakMileage: v.peak_mileage,
      initialMileage: v.initial_mileage,
    })),
  }));
}

export default async function AssignProgramToGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const loaded = await loadGroupMembersForAssign(groupId);
  if (loaded.error || !loaded.members) {
    return (
      <Container variant="content">
        <BackLink href="/coaching/roster">Roster</BackLink>
        <Heading>Assign program</Heading>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{loaded.error ?? "Group not found."}</p>
      </Container>
    );
  }

  const supabase = await createClient();
  const programs = await loadProgramOptions(supabase);

  return (
    <Container variant="content">
      <BackLink href="/coaching/roster">Roster</BackLink>
      <Heading>Assign program to {loaded.groupName}</Heading>
      <p className="mt-4 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
        Configure the program once -- it applies to every athlete in this group. Each athlete is checked against
        their own calendar before anything is written, and a conflict never gets cleared without your say-so.
      </p>
      <div className="mt-8">
        <AssignProgramGroupForm
          groupId={groupId}
          groupName={loaded.groupName ?? "this group"}
          members={loaded.members}
          programs={programs}
        />
      </div>
    </Container>
  );
}
