import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { summarizeStep, type StepInput } from "@/lib/private-coaching/steps";
import { formatDistanceRange, formatDurationRange, formatPaceRange } from "@/lib/private-coaching/workout-distance";
import { PACE_REFERENCE_LABELS, type PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { formatResolvedVolumeText } from "@/lib/private-coaching/volume-reference";
import { DeleteTemplateButton } from "./delete-template-button";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Workout Templates",
  robots: { index: false, follow: false },
};

type TemplateRow = {
  id: string;
  name: string;
  workout_type: string | null;
  description: string | null;
  day_label: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: PaceReferenceKey | null;
  planned_volume_percent: number | null;
};
type StepRow = {
  template_id: string;
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
};
type ExtraRow = { template_id: string; kind: string };

export default async function TemplatesPage() {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("workout_templates")
    .select(
      "id, name, workout_type, description, day_label, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, planned_volume_percent",
    )
    .eq("coach_id", session.userId)
    .order("name")
    .returns<TemplateRow[]>();

  const templateIds = (templates ?? []).map((t) => t.id);
  const [{ data: stepRows }, { data: extraRows }] = await Promise.all([
    templateIds.length
      ? supabase
          .from("workout_template_steps")
          .select(
            "template_id, step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, repetitions, repetitions_max, rest_s, rest_max_s",
          )
          .in("template_id", templateIds)
          .order("step_order")
          .returns<StepRow[]>()
      : Promise.resolve({ data: [] as StepRow[] }),
    templateIds.length
      ? supabase.from("workout_template_extras").select("template_id, kind").in("template_id", templateIds).returns<ExtraRow[]>()
      : Promise.resolve({ data: [] as ExtraRow[] }),
  ]);

  const stepsByTemplate = new Map<string, StepRow[]>();
  for (const row of stepRows ?? []) {
    const list = stepsByTemplate.get(row.template_id) ?? [];
    list.push(row);
    stepsByTemplate.set(row.template_id, list);
  }

  const extraKindsByTemplate = new Map<string, string[]>();
  for (const row of extraRows ?? []) {
    const list = extraKindsByTemplate.get(row.template_id) ?? [];
    list.push(row.kind);
    extraKindsByTemplate.set(row.template_id, list);
  }

  return (
    <Container variant="content">
      <BackLink href="/coaching">Coaching</BackLink>
      <Heading>Workout Templates</Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        A reusable library of workouts you can assign to any athlete without rebuilding them from scratch.
      </p>

      <div className="mt-8">
        <Button href="/coaching/templates/new">New template</Button>
      </div>

      <div className="mt-8">
        {templates && templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => {
              const steps = stepsByTemplate.get(template.id) ?? [];
              const extraKinds = extraKindsByTemplate.get(template.id) ?? [];
              // Templates are athlete-agnostic (no athlete_id at all) --
              // a reference can never resolve to a number here, only its
              // plain label ("Threshold Pace"), never a fabricated pace.
              const rangeText = [
                template.planned_volume_percent != null ? formatResolvedVolumeText(undefined, template.planned_volume_percent) : null,
                formatDistanceRange(template.planned_distance_m, template.planned_distance_max_m),
                formatDurationRange(template.planned_duration_s, template.planned_duration_max_s),
                template.pace_reference
                  ? PACE_REFERENCE_LABELS[template.pace_reference]
                  : formatPaceRange(template.planned_pace_s_per_mi, template.planned_pace_max_s_per_mi),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Card key={template.id} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/coaching/templates/${template.id}`} className="font-semibold text-zinc-900 hover:underline dark:text-white">
                        {template.name}
                      </Link>
                      {template.day_label ? (
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{template.day_label}</span>
                      ) : null}
                      {rangeText ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{rangeText}</p> : null}
                      {extraKinds.length > 0 ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{extraKinds.join(" · ")}</p>
                      ) : null}
                      {template.description ? (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{template.description}</p>
                      ) : null}
                    </div>
                    <DeleteTemplateButton templateId={template.id} templateName={template.name} />
                  </div>
                  {steps.length > 0 ? (
                    <ul className="mt-3 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {steps.map((step, i) => (
                        <li key={i}>
                          {summarizeStep({
                            stepType: step.step_type,
                            durationS: step.duration_s,
                            durationMaxS: step.duration_max_s,
                            distanceM: step.distance_m,
                            distanceMaxM: step.distance_max_m,
                            targetType: step.target_type,
                            targetMin: step.target_min,
                            targetMax: step.target_max,
                            targetUnit: step.target_unit,
                            targetPaceReference: step.target_pace_reference,
                            repetitions: step.repetitions,
                            repetitionsMax: step.repetitions_max,
                            restS: step.rest_s,
                            restMaxS: step.rest_max_s,
                            instructions: null,
                          })}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState>No templates yet -- create one to reuse across athletes.</EmptyState>
        )}
      </div>
    </Container>
  );
}
