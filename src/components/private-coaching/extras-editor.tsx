"use client";

import { useId, useState } from "react";

import { saveExtraPreset, type ExtraPresetOption } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions";
import {
  ALL_FIELDS_SHAPE,
  emptyExtra,
  getExtraFieldShape,
  isSuggestedExtraKind,
  SUGGESTED_EXTRA_KINDS,
  type WorkoutExtraInput,
} from "@/lib/private-coaching/extras";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

// Mirrors StepsEditor's row-array pattern (add/remove/reorder), one level
// down: an extra is richer than a flat tag (kind, overview, count/
// distance/duration, a named items list -- the drill-circuit case) and can
// be saved to / loaded from the coach's own reusable library
// (coach_extra_presets) instead of retyped every workout.
//
// Lives here (not under the schedule route) because it's shared by both
// the per-athlete schedule forms AND workout templates (see
// coaching/templates/template-form.tsx) -- same reasoning StepsEditor was
// already placed here for. saveExtraPreset/ExtraPresetOption still live in
// the schedule route's own actions.ts (coach_extra_presets isn't athlete-
// scoped, but that's where it was first built) -- imported by absolute
// path since this file no longer sits next to it.
export function ExtrasEditor({
  extras,
  onChange,
  presets,
}: {
  extras: WorkoutExtraInput[];
  onChange: (next: WorkoutExtraInput[]) => void;
  presets: ExtraPresetOption[];
}) {
  function updateExtra(index: number, patch: Partial<WorkoutExtraInput>) {
    onChange(extras.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function removeExtra(index: number) {
    onChange(extras.filter((_, i) => i !== index));
  }

  function addExtra() {
    onChange([...extras, emptyExtra()]);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= extras.length) return;
    const next = [...extras];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function loadPreset(index: number, presetId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    updateExtra(index, {
      kind: preset.kind,
      overview: preset.overview,
      count: preset.count,
      distanceM: preset.distanceM,
      durationS: preset.durationS,
      items: preset.items,
    });
  }

  return (
    <div className="space-y-3">
      {extras.map((extra, index) => (
        <ExtraRow
          key={index}
          extra={extra}
          presets={presets}
          onChange={(patch) => updateExtra(index, patch)}
          onRemove={() => removeExtra(index)}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          onLoadPreset={(presetId) => loadPreset(index, presetId)}
          canMoveUp={index > 0}
          canMoveDown={index < extras.length - 1}
        />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addExtra}>
        + Add extra
      </Button>
    </div>
  );
}

function ExtraRow({
  extra,
  presets,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onLoadPreset,
  canMoveUp,
  canMoveDown,
}: {
  extra: WorkoutExtraInput;
  presets: ExtraPresetOption[];
  onChange: (patch: Partial<WorkoutExtraInput>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onLoadPreset: (presetId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  // ExtraRow renders once per extra -- a workout with 2+ extras (e.g.
  // Strides and Drills together) mounts multiple rows at once, so this
  // row's own datalist previously used one hardcoded, shared id across
  // every row on the page, colliding the same way DayVocabularyFields'
  // own day-label/XT-type datalists did (see that file's own comment) --
  // the combobox bug QA found. useId() gives every row its own real id.
  const extraKindListId = `${useId()}-extra-kind-suggestions`;
  const [newItem, setNewItem] = useState("");
  const [presetName, setPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // "+ Add detail" for an unrecognized kind -- see the comment below.
  // Defaults to already-expanded if the extra already has that data
  // (editing an existing one shouldn't hide what's already there).
  const [detailExpanded, setDetailExpanded] = useState(
    () => extra.count != null || extra.distanceM != null || extra.durationS != null || extra.items.length > 0,
  );

  // Not every kind needs the same fields -- strides are reps x distance/
  // duration with no item list, while drills/mobility/plyos/strength are
  // an overview + a named list with no rep/distance/duration figure for
  // the whole thing. See extras.ts's own comment for the reasoning
  // (grounded in how the site's own Workout Library content describes
  // each).
  //
  // A kind outside the suggested list (hill sprints, mental techniques,
  // self-care, hips, core, anything a coach types) defaults to Overview
  // only -- most of these genuinely only need a note, and defaulting to
  // every structured field was the actual arbitrary-feeling behavior.
  // "+ Add detail" reveals the same fields Strides/Drills get, on demand,
  // for the cases that do want structure (reps for hill sprints, say) --
  // it's just never automatic for an unrecognized kind.
  const isRecognized = isSuggestedExtraKind(extra.kind);
  const shape = !isRecognized && detailExpanded ? ALL_FIELDS_SHAPE : getExtraFieldShape(extra.kind);
  const repFieldCount = [shape.showCount, shape.showDistance, shape.showDuration].filter(Boolean).length;
  // Stacks to one column below sm: regardless of how wide the modal
  // happens to be -- relying on modal width alone to keep 2-3 columns
  // from crowding is exactly the mistake that caused the original
  // StepsEditor overlap bug (see week-calendar.tsx's own comment on it).
  const repFieldGridClass =
    repFieldCount === 1 ? "grid-cols-1" : repFieldCount === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3";

  function addItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChange({ items: [...extra.items, trimmed] });
    setNewItem("");
  }

  function removeItem(i: number) {
    onChange({ items: extra.items.filter((_, idx) => idx !== i) });
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    setIsSavingPreset(true);
    setSaveMessage(null);
    const result = await saveExtraPreset({ name: presetName.trim(), ...extra });
    setIsSavingPreset(false);
    if (result.error) return setSaveMessage(result.error);
    setSaveMessage("Saved to your library.");
    setPresetName("");
  }

  return (
    <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <label className="flex-1">
          <span className="sr-only">Kind</span>
          <input
            list={extraKindListId}
            value={extra.kind}
            onChange={(e) => onChange({ kind: e.target.value })}
            placeholder="Strides, Drills, Plyos, Strength…"
            className={`${fieldClass} max-w-xs`}
          />
          <datalist id={extraKindListId}>
            {SUGGESTED_EXTRA_KINDS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move extra up"
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move extra down"
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove extra"
            className="rounded px-1.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>

      {presets.length > 0 ? (
        <label className="mt-2 block">
          <span className={labelClass}>Load from your library</span>
          <select value="" onChange={(e) => e.target.value && onLoadPreset(e.target.value)} className={`${fieldClass} max-w-xs`}>
            <option value="">-- Select a saved preset --</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mt-3 block">
        <span className={labelClass}>Overview</span>
        <textarea
          value={extra.overview ?? ""}
          onChange={(e) => onChange({ overview: e.target.value || null })}
          rows={2}
          placeholder="Do each drill 50m"
          className={fieldClass}
        />
      </label>

      {!isRecognized ? (
        <button
          type="button"
          onClick={() => setDetailExpanded((v) => !v)}
          className="mt-3 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {detailExpanded ? "Hide detail" : "+ Add detail (reps, distance, duration, a list…)"}
        </button>
      ) : null}

      {repFieldCount > 0 ? (
        <div className={`mt-3 grid ${repFieldGridClass} gap-3`}>
          {shape.showCount ? (
            <label className="block">
              <span className={labelClass}>How many</span>
              <input
                type="number"
                min={0}
                value={extra.count ?? ""}
                onChange={(e) => onChange({ count: e.target.value ? Number(e.target.value) : null })}
                className={fieldClass}
              />
            </label>
          ) : null}
          {shape.showDistance ? (
            <label className="block">
              <span className={labelClass}>Distance (m)</span>
              <input
                type="number"
                min={0}
                value={extra.distanceM ?? ""}
                onChange={(e) => onChange({ distanceM: e.target.value ? Number(e.target.value) : null })}
                className={fieldClass}
              />
            </label>
          ) : null}
          {shape.showDuration ? (
            <label className="block">
              <span className={labelClass}>Duration (sec)</span>
              <input
                type="number"
                min={0}
                value={extra.durationS ?? ""}
                onChange={(e) => onChange({ durationS: e.target.value ? Number(e.target.value) : null })}
                className={fieldClass}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {shape.showItems ? (
        <div className="mt-3">
          <span className={labelClass}>Items</span>
          {extra.items.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {extra.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1.5 flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="A skips x2…"
              className={`${fieldClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={addItem}
              className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Name this to save it…"
          className={`${fieldClass} max-w-xs`}
        />
        <button
          type="button"
          disabled={isSavingPreset || !presetName.trim()}
          onClick={handleSavePreset}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {isSavingPreset ? "Saving…" : "Save to my library"}
        </button>
        {saveMessage ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{saveMessage}</p> : null}
      </div>
    </div>
  );
}
