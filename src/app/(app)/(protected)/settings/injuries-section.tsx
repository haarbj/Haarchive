"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";

import { formatDate } from "@/lib/format";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { addInjury, deleteInjury, updateInjury } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const fieldClass = `w-full ${baseFieldClass}`;
const dateFieldClass = `${fieldClass} [&::-webkit-calendar-picker-indicator]:dark:invert`;

const SEVERITIES = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

export type InjuryRow = {
  id: string;
  injury_type: string;
  body_part: string;
  start_date: string;
  end_date: string | null;
  severity: "mild" | "moderate" | "severe";
  affects_training: boolean;
  notes: string | null;
};

function InjuryFields({
  baseId,
  today,
  defaults,
}: {
  baseId: string;
  today: string;
  defaults?: InjuryRow;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-type`} className={labelClass}>
            Injury
          </label>
          <input
            id={`${baseId}-type`}
            name="injuryType"
            type="text"
            placeholder="Shin splints"
            defaultValue={defaults?.injury_type}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-part`} className={labelClass}>
            Body part
          </label>
          <input
            id={`${baseId}-part`}
            name="bodyPart"
            type="text"
            placeholder="Left shin"
            defaultValue={defaults?.body_part}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-start`} className={labelClass}>
            Start date
          </label>
          <input
            id={`${baseId}-start`}
            name="startDate"
            type="date"
            max={today}
            defaultValue={defaults?.start_date}
            required
            className={dateFieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-end`} className={labelClass}>
            End date (leave blank if ongoing)
          </label>
          <input
            id={`${baseId}-end`}
            name="endDate"
            type="date"
            defaultValue={defaults?.end_date ?? ""}
            className={dateFieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${baseId}-severity`} className={labelClass}>
            Severity
          </label>
          <select
            id={`${baseId}-severity`}
            name="severity"
            defaultValue={defaults?.severity ?? "mild"}
            className={fieldClass}
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id={`${baseId}-affects`}
            name="affectsTraining"
            type="checkbox"
            defaultChecked={defaults?.affects_training ?? true}
            className="h-4 w-4 rounded border-black/20 dark:border-white/20"
          />
          <label htmlFor={`${baseId}-affects`} className="text-sm text-zinc-700 dark:text-zinc-200">
            Currently affecting training
          </label>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${baseId}-notes`} className={labelClass}>
            Notes (optional)
          </label>
          <textarea
            id={`${baseId}-notes`}
            name="notes"
            rows={2}
            defaultValue={defaults?.notes ?? ""}
            className={fieldClass}
          />
        </div>
      </div>
    </>
  );
}

function EditInjuryForm({ injury, onCancel, onSaved }: { injury: InjuryRow; onCancel: () => void; onSaved: () => void }) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(updateInjury, {});
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <Card padding="sm" shadow={false}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="injuryId" value={injury.id} />
        <InjuryFields baseId={baseId} today={today} defaults={injury} />

        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function InjuryCard({ injury }: { injury: InjuryRow }) {
  const [editing, setEditing] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  if (editing) {
    return <EditInjuryForm injury={injury} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />;
  }

  return (
    <Card padding="sm" shadow={false} className="flex items-center justify-between gap-3 text-sm">
      <div>
        <span className="font-medium text-zinc-900 dark:text-white">{injury.injury_type}</span>{" "}
        <span className="text-zinc-600 dark:text-zinc-300">
          {injury.body_part} · {SEVERITIES.find((s) => s.value === injury.severity)?.label} ·{" "}
          {formatDate(injury.start_date)}
          {injury.end_date ? ` – ${formatDate(injury.end_date)}` : " – ongoing"}
        </span>
        {injury.affects_training && (
          <span className="ml-2 inline-flex items-center rounded-pill bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-700 uppercase dark:bg-amber-400/10 dark:text-amber-300">
            Affecting training
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => startDeleteTransition(() => deleteInjury(injury.id))}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {isDeleting ? "Removing…" : "Remove"}
        </button>
      </div>
    </Card>
  );
}

export function InjuriesSection({ injuries }: { injuries: InjuryRow[] }) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(addInjury, {});
  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(injuries.length === 0);

  return (
    <div className="space-y-5">
      {injuries.length > 0 && (
        <div className="space-y-2">
          {injuries.map((injury) => (
            <InjuryCard key={injury.id} injury={injury} />
          ))}
        </div>
      )}

      {showForm ? (
        <form action={formAction} className="space-y-4 rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <InjuryFields baseId={baseId} today={today} />

          {state.error && (
            <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add injury"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
        >
          + Log an injury
        </button>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        This stays private to you: it&rsquo;s never shown to your coach or on your public profile.
      </p>
    </div>
  );
}
