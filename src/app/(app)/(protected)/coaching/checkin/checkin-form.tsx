"use client";

import { useId, useState } from "react";

import { submitCoachingCheckin } from "./actions";
import { useAutoSaveForm } from "@/lib/use-auto-save-form";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { AutoSaveStatus } from "@/components/ui/auto-save-status";

export type ExistingCheckin = {
  overallFeel: number;
  fatigue: number;
  soreness: number;
  sleepQuality: number;
  stress: number;
  pain: boolean;
  painNotes: string | null;
  biggestPositive: string | null;
  biggestConcern: string | null;
  scheduleConstraints: string | null;
  notes: string | null;
};

type RatingField = "overallFeel" | "fatigue" | "soreness" | "sleepQuality" | "stress";
// scaleHint anchors what 1 and 5 actually mean -- a bare 1-5 select gives
// no shared reference point between coach and athlete for what a 4 means,
// and fatigue/soreness in particular get confused for the same thing when
// neither is defined (fatigue is general depletion -- heavy legs, low
// energy, needing more recovery; soreness is localized muscle tenderness
// from training load -- you can have one without the other).
const RATING_FIELDS: { name: RatingField; label: string; scaleHint: string }[] = [
  { name: "overallFeel", label: "Overall training feel", scaleHint: "1 = rough week, 5 = felt strong" },
  {
    name: "fatigue",
    label: "Fatigue",
    scaleHint: "General tiredness/depletion, not muscle soreness -- 1 = fresh, 5 = drained",
  },
  {
    name: "soreness",
    label: "Soreness",
    scaleHint: "Muscle soreness specifically, separate from fatigue -- 1 = none, 5 = very sore",
  },
  { name: "sleepQuality", label: "Sleep quality", scaleHint: "1 = poor sleep, 5 = excellent sleep" },
  {
    name: "stress",
    label: "Stress",
    scaleHint: "Life stress outside of training (work, school, etc.) -- 1 = low, 5 = high",
  },
];

export function CheckinForm({ existing }: { existing: ExistingCheckin | null }) {
  const baseId = useId();
  const { state, formRef, isPending, scheduleSave, saveNow } = useAutoSaveForm(submitCoachingCheckin, {});
  const [pain, setPain] = useState(existing?.pain ?? false);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        saveNow();
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {RATING_FIELDS.map((f) => (
          <div key={f.name}>
            <label htmlFor={`${baseId}-${f.name}`} className={labelClass}>
              {f.label} (1-5)
            </label>
            <p className="mt-0.5 mb-1 text-xs text-zinc-500 dark:text-zinc-400">{f.scaleHint}</p>
            <select
              id={`${baseId}-${f.name}`}
              name={f.name}
              defaultValue={existing?.[f.name] ?? 3}
              onChange={scheduleSave}
              required
              className={fieldClass}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="pain"
          checked={pain}
          onChange={(e) => {
            setPain(e.target.checked);
            scheduleSave();
          }}
        />
        Something hurt this week
      </label>
      {pain ? (
        <div>
          <label htmlFor={`${baseId}-painNotes`} className={labelClass}>
            What, and where?
          </label>
          <input
            id={`${baseId}-painNotes`}
            name="painNotes"
            type="text"
            defaultValue={existing?.painNotes ?? ""}
            onBlur={scheduleSave}
            className={fieldClass}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-biggestPositive`} className={labelClass}>
            Biggest positive
          </label>
          <input
            id={`${baseId}-biggestPositive`}
            name="biggestPositive"
            type="text"
            defaultValue={existing?.biggestPositive ?? ""}
            onBlur={scheduleSave}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-biggestConcern`} className={labelClass}>
            Biggest concern
          </label>
          <input
            id={`${baseId}-biggestConcern`}
            name="biggestConcern"
            type="text"
            defaultValue={existing?.biggestConcern ?? ""}
            onBlur={scheduleSave}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${baseId}-scheduleConstraints`} className={labelClass}>
          Anything coming up that affects training? (travel, exams, work…)
        </label>
        <input
          id={`${baseId}-scheduleConstraints`}
          name="scheduleConstraints"
          type="text"
          defaultValue={existing?.scheduleConstraints ?? ""}
          onBlur={scheduleSave}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${baseId}-notes`} className={labelClass}>
          Anything else
        </label>
        <textarea
          id={`${baseId}-notes`}
          name="notes"
          defaultValue={existing?.notes ?? ""}
          rows={2}
          onBlur={scheduleSave}
          className={fieldClass}
        />
      </div>

      <AutoSaveStatus isPending={isPending} error={state.error} success={state.success} />
    </form>
  );
}
