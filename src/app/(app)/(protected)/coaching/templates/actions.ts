"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { validateStepRanges, type StepInput } from "@/lib/private-coaching/steps";
import { stepInputToIntensityTargets, intensityTargetsToTemplateStepRow } from "@/lib/private-coaching/intensity-target";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import {
  validateDistanceRange,
  validateDurationRange,
  validatePaceRange,
  validateHrRange,
  validateRpeRange,
} from "@/lib/private-coaching/workout-distance";
import { stepInputsSchema } from "@/lib/validation/private-coaching";
import type { WorkoutType } from "@/lib/coaching-engine";

export type TemplateInput = {
  id?: string;
  name: string;
  // workoutType is the old, pre-day_label vocabulary -- preserved on the
  // type only so an existing template's legacy value round-trips through
  // an edit unchanged (same "never cleared, never set for a new one"
  // treatment scheduled_workouts already gives it); dayLabel below is the
  // real, coach-editable categorization now, matching day-vocabulary-
  // fields.tsx exactly.
  workoutType: WorkoutType | null;
  description: string | null;
  dayLabel: string | null;
  sessionSlot: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  plannedPaceReference: PaceReferenceKey | null;
  plannedVolumePercent: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  extras: WorkoutExtraInput[];
  steps: StepInput[];
};

function templateExtraRows(templateId: string, extras: WorkoutExtraInput[]) {
  return extras.map((extra, index) => ({
    template_id: templateId,
    extra_order: index,
    kind: extra.kind,
    overview: extra.overview,
    count: extra.count,
    distance_m: extra.distanceM,
    duration_s: extra.durationS,
    items: extra.items,
  }));
}

// workout_templates/workout_template_steps RLS scopes every read/write to
// coach_id = auth.uid() directly (see the Phase 1 migration) -- no
// coach_athletes relationship is involved at all, since a template belongs
// to the coach's own library, not to any one athlete. The RLS-scoped
// client is sufficient for all of this; no service-role client needed.
export async function saveTemplate(input: TemplateInput): Promise<{ error?: string; id?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (!input.name.trim()) return { error: "Give this template a name." };

  const stepsCheck = stepInputsSchema.safeParse(input.steps);
  if (!stepsCheck.success) return { error: stepsCheck.error.issues[0]?.message ?? "Check this template's steps." };
  const stepRangesCheck = validateStepRanges(input.steps);
  if (!stepRangesCheck.valid) return { error: stepRangesCheck.error };

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

  const supabase = await createClient();

  const templateFields = {
    name: input.name.trim(),
    workout_type: input.workoutType,
    description: input.description,
    day_label: input.dayLabel,
    session_slot: input.sessionSlot,
    planned_distance_m: input.plannedDistanceM,
    planned_distance_max_m: input.plannedDistanceMaxM,
    planned_duration_s: input.plannedDurationS,
    planned_duration_max_s: input.plannedDurationMaxS,
    planned_pace_s_per_mi: input.plannedPaceSPerMi,
    planned_pace_max_s_per_mi: input.plannedPaceMaxSPerMi,
    pace_reference: input.plannedPaceReference,
    planned_volume_percent: input.plannedVolumePercent,
    planned_hr_bpm: input.plannedHrBpm,
    planned_hr_max_bpm: input.plannedHrMaxBpm,
    planned_rpe: input.plannedRpe,
    planned_rpe_max: input.plannedRpeMax,
  };

  let templateId = input.id;
  if (templateId) {
    const { error } = await supabase
      .from("workout_templates")
      .update({ ...templateFields, updated_at: new Date().toISOString() })
      .eq("id", templateId)
      .eq("coach_id", session.userId);
    if (error) return { error: error.message };

    const { error: deleteStepsError } = await supabase.from("workout_template_steps").delete().eq("template_id", templateId);
    if (deleteStepsError) return { error: deleteStepsError.message };

    const { error: deleteExtrasError } = await supabase
      .from("workout_template_extras")
      .delete()
      .eq("template_id", templateId);
    if (deleteExtrasError) return { error: deleteExtrasError.message };
  } else {
    const { data, error } = await supabase
      .from("workout_templates")
      .insert({ coach_id: session.userId, ...templateFields })
      .select("id")
      .single();
    if (error) return { error: error.message };
    templateId = data.id;
  }
  if (!templateId) return { error: "Something went wrong saving this template." };

  if (input.extras.length > 0) {
    const { error: extrasError } = await supabase
      .from("workout_template_extras")
      .insert(templateExtraRows(templateId, input.extras));
    if (extrasError) return { error: extrasError.message };
  }

  if (input.steps.length > 0) {
    // Routed through the shared IntensityTarget contract (coaching-
    // platform-audit/05 §1.1), same as schedule/actions.ts's and
    // programs/actions.ts's step inserts -- via the narrower
    // intensityTargetsToTemplateStepRow specifically, since
    // workout_template_steps has no target_pace_percent_* columns at all
    // (only program_day_steps and scheduled_workout_steps do; see
    // intensity-target.ts's own comment). D2 (coaching-platform-audit/01
    // §5.2): repetitions_max/rest_max_s exist on workout_template_steps but
    // were previously never written here -- a closed dead loop where every
    // reader expected them and no writer ever set them.
    const { error: stepsError } = await supabase.from("workout_template_steps").insert(
      input.steps.map((step, index) => ({
        template_id: templateId,
        step_order: index,
        step_type: step.stepType,
        ...intensityTargetsToTemplateStepRow(stepInputToIntensityTargets(step)),
        repetitions: step.repetitions,
        repetitions_max: step.repetitionsMax,
        rest_s: step.restS,
        rest_max_s: step.restMaxS,
        instructions: step.instructions,
      })),
    );
    if (stepsError) return { error: stepsError.message };
  }

  revalidatePath("/coaching/templates");
  return { id: templateId };
}

export async function deleteTemplate(templateId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("workout_templates").delete().eq("id", templateId).eq("coach_id", session.userId);
  if (error) return { error: error.message };

  revalidatePath("/coaching/templates");
  return {};
}
