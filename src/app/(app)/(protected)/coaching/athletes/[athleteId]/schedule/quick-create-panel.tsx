"use client";

import { useEffect, useState } from "react";

import { saveScheduledWorkout, type ExtraPresetOption, type ScheduledWorkoutInput } from "./actions";
import type { ExistingScheduledWorkout, TemplateOption } from "./workout-form";
import { DayVocabularyFields } from "@/components/private-coaching/day-vocabulary-fields";
import { ExtrasEditor } from "@/components/private-coaching/extras-editor";
import { useWorkoutTargetFields } from "@/components/private-coaching/use-workout-target-fields";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { StepsEditor } from "@/components/private-coaching/steps-editor";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// The default entry point for planning a day -- deliberately a small
// subset of WorkoutForm's fields, in a strict order (day label/session,
// distance, extras, note, then steps/template as secondary,
// collapsed-by-default affordances) so a coach can log a plain "Easy 6 mi"
// in seconds without the structured-steps editor ever being visible, let
// alone required. "Edit full details" hands off to the existing full
// WorkoutForm for anyone who wants everything up front -- this doesn't
// replace that form, it's a faster on-ramp in front of it.
export function QuickCreatePanel({
  athleteId,
  scheduledDate,
  templates,
  extraPresets,
  existing,
  onDone,
  onCancel,
  registerSave,
  onEditFullDetails,
}: {
  athleteId: string;
  scheduledDate: string;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  existing?: ExistingScheduledWorkout;
  onDone: () => void;
  // Closing without an explicit Save click -- the caller decides what
  // that means (confirm-and-discard for a brand-new workout, auto-save
  // for an existing one being edited; see requestCloseQuickCreate in
  // calendar-workout-editor.tsx), this component doesn't need to know
  // which.
  onCancel: () => void;
  // Hands the caller this render's current handleSubmit closure, so
  // closing the overlay without an explicit Save click can still save
  // whatever's on screen for an existing workout -- see
  // calendar-workout-editor.tsx's own comment on why a ref (not lifting
  // this state up) is the right shape here.
  registerSave?: (save: () => void) => void;
  onEditFullDetails: () => void;
}) {
  const [dayLabel, setDayLabel] = useState(existing?.dayLabel ?? "");
  const [sessionSlot, setSessionSlot] = useState<string | null>(existing?.sessionSlot ?? null);
  const [extras, setExtras] = useState<WorkoutExtraInput[]>(existing?.extras ?? []);
  const { fieldProps: targetFieldProps, getPayload: getTargetPayload, resetTo: resetTargetFields } = useWorkoutTargetFields(existing);
  const [notesFromCoach, setNotesFromCoach] = useState(existing?.notesFromCoach ?? "");
  const [stepsOpen, setStepsOpen] = useState((existing?.steps.length ?? 0) > 0);
  const [steps, setSteps] = useState<StepInput[]>(existing?.steps ?? []);
  const [templateId, setTemplateId] = useState("");
  const [publish, setPublish] = useState(existing?.published ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Applying a template now populates the whole prescription, not just
  // steps -- see workout-form.tsx's identical applyTemplate for the same
  // reasoning (day label/session/extras set directly, distance/duration/
  // pace/HR/RPE via the hook's own resetTo).
  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setDayLabel(template.dayLabel ?? "");
    setSessionSlot(template.sessionSlot);
    setExtras(template.extras);
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
    if (template.steps.length > 0) {
      setSteps(template.steps);
      setStepsOpen(true);
    }
  }

  async function handleSubmit() {
    setError(null);
    const targetResult = getTargetPayload();
    if (!targetResult.ok) return setError(targetResult.error);

    setIsPending(true);
    const input: ScheduledWorkoutInput = {
      id: existing?.id,
      athleteId,
      templateId: templateId || null,
      scheduledDate: existing?.scheduledDate ?? scheduledDate,
      // workout_type is no longer coach-editable here -- day_label is
      // private coaching's own vocabulary now. Preserved as-is for a
      // pre-existing row rather than cleared, never set for a new one.
      workoutType: existing?.workoutType ?? null,
      dayLabel: dayLabel.trim() || null,
      sessionSlot,
      extras,
      notesFromCoach: notesFromCoach.trim() || null,
      ...targetResult.data,
      // This panel has no UI for the day-level percent-of-pace trio
      // (allowPacePercent isn't passed to DayVocabularyFields below --
      // deliberately, per this file's own "small subset" scope) -- pass
      // an existing workout's value straight through unchanged rather
      // than hard-coding null, which would silently erase a percent
      // target a coach set via the full WorkoutForm or received via
      // program assignment the moment they quick-edited anything else
      // about that same workout through this faster panel. Exactly the
      // D1-class bug this session has been closing elsewhere; not
      // reintroducing it here for a field this panel simply doesn't edit.
      plannedPacePercentBasis: existing?.plannedPacePercentBasis ?? null,
      plannedPacePercentMin: existing?.plannedPacePercentMin ?? null,
      plannedPacePercentMax: existing?.plannedPacePercentMax ?? null,
      steps,
      publish,
    };
    const result = await saveScheduledWorkout(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    onDone();
  }

  // Re-registers every render so the ref always calls this render's
  // closure -- i.e. whatever's currently in the form's fields, not a
  // stale snapshot from when the panel first opened.
  useEffect(() => {
    registerSave?.(handleSubmit);
  });

  return (
    <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{existing ? "Edit workout" : "Create workout"}</p>

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

      <label className="block">
        <span className={labelClass}>Coach note</span>
        <textarea value={notesFromCoach} onChange={(e) => setNotesFromCoach(e.target.value)} rows={2} className={fieldClass} />
      </label>

      <button
        type="button"
        onClick={() => setStepsOpen((v) => !v)}
        className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
      >
        {stepsOpen ? "Hide structured steps" : "+ Add structured steps"}
      </button>
      {stepsOpen ? (
        <div>
          <StepsEditor steps={steps} onChange={setSteps} />
        </div>
      ) : null}

      {templates.length > 0 ? (
        <label className="block">
          <span className={labelClass}>Template</span>
          <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={fieldClass}>
            <option value="">-- None --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        Published (visible to the athlete)
      </label>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save workout"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <button
          type="button"
          onClick={onEditFullDetails}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Edit full details
        </button>
      </div>
    </div>
  );
}
