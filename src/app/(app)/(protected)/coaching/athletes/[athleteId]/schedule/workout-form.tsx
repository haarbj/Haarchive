"use client";

import { useEffect, useState } from "react";

import { saveScheduledWorkout, type ExtraPresetOption, type ScheduledWorkoutInput } from "./actions";
import { DayVocabularyFields } from "@/components/private-coaching/day-vocabulary-fields";
import { ExtrasEditor } from "@/components/private-coaching/extras-editor";
import { useWorkoutTargetFields } from "@/components/private-coaching/use-workout-target-fields";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import type { WorkoutType } from "@/lib/coaching-engine";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { StepsEditor } from "@/components/private-coaching/steps-editor";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Carries the full prescription vocabulary now, not just steps -- see the
// template-vocabulary migration and templates/template-form.tsx. A
// template applied via applyTemplate (below and in QuickCreatePanel)
// populates all of this, not just structured steps.
export type TemplateOption = {
  id: string;
  name: string;
  workoutType: WorkoutType | null;
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

export type ExistingScheduledWorkout = {
  id: string;
  scheduledDate: string;
  title: string | null; // legacy display-only field -- see getWorkoutDisplayLabel; not editable here
  workoutType: WorkoutType | null;
  dayLabel: string | null;
  sessionSlot: string | null;
  extras: WorkoutExtraInput[];
  notesFromCoach: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  plannedPaceReference: PaceReferenceKey | null;
  plannedPacePercentBasis: PaceReferenceKey | null;
  plannedPacePercentMin: number | null;
  plannedPacePercentMax: number | null;
  plannedVolumePercent: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  published: boolean;
  steps: StepInput[];
};

export function WorkoutForm({
  athleteId,
  templates,
  extraPresets,
  existing,
  defaultDate,
  onDone,
  onCancel,
  registerSave,
}: {
  athleteId: string;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  existing?: ExistingScheduledWorkout;
  defaultDate?: string;
  onDone: () => void;
  // Closing without an explicit Save click -- the caller decides what
  // that means (confirm-and-discard for a brand-new workout, auto-save
  // for an existing one being edited; see requestCloseEdit in
  // calendar-workout-editor.tsx), this component doesn't need to know
  // which.
  onCancel: () => void;
  // Hands the caller this render's current handleSubmit closure -- see
  // QuickCreatePanel's identical prop for the full reasoning.
  registerSave?: (save: () => void) => void;
}) {
  const [templateId, setTemplateId] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState(existing?.scheduledDate ?? defaultDate ?? "");
  const [dayLabel, setDayLabel] = useState(existing?.dayLabel ?? "");
  const [sessionSlot, setSessionSlot] = useState<string | null>(existing?.sessionSlot ?? null);
  const [extras, setExtras] = useState<WorkoutExtraInput[]>(existing?.extras ?? []);
  const [notesFromCoach, setNotesFromCoach] = useState(existing?.notesFromCoach ?? "");
  const { fieldProps: targetFieldProps, getPayload: getTargetPayload, resetTo: resetTargetFields } = useWorkoutTargetFields(existing);
  const [steps, setSteps] = useState<StepInput[]>(existing?.steps ?? []);
  const [publish, setPublish] = useState(existing?.published ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Gates the save when editing a workout that's already live and the
  // coach just unchecked Published -- an athlete may already be following
  // this workout, so unpublishing it needs an explicit confirm rather than
  // happening silently the moment Save is clicked (see saveScheduledWorkout's
  // own published_at: input.publish ? now() : null on the update path,
  // which otherwise does this unconditionally).
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  // Day-level percent-of-a-reference-pace target, mirroring program-day-
  // form.tsx's identical pattern exactly (see that file's own comments for
  // the full reasoning) -- previously the only caller of this trio at the
  // day level was ProgramDayForm; scheduled_workouts has carried these
  // columns since the fitness_estimates migration, but nothing let a coach
  // set one here (coaching-platform-audit/01 §5.1's "still open" gap).
  const [pacePercentBasis, setPacePercentBasis] = useState<PaceReferenceKey | null>(existing?.plannedPacePercentBasis ?? null);
  const [pacePercentMinInput, setPacePercentMinInput] = useState(
    existing?.plannedPacePercentMin != null ? String(existing.plannedPacePercentMin) : "",
  );
  const [pacePercentMaxInput, setPacePercentMaxInput] = useState(
    existing?.plannedPacePercentMax != null ? String(existing.plannedPacePercentMax) : "",
  );

  function onPacePercentBasisChange(value: PaceReferenceKey | null) {
    setPacePercentBasis(value);
    if (value) targetFieldProps.onPaceReferenceChange(null);
  }
  const wrappedTargetFieldProps = {
    ...targetFieldProps,
    onPaceReferenceChange(value: PaceReferenceKey | null) {
      targetFieldProps.onPaceReferenceChange(value);
      if (value) {
        setPacePercentBasis(null);
        setPacePercentMinInput("");
        setPacePercentMaxInput("");
      }
    },
  };

  // Applying a template now populates the whole prescription, not just
  // steps -- day label/session/extras (plain useState here) get set
  // directly, distance/duration/pace/HR/RPE go through the hook's own
  // resetTo (see use-workout-target-fields.ts) since those live as
  // formatted input strings the hook owns, not raw values this component
  // can set itself.
  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setDayLabel(template.dayLabel ?? "");
    setSessionSlot(template.sessionSlot);
    setExtras(template.extras);
    setSteps(template.steps);
    // Templates never carry a day-level percent-of-pace target (see
    // TemplateOption -- workout_templates has no matching columns), so
    // applying one always clears whatever percent target was set,
    // matching every other field here that a template's own value
    // overwrites rather than merges with.
    setPacePercentBasis(null);
    setPacePercentMinInput("");
    setPacePercentMaxInput("");
    resetTargetFields({
      plannedDistanceM: template.plannedDistanceM,
      plannedDistanceMaxM: template.plannedDistanceMaxM,
      plannedDurationS: template.plannedDurationS,
      plannedDurationMaxS: template.plannedDurationMaxS,
      plannedPaceSPerMi: template.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: template.plannedPaceMaxSPerMi,
      plannedPaceReference: template.plannedPaceReference,
      plannedVolumePercent: template.plannedVolumePercent,
      plannedHrBpm: template.plannedHrBpm,
      plannedHrMaxBpm: template.plannedHrMaxBpm,
      plannedRpe: template.plannedRpe,
      plannedRpeMax: template.plannedRpeMax,
    });
  }

  async function handleSubmit() {
    // A live workout going dark is the one transition worth stopping for
    // -- every other field change here just saves. confirmUnpublish being
    // true means the coach already clicked through the inline confirm
    // below, so this runs once more without re-triggering it.
    if (existing?.published && !publish && !confirmUnpublish) {
      setConfirmUnpublish(true);
      return;
    }
    setConfirmUnpublish(false);
    await performSave();
  }

  async function performSave() {
    setError(null);
    if (!scheduledDate) return setError("Pick a date.");
    const targetResult = getTargetPayload();
    if (!targetResult.ok) return setError(targetResult.error);

    const pacePercentMin = pacePercentBasis && pacePercentMinInput.trim() ? Number(pacePercentMinInput) : null;
    const pacePercentMax = pacePercentBasis && pacePercentMaxInput.trim() ? Number(pacePercentMaxInput) : null;
    if (pacePercentBasis && (pacePercentMin == null || pacePercentMax == null)) {
      return setError("Enter both a low and high percent.");
    }

    setIsPending(true);
    const input: ScheduledWorkoutInput = {
      id: existing?.id,
      athleteId,
      templateId: templateId || null,
      scheduledDate,
      // workout_type is no longer coach-editable here -- day_label is
      // private coaching's own vocabulary now (see day-vocabulary-fields.tsx).
      workoutType: existing?.workoutType ?? null,
      dayLabel: dayLabel.trim() || null,
      sessionSlot,
      extras,
      notesFromCoach: notesFromCoach.trim() || null,
      ...targetResult.data,
      // A percent-of-reference basis is mutually exclusive with a fixed
      // pace/reference (see DayVocabularyFields' own three-mode toggle) --
      // pacePercentBasis wins here; targetResult.data's own pace fields
      // are simply null whenever it's active (the hook's own exclusivity
      // guarantee already covers fixed-vs-reference), same pattern as
      // program-day-form.tsx's identical handleSubmit.
      plannedPaceReference: pacePercentBasis ? null : targetResult.data.plannedPaceReference,
      plannedPaceSPerMi: pacePercentBasis ? null : targetResult.data.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: pacePercentBasis ? null : targetResult.data.plannedPaceMaxSPerMi,
      plannedPacePercentBasis: pacePercentBasis,
      plannedPacePercentMin: pacePercentMin,
      plannedPacePercentMax: pacePercentMax,
      steps,
      publish,
    };
    const result = await saveScheduledWorkout(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    onDone();
  }

  // Re-registers every render so the ref always calls this render's
  // closure -- see QuickCreatePanel's identical effect for the full
  // reasoning.
  useEffect(() => {
    registerSave?.(handleSubmit);
  });

  return (
    <div className="space-y-4 rounded-control border border-black/10 p-4 dark:border-white/10">
      {!existing && templates.length > 0 ? (
        <label className="block">
          <span className={labelClass}>Start from a template</span>
          <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={fieldClass}>
            <option value="">-- Blank workout --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block max-w-xs">
        <span className={labelClass}>Date</span>
        <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={fieldClass} />
      </label>

      <DayVocabularyFields
        dayLabel={dayLabel}
        onDayLabelChange={setDayLabel}
        sessionSlot={sessionSlot}
        onSessionSlotChange={setSessionSlot}
        {...wrappedTargetFieldProps}
        allowPacePercent
        pacePercentBasis={pacePercentBasis}
        onPacePercentBasisChange={onPacePercentBasisChange}
        pacePercentMinInput={pacePercentMinInput}
        onPacePercentMinChange={setPacePercentMinInput}
        pacePercentMaxInput={pacePercentMaxInput}
        onPacePercentMaxChange={setPacePercentMaxInput}
      />

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Extras</p>
        <ExtrasEditor extras={extras} onChange={setExtras} presets={extraPresets} />
      </div>

      <label className="block">
        <span className={labelClass}>Notes to athlete</span>
        <textarea
          value={notesFromCoach ?? ""}
          onChange={(e) => setNotesFromCoach(e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Steps</p>
        <StepsEditor steps={steps} onChange={setSteps} />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={publish}
          onChange={(e) => {
            setPublish(e.target.checked);
            setConfirmUnpublish(false);
          }}
        />
        Published (visible to the athlete)
      </label>

      {error && <FormError>{error}</FormError>}

      {confirmUnpublish ? (
        // Inline, in-DOM confirm (same reasoning as InlineConfirmButton,
        // see that component's own header comment -- a native
        // window.confirm() is invisible to Playwright/automated drivers)
        // rather than a reused InlineConfirmButton instance: this gates
        // the whole Save routine (including the auto-save-on-close path
        // via registerSave), not a single standalone button click, so it
        // needs its own state instead of that component's self-contained
        // confirming/not-confirming toggle.
        <div className="rounded-control border border-accent-warning/40 bg-accent-warning/10 p-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            This workout is live on the athlete&rsquo;s schedule. Unpublish it?
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="text-sm font-semibold text-accent-error underline underline-offset-2 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Yes, unpublish and save"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setPublish(true);
                setConfirmUnpublish(false);
              }}
              className="text-sm font-semibold text-zinc-600 underline underline-offset-2 disabled:opacity-50 dark:text-zinc-300"
            >
              Keep published
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Saving…" : "Save workout"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
