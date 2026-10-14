"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { savePhaseDefinition, type PhaseDefinitionInput } from "../actions";
import { SUGGESTED_PHASE_TYPES } from "@/lib/private-coaching/training-phases";
import { defaultPhaseExplainer } from "@/lib/private-coaching/phase-explainers";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type ExistingPhaseDefinition = {
  id: string;
  phaseKey: string;
  name: string | null;
  durationWeeksMin: number;
  durationWeeksMax: number;
  isOptional: boolean;
  notes: string | null;
  explainer: string | null;
};

// phaseKey is free text (datalist-suggested, never a closed enum) -- the
// same "real coaching vocabulary isn't a closed set" convention
// training_phases.phase_type already established. durationWeeksMin/Max is a
// RANGE, not a fixed count: this is what lets an optional Base Phase's own
// 2-8 week flexibility and a required phase's fixed 10-week length both be
// expressed with the one mechanism (see the plan's own "one Program,
// multiple duration variants" architecture note).
export function PhaseDefinitionForm({
  programId,
  existing,
  onDone,
  onCancel,
}: {
  programId: string;
  existing?: ExistingPhaseDefinition;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [phaseKey, setPhaseKey] = useState(existing?.phaseKey ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [durationWeeksMin, setDurationWeeksMin] = useState(existing ? String(existing.durationWeeksMin) : "");
  const [durationWeeksMax, setDurationWeeksMax] = useState(existing ? String(existing.durationWeeksMax) : "");
  const [isOptional, setIsOptional] = useState(existing?.isOptional ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [explainer, setExplainer] = useState(existing?.explainer ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // The standard copy for whichever phase the coach has typed, offered as
  // a starting point rather than silently prefilled -- a coach who wants
  // their own words shouldn't have to delete ours first.
  const standardExplainer = defaultPhaseExplainer(phaseKey);

  function updateMin(value: string) {
    setDurationWeeksMin(value);
    if (!durationWeeksMax.trim()) setDurationWeeksMax(value);
  }

  async function handleSubmit() {
    setError(null);
    if (!phaseKey.trim()) return setError("Give this phase a name.");
    const min = Number(durationWeeksMin);
    if (!Number.isFinite(min) || min < 1) return setError("Minimum weeks must be at least 1.");
    const max = durationWeeksMax.trim() ? Number(durationWeeksMax) : min;
    if (!Number.isFinite(max) || max < min) return setError("Maximum weeks can't be less than the minimum.");

    setIsPending(true);
    const input: PhaseDefinitionInput = {
      id: existing?.id,
      programId,
      phaseKey,
      name: name.trim() || null,
      durationWeeksMin: min,
      durationWeeksMax: max,
      isOptional,
      notes: notes.trim() || null,
      explainer: explainer.trim() || null,
    };
    const result = await savePhaseDefinition(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    onDone();
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Phase</span>
          <input
            list="phase-key-suggestions"
            value={phaseKey}
            onChange={(e) => setPhaseKey(e.target.value)}
            placeholder="General, Supportive, Specific…"
            className={fieldClass}
          />
          <datalist id="phase-key-suggestions">
            {SUGGESTED_PHASE_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={labelClass}>Display name, optional</span>
          <input
            value={name ?? ""}
            onChange={(e) => setName(e.target.value)}
            placeholder="Leave blank to just show the phase name above"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Minimum weeks</span>
          <input type="number" min={1} value={durationWeeksMin} onChange={(e) => updateMin(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Maximum weeks</span>
          <input
            type="number"
            min={1}
            value={durationWeeksMax}
            onChange={(e) => setDurationWeeksMax(e.target.value)}
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Equal to the minimum for a fixed-length phase, or wider for a phase whose length varies by plan length or
            athlete (e.g. an optional Base Phase).
          </p>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)} className="h-4 w-4" />
        Optional -- a coach chooses whether to include this phase when assigning to an athlete
      </label>

      <label className="block">
        <span className={labelClass}>Notes, optional</span>
        <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass} />
      </label>

      {/* Unlike Notes (authoring reference for the coach), this is written
          FOR the athlete: it's what they read under "Why this phase?" on
          their own training roadmap. It's copied onto their phase at
          assignment time, so editing it here changes future assignments
          rather than anyone's current training (a resync is the way to push
          a correction to an athlete already on this program). */}
      <label className="block">
        <span className={labelClass}>Why this phase, shown to the athlete</span>
        <textarea
          value={explainer ?? ""}
          onChange={(e) => setExplainer(e.target.value)}
          rows={8}
          placeholder="What this phase is for, the capabilities it builds, what the paces are based on, and how to approach it. Blank lines separate paragraphs."
          className={fieldClass}
        />
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Copied onto an athlete&rsquo;s phase when you assign this program. Leave blank to use the standard explanation
            for this phase.
          </p>
          {standardExplainer && explainer.trim() !== standardExplainer ? (
            <button
              type="button"
              onClick={() => setExplainer(standardExplainer)}
              className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Start from the standard {phaseKey.trim().toLowerCase()} explanation
            </button>
          ) : null}
        </div>
      </label>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save phase"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
