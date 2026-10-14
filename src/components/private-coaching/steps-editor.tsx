"use client";

import { useState } from "react";

import {
  emptyStep,
  WORKOUT_STEP_TYPES,
  WORKOUT_STEP_TYPE_LABELS,
  WORKOUT_TARGET_TYPES,
  WORKOUT_TARGET_TYPE_LABELS,
  type StepInput,
  type WorkoutStepType,
  type WorkoutTargetType,
} from "@/lib/private-coaching/steps";
import { parseTimeToSeconds, formatClock } from "@/lib/running-format";
import { PACE_REFERENCE_KEYS, PACE_REFERENCE_LABELS, type PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

const PACE_UNITS = [
  { value: "sec_per_mile", label: "/mi" },
  { value: "sec_per_km", label: "/km" },
];

// Shared between workout templates and one-off scheduled workouts -- both
// tables store the exact same step shape (see the Phase 1 migration), so
// this is the one place that knows how to edit a step list, used from
// both the template form and the per-athlete schedule form.
//
// Every field's <label> wraps its control (rather than a separate
// htmlFor/id pair) -- this list re-indexes on add/remove/reorder, which
// would mean re-deriving a stable id per row per field; wrapping gets the
// same programmatic label association for free without that bookkeeping.
export function StepsEditor({
  steps,
  onChange,
  allowPacePercent = false,
}: {
  steps: StepInput[];
  onChange: (next: StepInput[]) => void;
  // Opt-in third pace-target mode for a step, mirroring DayVocabularyFields'
  // own allowPacePercent -- Program-only (program_day_steps). Off for every
  // current caller (templates, scheduled workouts).
  allowPacePercent?: boolean;
}) {
  function updateStep(index: number, patch: Partial<StepInput>) {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function addStep() {
    const lastType = steps.at(-1)?.stepType;
    const nextDefault: WorkoutStepType = lastType === "warmup" ? "main" : (lastType ?? "main");
    onChange([...steps, emptyStep(nextDefault)]);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <StepRow
          key={index}
          step={step}
          onUpdate={(patch) => updateStep(index, patch)}
          onRemove={() => removeStep(index)}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < steps.length - 1}
          allowPacePercent={allowPacePercent}
        />
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addStep}>
        + Add step
      </Button>
    </div>
  );
}

function StepRow({
  step,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  allowPacePercent = false,
}: {
  step: StepInput;
  onUpdate: (patch: Partial<StepInput>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  allowPacePercent?: boolean;
}) {
  const isPace = step.targetType === "pace";
  const pacePercentBasis = step.targetPacePercentBasis ?? null;
  // A warmup or cooldown is a single continuous effort, not a repeated set
  // with rest between reps -- unlike "interval" (the whole point of the
  // field) and "recovery" (which commonly shares its parent interval's own
  // rep count, e.g. a float-recovery leg repeated alongside it -- see
  // canyon-steps.ts's own recovery-with-repetitions entries). "main" stays
  // eligible too, since an occasional main effort genuinely is a few
  // repeated sets rather than one continuous block.
  const showRepsAndRest = step.stepType !== "warmup" && step.stepType !== "cooldown";

  function handleStepTypeChange(nextType: WorkoutStepType) {
    const nextShowRepsAndRest = nextType !== "warmup" && nextType !== "cooldown";
    onUpdate({
      stepType: nextType,
      repetitions: nextShowRepsAndRest ? step.repetitions : null,
      repetitionsMax: nextShowRepsAndRest ? step.repetitionsMax : null,
      restS: nextShowRepsAndRest ? step.restS : null,
      restMaxS: nextShowRepsAndRest ? step.restMaxS : null,
    });
  }

  function handleTargetTypeChange(nextType: WorkoutTargetType) {
    // A coach switching TO pace needs a real unit to format against --
    // default to /mi unless one of the two pace units is already set
    // (switching away and back to pace shouldn't lose a deliberate /km
    // choice). Switching away from pace leaves targetUnit alone; the free-
    // text Unit field below handles whatever the new type needs. A
    // reference only ever makes sense for target_type = 'pace' (DB CHECK
    // constraint) -- switching away clears it, same as the exclusivity
    // guard everywhere else this pattern appears.
    const nextUnit =
      nextType === "pace" && step.targetUnit !== "sec_per_mile" && step.targetUnit !== "sec_per_km"
        ? "sec_per_mile"
        : step.targetUnit;
    onUpdate({
      targetType: nextType,
      targetUnit: nextUnit,
      targetPaceReference: nextType === "pace" ? step.targetPaceReference : null,
      targetPacePercentBasis: nextType === "pace" ? step.targetPacePercentBasis : null,
      targetPacePercentMin: nextType === "pace" ? step.targetPacePercentMin : null,
      targetPacePercentMax: nextType === "pace" ? step.targetPacePercentMax : null,
    });
  }

  // Switching TO a reference clears whatever literal target (or percent)
  // was set -- mirrors DayVocabularyFields' onPaceReferenceChange exactly.
  function handleTargetPaceReferenceChange(value: PaceReferenceKey | null) {
    onUpdate({
      targetPaceReference: value,
      targetMin: value ? null : step.targetMin,
      targetMax: value ? null : step.targetMax,
      targetPacePercentBasis: value ? null : step.targetPacePercentBasis,
      targetPacePercentMin: value ? null : step.targetPacePercentMin,
      targetPacePercentMax: value ? null : step.targetPacePercentMax,
    });
  }

  // Switching TO a percent basis clears whatever literal target (or
  // reference) was set -- same one-mode-at-a-time discipline.
  function handleTargetPacePercentBasisChange(value: PaceReferenceKey | null) {
    onUpdate({
      targetPacePercentBasis: value,
      targetPaceReference: value ? null : step.targetPaceReference,
      targetMin: value ? null : step.targetMin,
      targetMax: value ? null : step.targetMax,
    });
  }

  return (
    <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <label>
          <span className="sr-only">Step type</span>
          <select
            value={step.stepType}
            onChange={(e) => handleStepTypeChange(e.target.value as WorkoutStepType)}
            className={`${fieldClass} w-40`}
          >
            {WORKOUT_STEP_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORKOUT_STEP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move step up"
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move step down"
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove step"
            className="rounded px-1.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Each min/max pair is its own row (2 columns, not 4) -- cramming
          all three pairs into one 4-across row left each field only ~1/4
          of the panel's width, which read as cramped/overlapping at
          typical panel widths. A row per pair keeps every field's own
          "to X, optional" companion directly beside it with real room. */}
      {showRepsAndRest ? (
        <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Repetitions</span>
            <input
              type="number"
              min={1}
              max={200}
              value={step.repetitions ?? ""}
              onChange={(e) => onUpdate({ repetitions: e.target.value ? Number(e.target.value) : null })}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Repetitions max</span>
            <input
              type="number"
              min={1}
              max={200}
              placeholder="optional"
              value={step.repetitionsMax ?? ""}
              onChange={(e) => onUpdate({ repetitionsMax: e.target.value ? Number(e.target.value) : null })}
              className={fieldClass}
            />
          </label>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Distance (mi)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={step.distanceM !== null ? (step.distanceM / 1609.344).toFixed(2) : ""}
            onChange={(e) => onUpdate({ distanceM: e.target.value ? Math.round(Number(e.target.value) * 1609.344) : null })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Distance max (mi)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="optional"
            value={step.distanceMaxM !== null ? (step.distanceMaxM / 1609.344).toFixed(2) : ""}
            onChange={(e) =>
              onUpdate({ distanceMaxM: e.target.value ? Math.round(Number(e.target.value) * 1609.344) : null })
            }
            className={fieldClass}
          />
        </label>
      </div>

      {showRepsAndRest ? (
        <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Rest (sec)</span>
            <input
              type="number"
              min={0}
              max={3600}
              value={step.restS ?? ""}
              onChange={(e) => onUpdate({ restS: e.target.value ? Number(e.target.value) : null })}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Rest max (sec)</span>
            <input
              type="number"
              min={0}
              max={3600}
              placeholder="optional"
              value={step.restMaxS ?? ""}
              onChange={(e) => onUpdate({ restMaxS: e.target.value ? Number(e.target.value) : null })}
              className={fieldClass}
            />
          </label>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Duration (min)</span>
          <input
            type="number"
            min={0}
            max={720}
            value={step.durationS !== null ? Math.round(step.durationS / 60) : ""}
            onChange={(e) => onUpdate({ durationS: e.target.value ? Number(e.target.value) * 60 : null })}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Duration max (min)</span>
          <input
            type="number"
            min={0}
            max={720}
            placeholder="optional"
            value={step.durationMaxS !== null ? Math.round(step.durationMaxS / 60) : ""}
            onChange={(e) => onUpdate({ durationMaxS: e.target.value ? Number(e.target.value) * 60 : null })}
            className={fieldClass}
          />
        </label>
      </div>

      {/* Target type gets its own full-width row rather than sharing a grid
          row with the content below it -- that content's shape varies too
          much (a plain 3-field row for most target types, vs. a short
          toggle-button row for "pace" that conditionally reveals a further
          3-field sub-grid), so trying to align it against Target type's
          single select column produced uneven, overlapping-looking rows. */}
      <label className="mt-3 block max-w-xs">
        <span className={labelClass}>Target type</span>
        <select
          value={step.targetType}
          onChange={(e) => handleTargetTypeChange(e.target.value as WorkoutTargetType)}
          className={fieldClass}
        >
          {WORKOUT_TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {WORKOUT_TARGET_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {isPace ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={labelClass}>Pace</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleTargetPaceReferenceChange(null)}
                className={`rounded-control border px-2 py-0.5 text-xs font-medium ${
                  !step.targetPaceReference && !pacePercentBasis
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-black/10 text-zinc-500 hover:border-black/20 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20"
                }`}
              >
                Fixed pace
              </button>
              <button
                type="button"
                onClick={() => handleTargetPaceReferenceChange(step.targetPaceReference ?? PACE_REFERENCE_KEYS[0])}
                className={`rounded-control border px-2 py-0.5 text-xs font-medium ${
                  step.targetPaceReference
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-black/10 text-zinc-500 hover:border-black/20 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20"
                }`}
              >
                Reference
              </button>
              {allowPacePercent ? (
                <button
                  type="button"
                  onClick={() => handleTargetPacePercentBasisChange(pacePercentBasis ?? PACE_REFERENCE_KEYS[0])}
                  className={`rounded-control border px-2 py-0.5 text-xs font-medium ${
                    pacePercentBasis
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                      : "border-black/10 text-zinc-500 hover:border-black/20 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20"
                  }`}
                >
                  % of pace
                </button>
              ) : null}
            </div>
          </div>
          {pacePercentBasis ? (
            <div className="mt-1.5 grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Reference</span>
                <select
                  value={pacePercentBasis}
                  onChange={(e) => onUpdate({ targetPacePercentBasis: e.target.value as PaceReferenceKey })}
                  className={fieldClass}
                >
                  {PACE_REFERENCE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {PACE_REFERENCE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Low %</span>
                <input
                  value={step.targetPacePercentMin ?? ""}
                  onChange={(e) => onUpdate({ targetPacePercentMin: e.target.value ? Number(e.target.value) : null })}
                  placeholder="90"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>High %</span>
                <input
                  value={step.targetPacePercentMax ?? ""}
                  onChange={(e) => onUpdate({ targetPacePercentMax: e.target.value ? Number(e.target.value) : null })}
                  placeholder="92"
                  className={fieldClass}
                />
              </label>
            </div>
          ) : step.targetPaceReference ? (
            <select
              value={step.targetPaceReference}
              onChange={(e) => handleTargetPaceReferenceChange(e.target.value as PaceReferenceKey)}
              className={`${fieldClass} mt-1.5 max-w-xs`}
            >
              {PACE_REFERENCE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PACE_REFERENCE_LABELS[key]}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1.5 grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
              <PaceInput label="Target min" seconds={step.targetMin} onCommit={(s) => onUpdate({ targetMin: s })} />
              <PaceInput label="Target max" seconds={step.targetMax} onCommit={(s) => onUpdate({ targetMax: s })} />
              <label className="block">
                <span className={labelClass}>Per</span>
                <select
                  value={step.targetUnit ?? "sec_per_mile"}
                  onChange={(e) => onUpdate({ targetUnit: e.target.value })}
                  className={fieldClass}
                >
                  {PACE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Target min</span>
            <input
              type="number"
              min={0}
              value={step.targetMin ?? ""}
              onChange={(e) => onUpdate({ targetMin: e.target.value ? Number(e.target.value) : null })}
              className={fieldClass}
              disabled={step.targetType === "open"}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Target max</span>
            <input
              type="number"
              min={0}
              value={step.targetMax ?? ""}
              onChange={(e) => onUpdate({ targetMax: e.target.value ? Number(e.target.value) : null })}
              className={fieldClass}
              disabled={step.targetType === "open"}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Unit</span>
            <input
              type="text"
              placeholder="bpm, watts…"
              value={step.targetUnit ?? ""}
              onChange={(e) => onUpdate({ targetUnit: e.target.value || null })}
              className={fieldClass}
              disabled={step.targetType === "open"}
            />
          </label>
        </div>
      )}

      <label className="mt-3 block">
        <span className={labelClass}>
          Instructions{" "}
          <span className="font-normal normal-case text-zinc-400">
            -- @athlete.key resolves to that athlete&rsquo;s own metric
          </span>
        </span>
        <input
          type="text"
          value={step.instructions ?? ""}
          onChange={(e) => onUpdate({ instructions: e.target.value || null })}
          placeholder="e.g. Hold @athlete.threshold_pace"
          className={fieldClass}
        />
      </label>
    </div>
  );
}

// A pace target needs mm:ss entry ("6:30", a range "6:30-6:45"), not a
// bare number of seconds -- but a fully-controlled input that reformats
// via formatClock(seconds) on every keystroke would fight a coach mid-type
// (typing "6:" parses to a real value, so a naive re-render would collapse
// it back to "6:00" before they can type the rest). This keeps its own
// text buffer and only resyncs from the numeric prop when the two
// genuinely disagree -- i.e. when something OTHER than this input's own
// onChange changed the value (a template applied, or this step got
// reordered/replaced) -- never while the buffer's own parse already
// matches what's being typed. Adjusted during render (React's own
// documented pattern for "resync state when a prop changes"), not an
// effect -- an effect would setState after the fact and cause an extra,
// visible re-render pass.
function PaceInput({ label, seconds, onCommit }: { label: string; seconds: number | null; onCommit: (seconds: number | null) => void }) {
  const [text, setText] = useState(() => (seconds != null ? formatClock(seconds) : ""));
  const [prevSeconds, setPrevSeconds] = useState(seconds);

  if (seconds !== prevSeconds) {
    setPrevSeconds(seconds);
    const parsed = text.trim() ? parseTimeToSeconds(text) : null;
    if (parsed !== seconds) setText(seconds != null ? formatClock(seconds) : "");
  }

  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="6:30"
        value={text}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          onCommit(value.trim() ? parseTimeToSeconds(value) : null);
        }}
        className={fieldClass}
      />
    </label>
  );
}
