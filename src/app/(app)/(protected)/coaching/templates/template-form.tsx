"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { saveTemplate, type TemplateInput } from "./actions";
import type { ExtraPresetOption } from "../athletes/[athleteId]/schedule/actions";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import type { WorkoutType } from "@/lib/coaching-engine";
import { DayVocabularyFields } from "@/components/private-coaching/day-vocabulary-fields";
import { ExtrasEditor } from "@/components/private-coaching/extras-editor";
import { useWorkoutTargetFields } from "@/components/private-coaching/use-workout-target-fields";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { StepsEditor } from "@/components/private-coaching/steps-editor";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type ExistingTemplate = {
  id: string;
  name: string;
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

// Same day_label/distance/duration/pace/HR/RPE/extras vocabulary a real
// scheduled workout gets (DayVocabularyFields + ExtrasEditor +
// useWorkoutTargetFields, all shared with QuickCreatePanel/WorkoutForm) --
// a template that couldn't hold a mileage range or an extra wasn't
// actually a fast on-ramp for the current prescription model, just for
// the old workout_type-only one. The old "Type" dropdown is gone from
// this form for the same reason it's gone from WorkoutForm: day_label is
// the real, coach-editable vocabulary now. workoutType is still preserved
// on submit for an existing template's legacy value (never cleared, never
// set for a new one).
export function TemplateForm({ existing, extraPresets }: { existing?: ExistingTemplate; extraPresets: ExtraPresetOption[] }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dayLabel, setDayLabel] = useState(existing?.dayLabel ?? "");
  const [sessionSlot, setSessionSlot] = useState<string | null>(existing?.sessionSlot ?? null);
  const [extras, setExtras] = useState<WorkoutExtraInput[]>(existing?.extras ?? []);
  const { fieldProps: targetFieldProps, getPayload: getTargetPayload } = useWorkoutTargetFields(existing);
  const [steps, setSteps] = useState<StepInput[]>(existing?.steps ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Give this template a name.");
    const targetResult = getTargetPayload();
    if (!targetResult.ok) return setError(targetResult.error);

    setIsPending(true);
    const input: TemplateInput = {
      id: existing?.id,
      name,
      workoutType: existing?.workoutType ?? null,
      description: description.trim() || null,
      dayLabel: dayLabel.trim() || null,
      sessionSlot,
      extras,
      ...targetResult.data,
      steps,
    };
    const result = await saveTemplate(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    router.push("/coaching/templates");
  }

  return (
    <div className="space-y-6">
      <label className="block max-w-sm">
        <span className={labelClass}>Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Long Run, 6x1000m @ threshold…"
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </label>

      <DayVocabularyFields
        dayLabel={dayLabel}
        onDayLabelChange={setDayLabel}
        sessionSlot={sessionSlot}
        onSessionSlotChange={setSessionSlot}
        {...targetFieldProps}
      />

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Extras</p>
        <ExtrasEditor extras={extras} onChange={setExtras} presets={extraPresets} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Steps</p>
        <StepsEditor steps={steps} onChange={setSteps} />
      </div>

      {error && <FormError>{error}</FormError>}

      <Button type="button" disabled={isPending} onClick={handleSubmit}>
        {isPending ? "Saving…" : "Save template"}
      </Button>
    </div>
  );
}
