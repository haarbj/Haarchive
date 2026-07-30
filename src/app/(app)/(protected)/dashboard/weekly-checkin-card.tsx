"use client";

import { useActionState, useId, useState } from "react";

import { submitWeeklyCheckin } from "./actions";
import { fieldClass, labelClass } from "./form-constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type WeeklyCheckin = {
  fatigue: number;
  soreness: number;
  sleep_quality: number;
  stress: number;
  notes: string | null;
};

type RatingField = "fatigue" | "soreness" | "sleep_quality" | "stress";

const RATING_FIELDS: { name: RatingField; label: string }[] = [
  { name: "fatigue", label: "Fatigue" },
  { name: "soreness", label: "Soreness" },
  { name: "sleep_quality", label: "Sleep quality" },
  { name: "stress", label: "Stress" },
];

const FORM_NAMES: Record<RatingField, string> = {
  fatigue: "fatigue",
  soreness: "soreness",
  sleep_quality: "sleepQuality",
  stress: "stress",
};

function RatingSelect({ id, name, label, defaultValue }: { id: string; name: string; label: string; defaultValue?: number }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} (1–5)
      </label>
      <select id={id} name={name} defaultValue={defaultValue ?? 3} required className={fieldClass}>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}

export function WeeklyCheckinCard({ checkin }: { checkin: WeeklyCheckin | null }) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(submitWeeklyCheckin, {});
  const [editing, setEditing] = useState(!checkin);
  // Render-phase state adjustment (React's documented alternative to an
  // effect for "reset state when this other state changes") -- reacts to
  // a successful submit by switching back to the summary view, without
  // the extra effect-triggered render pass a useEffect version would add.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setEditing(false);
  }

  if (checkin && !editing) {
    return (
      <Card padding="sm" shadow={false}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">This week&rsquo;s check-in</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Edit
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          Fatigue {checkin.fatigue}/5 · Soreness {checkin.soreness}/5 · Sleep {checkin.sleep_quality}/5 · Stress{" "}
          {checkin.stress}/5
        </p>
        {checkin.notes && (
          <p className="mt-1 text-xs italic text-zinc-500 dark:text-zinc-400">&ldquo;{checkin.notes}&rdquo;</p>
        )}
      </Card>
    );
  }

  return (
    <Card padding="sm" shadow={false}>
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
        {checkin ? "Edit this week's check-in" : "How's this week going?"}
      </p>
      <form action={formAction} className="mt-3 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {RATING_FIELDS.map((f) => (
            <RatingSelect
              key={f.name}
              id={`${baseId}-${f.name}`}
              name={FORM_NAMES[f.name]}
              label={f.label}
              defaultValue={checkin?.[f.name]}
            />
          ))}
        </div>
        <div>
          <label htmlFor={`${baseId}-notes`} className={labelClass}>
            Notes (optional)
          </label>
          <input
            id={`${baseId}-notes`}
            name="notes"
            type="text"
            defaultValue={checkin?.notes ?? ""}
            placeholder="Anything else worth remembering about this week?"
            className={fieldClass}
          />
        </div>
        {state.error && <FormError>{state.error}</FormError>}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save check-in"}
          </Button>
          {checkin && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
