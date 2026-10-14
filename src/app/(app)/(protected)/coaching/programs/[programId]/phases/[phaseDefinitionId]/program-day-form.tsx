"use client";

import { useState } from "react";

import { saveProgramDay, type ProgramDayInput } from "../../../actions";
import type { StepInput } from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { DayVocabularyFields } from "@/components/private-coaching/day-vocabulary-fields";
import { ExtrasEditor } from "@/components/private-coaching/extras-editor";
import { StepsEditor } from "@/components/private-coaching/steps-editor";
import { useWorkoutTargetFields } from "@/components/private-coaching/use-workout-target-fields";
import type { ExtraPresetOption } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type ExistingProgramDay = {
  id: string;
  dayLabel: string | null;
  sessionSlot: string | null;
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  paceReference: PaceReferenceKey | null;
  pacePercentBasis: PaceReferenceKey | null;
  pacePercentMin: number | null;
  pacePercentMax: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
  isEventDay: boolean;
  notes: string | null;
  /**
   * Seeded-framework attributes, shown in the authoring grid but not yet
   * editable here: a session the framework itself marks optional, the
   * framework's stated single-session substitute for a double-threshold
   * day or special block, and its published difficulty rating verbatim
   * ("8.5-9/10", which planned_rpe cannot hold). saveProgramDay does a
   * PARTIAL update that never lists these columns, so editing a seeded day
   * through this form preserves them rather than clearing them.
   */
  isOptional: boolean;
  alternativeText: string | null;
  difficultyLabel: string | null;
  extras: WorkoutExtraInput[];
  steps: StepInput[];
};

// The direct Program analog of template-form.tsx, one week/day slot at a
// time -- same DayVocabularyFields + ExtrasEditor + StepsEditor vocabulary,
// with allowPacePercent turned on (Canyon's own "50-60% 5K pace" / "90-92%
// MP" prescriptions need this; templates/scheduled workouts never do, see
// those components' own allowPacePercent comments) plus one Program-only
// field: "This is race day" (is_event_day).
export function ProgramDayForm({
  programId,
  phaseDefinitionId,
  weekNumber,
  dayOfWeek,
  existing,
  extraPresets,
  onDone,
  onCancel,
}: {
  programId: string;
  phaseDefinitionId: string;
  weekNumber: number;
  dayOfWeek: number;
  existing?: ExistingProgramDay;
  extraPresets: ExtraPresetOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [dayLabel, setDayLabel] = useState(existing?.dayLabel ?? "");
  const [sessionSlot, setSessionSlot] = useState<string | null>(existing?.sessionSlot ?? null);
  const [extras, setExtras] = useState<WorkoutExtraInput[]>(existing?.extras ?? []);
  const { fieldProps: targetFieldProps, getPayload: getTargetPayload } = useWorkoutTargetFields(existing);
  const [steps, setSteps] = useState<StepInput[]>(existing?.steps ?? []);
  const [isEventDay, setIsEventDay] = useState(existing?.isEventDay ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const [pacePercentBasis, setPacePercentBasis] = useState<PaceReferenceKey | null>(existing?.pacePercentBasis ?? null);
  const [pacePercentMinInput, setPacePercentMinInput] = useState(existing?.pacePercentMin != null ? String(existing.pacePercentMin) : "");
  const [pacePercentMaxInput, setPacePercentMaxInput] = useState(existing?.pacePercentMax != null ? String(existing.pacePercentMax) : "");

  // Switching TO a percent basis clears whatever fixed pace/reference the
  // hook holds; switching TO a fixed pace/reference (via the wrapped
  // onPaceReferenceChange below) clears the percent basis -- the same
  // one-mode-at-a-time discipline DayVocabularyFields' three buttons
  // already enforce visually.
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

  async function handleSubmit() {
    setError(null);
    const targetResult = getTargetPayload();
    if (!targetResult.ok) return setError(targetResult.error);

    const pacePercentMin = pacePercentBasis && pacePercentMinInput.trim() ? Number(pacePercentMinInput) : null;
    const pacePercentMax = pacePercentBasis && pacePercentMaxInput.trim() ? Number(pacePercentMaxInput) : null;
    if (pacePercentBasis && (pacePercentMin == null || pacePercentMax == null)) {
      return setError("Enter both a low and high percent.");
    }

    setIsPending(true);
    const input: ProgramDayInput = {
      id: existing?.id,
      programId,
      phaseDefinitionId,
      weekNumber,
      dayOfWeek,
      dayLabel: dayLabel.trim() || null,
      sessionSlot,
      // A percent-of-reference basis is mutually exclusive with a fixed
      // pace/reference (see DayVocabularyFields' own three-mode toggle) --
      // pacePercentBasis wins here; targetResult.data's own pace fields are
      // simply null whenever it's active (the hook's own exclusivity
      // guarantee already covers fixed-vs-reference).
      ...targetResult.data,
      paceReference: pacePercentBasis ? null : targetResult.data.plannedPaceReference,
      plannedPaceSPerMi: pacePercentBasis ? null : targetResult.data.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: pacePercentBasis ? null : targetResult.data.plannedPaceMaxSPerMi,
      pacePercentBasis,
      pacePercentMin,
      pacePercentMax,
      isEventDay,
      notes: notes.trim() || null,
      steps,
      extras,
    };
    const result = await saveProgramDay(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    onDone();
  }

  return (
    <div className="space-y-6 rounded-control border border-black/10 p-4 dark:border-white/10">
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

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={isEventDay} onChange={(e) => setIsEventDay(e.target.checked)} className="h-4 w-4" />
        This is race day
      </label>

      <label className="block">
        <span className={labelClass}>Notes, optional</span>
        <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass} />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Extras</p>
        <ExtrasEditor extras={extras} onChange={setExtras} presets={extraPresets} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">Steps</p>
        <StepsEditor steps={steps} onChange={setSteps} allowPacePercent />
      </div>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save day"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};
