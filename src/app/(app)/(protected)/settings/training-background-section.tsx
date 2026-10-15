"use client";

import { useActionState, useId, useState } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { updateTrainingBackground } from "./actions";
import {
  TRAINING_BACKGROUND_SOURCES,
  TRAINING_BACKGROUND_SOURCE_LABELS,
  type TrainingBackgroundSource,
} from "@/lib/private-coaching/training-background";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

// Run Club intake: who trained this athlete before this platform, whoever
// that was. Which fields show up changes with the source -- a self-trained
// athlete is asked what their own buildup actually looked like (there's no
// coach's record of it anywhere else); someone coming from a previous coach
// or another app is asked for that context, neutrally, never a judgment of
// it; someone new to structured training is asked almost nothing, because
// there's no buildup yet to ask about. See training-background.ts's own
// header for why this exists.
export type TrainingBackgroundProps = {
  initialSource: TrainingBackgroundSource | null;
  initialCoachName: string | null;
  initialProgramName: string | null;
  initialRecentTypicalMileage: number | null;
  initialPeakMileage: number | null;
  initialSummary: string | null;
  initialInjuryHistory: string | null;
};

export function TrainingBackgroundSection({
  initialSource,
  initialCoachName,
  initialProgramName,
  initialRecentTypicalMileage,
  initialPeakMileage,
  initialSummary,
  initialInjuryHistory,
}: TrainingBackgroundProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateTrainingBackground, {});
  const [source, setSource] = useState<TrainingBackgroundSource | "">(initialSource ?? "");

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor={`${baseId}-source`} className={labelClass}>
          How were they training before now?
        </label>
        <select
          id={`${baseId}-source`}
          name="source"
          value={source}
          onChange={(e) => setSource(e.target.value as TrainingBackgroundSource)}
          required
          className={fieldClass}
        >
          <option value="" disabled>
            Pick one
          </option>
          {TRAINING_BACKGROUND_SOURCES.map((s) => (
            <option key={s} value={s}>
              {TRAINING_BACKGROUND_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {source === "previous_coach" ? (
        <div>
          <label htmlFor={`${baseId}-coach-name`} className={labelClass}>
            Who was coaching them? (optional)
          </label>
          <input
            id={`${baseId}-coach-name`}
            name="coachName"
            type="text"
            defaultValue={initialCoachName ?? ""}
            className={fieldClass}
          />
        </div>
      ) : null}

      {source === "other_plan_or_app" ? (
        <div>
          <label htmlFor={`${baseId}-program-name`} className={labelClass}>
            Which plan or app were they following? (optional)
          </label>
          <input
            id={`${baseId}-program-name`}
            name="programName"
            type="text"
            defaultValue={initialProgramName ?? ""}
            className={fieldClass}
          />
        </div>
      ) : null}

      {source && source !== "new_to_structured" ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-recent-mileage`} className={labelClass}>
                Typical recent weekly mileage (optional)
              </label>
              <input
                id={`${baseId}-recent-mileage`}
                name="recentTypicalMileage"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={initialRecentTypicalMileage ?? undefined}
                placeholder="e.g. 35"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-peak-mileage`} className={labelClass}>
                Peak weekly mileage in their last buildup
              </label>
              <input
                id={`${baseId}-peak-mileage`}
                name="peakMileage"
                type="number"
                inputMode="decimal"
                step="0.1"
                defaultValue={initialPeakMileage ?? undefined}
                placeholder="e.g. 55"
                className={fieldClass}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                This is what plan selection and progression anchor on -- recorded history, not an assumed prior
                cycle with this platform.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor={`${baseId}-summary`} className={labelClass}>
              {source === "self_trained"
                ? "What did that buildup actually look like? (peak week, key sessions, what worked)"
                : "Anything else worth knowing about that training? (optional, recorded as neutral context)"}
            </label>
            <textarea
              id={`${baseId}-summary`}
              name="summary"
              rows={3}
              defaultValue={initialSummary ?? ""}
              className={fieldClass}
            />
          </div>
        </>
      ) : null}

      {source === "new_to_structured" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          No buildup to record -- this routes straight to the 5K Crash Course instead of a marathon plan.
        </p>
      ) : null}

      <div>
        <label htmlFor={`${baseId}-injury-history`} className={labelClass}>
          Injury history worth knowing about? (optional)
        </label>
        <textarea
          id={`${baseId}-injury-history`}
          name="injuryHistory"
          rows={2}
          defaultValue={initialInjuryHistory ?? ""}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Visible to your coach, unlike the private injury log above. This is coaching context, not a diagnosis or
          medical clearance -- anything painful, persistent, or worsening is a conversation with a doctor or
          physical therapist.
        </p>
      </div>

      {state.error && <FormError>{state.error}</FormError>}
      {state.success && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending || !source}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
