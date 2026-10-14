import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import type { WorkoutType } from "@/lib/coaching-engine";
import { TemplateForm, type ExistingTemplate } from "../template-form";
import type { ExtraPresetOption } from "../../athletes/[athleteId]/schedule/actions";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type TemplateRow = {
  id: string;
  name: string;
  workout_type: WorkoutType | null;
  description: string | null;
  day_label: string | null;
  session_slot: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: PaceReferenceKey | null;
  planned_volume_percent: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
};
type StepRow = {
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
  repetitions: number | null;
  repetitions_max: number | null;
  rest_s: number | null;
  rest_max_s: number | null;
  instructions: string | null;
};
type ExtraRow = {
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};
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

export default async function EditTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");
  const { templateId } = await params;

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("workout_templates")
    .select(
      "id, name, workout_type, description, day_label, session_slot, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, planned_volume_percent, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max",
    )
    .eq("id", templateId)
    .eq("coach_id", session.userId)
    .maybeSingle<TemplateRow>();
  if (!template) notFound();

  const [{ data: stepRows }, { data: extraRows }, { data: extraPresetRows }] = await Promise.all([
    supabase
      .from("workout_template_steps")
      .select(
        "step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, repetitions, repetitions_max, rest_s, rest_max_s, instructions",
      )
      .eq("template_id", templateId)
      .order("step_order")
      .returns<StepRow[]>(),
    supabase
      .from("workout_template_extras")
      .select("kind, overview, count, distance_m, duration_s, items")
      .eq("template_id", templateId)
      .order("extra_order")
      .returns<ExtraRow[]>(),
    supabase
      .from("coach_extra_presets")
      .select("id, name, kind, overview, count, distance_m, duration_s, items")
      .eq("coach_id", session.userId)
      .order("name")
      .returns<ExtraPresetRow[]>(),
  ]);

  const steps: StepInput[] = (stepRows ?? []).map((row) => ({
    stepType: row.step_type,
    durationS: row.duration_s,
    durationMaxS: row.duration_max_s,
    distanceM: row.distance_m,
    distanceMaxM: row.distance_max_m,
    targetType: row.target_type,
    targetMin: row.target_min,
    targetMax: row.target_max,
    targetUnit: row.target_unit,
    targetPaceReference: row.target_pace_reference,
    repetitions: row.repetitions,
    repetitionsMax: row.repetitions_max,
    restS: row.rest_s,
    restMaxS: row.rest_max_s,
    instructions: row.instructions,
  }));

  const extras: WorkoutExtraInput[] = (extraRows ?? []).map((e) => ({
    kind: e.kind,
    overview: e.overview,
    count: e.count,
    distanceM: e.distance_m,
    durationS: e.duration_s,
    items: e.items ?? [],
  }));

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
      <BackLink href="/coaching/templates">Templates</BackLink>
      <Heading>{template.name}</Heading>
      <div className="mt-8">
        <TemplateForm
          extraPresets={extraPresets}
          existing={
            {
              id: template.id,
              name: template.name,
              workoutType: template.workout_type,
              description: template.description,
              dayLabel: template.day_label,
              sessionSlot: template.session_slot,
              plannedDistanceM: template.planned_distance_m,
              plannedDistanceMaxM: template.planned_distance_max_m,
              plannedDurationS: template.planned_duration_s,
              plannedDurationMaxS: template.planned_duration_max_s,
              plannedPaceSPerMi: template.planned_pace_s_per_mi,
              plannedPaceMaxSPerMi: template.planned_pace_max_s_per_mi,
              plannedPaceReference: template.pace_reference,
              plannedVolumePercent: template.planned_volume_percent,
              plannedHrBpm: template.planned_hr_bpm,
              plannedHrMaxBpm: template.planned_hr_max_bpm,
              plannedRpe: template.planned_rpe,
              plannedRpeMax: template.planned_rpe_max,
              extras,
              steps,
            } satisfies ExistingTemplate
          }
        />
      </div>
    </Container>
  );
}
