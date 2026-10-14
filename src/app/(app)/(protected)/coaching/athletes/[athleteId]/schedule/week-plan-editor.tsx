"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { saveWeekPlan } from "./actions";
import { addDays } from "@/lib/week";
import { formatDate } from "@/lib/format";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type WeekPlanValues = {
  label: string | null;
  targetVolumeMin: number | null;
  targetVolumeMax: number | null;
  targetVolumeUnit: "miles" | "minutes" | null;
};

// "35–40 miles" / "35 miles" -- the one place this wording lives, shared
// by this editor's own read-only line and MonthView's per-week summary
// column, so the two can't quietly drift into different phrasing for the
// same coach-set target. Null when no target has been set at all -- never
// a fabricated "0."
export function formatTargetVolume(values: Pick<WeekPlanValues, "targetVolumeMin" | "targetVolumeMax" | "targetVolumeUnit">): string | null {
  if (values.targetVolumeMin == null) return null;
  const range =
    values.targetVolumeMax != null && values.targetVolumeMax !== values.targetVolumeMin
      ? `${values.targetVolumeMin}–${values.targetVolumeMax}`
      : `${values.targetVolumeMin}`;
  return `${range} ${values.targetVolumeUnit ?? "miles"}`;
}

// The actual editable fields + save call -- shared by WeekPlanEditor's own
// inline toggle (Week View's header) and WeekPlanQuickEditModal (Month
// View's per-week quick edit, below), so the fields/validation/save logic
// exist in exactly one place rather than drifting between an inline and a
// modal copy. `onSaved`/`onCancel` are the caller's own close behavior --
// this component has no opinion on whether that means collapsing back to a
// summary line or closing an overlay.
export function WeekPlanForm({
  athleteId,
  weekStart,
  initial,
  onSaved,
  onCancel,
}: {
  athleteId: string;
  weekStart: string;
  initial: WeekPlanValues;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial.label ?? "");
  const [targetMin, setTargetMin] = useState(initial.targetVolumeMin != null ? String(initial.targetVolumeMin) : "");
  const [targetMax, setTargetMax] = useState(initial.targetVolumeMax != null ? String(initial.targetVolumeMax) : "");
  const [unit, setUnit] = useState<"miles" | "minutes">(initial.targetVolumeUnit ?? "miles");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSave() {
    setError(null);
    const min = targetMin.trim() ? Number(targetMin) : null;
    const max = targetMax.trim() ? Number(targetMax) : null;
    if (min !== null && Number.isNaN(min)) return setError("Enter the target minimum as a number.");
    if (max !== null && Number.isNaN(max)) return setError("Enter the target maximum as a number.");
    if (max !== null && min === null) return setError("Enter a minimum before a maximum.");
    if (max !== null && min !== null && max < min) return setError("Target maximum can't be less than the minimum.");

    setIsPending(true);
    const result = await saveWeekPlan({
      athleteId,
      weekStart,
      label: label.trim() || null,
      targetVolumeMin: min,
      targetVolumeMax: max,
      targetVolumeUnit: min !== null ? unit : null,
    });
    setIsPending(false);
    if (result.error) return setError(result.error);
    onSaved();
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className={labelClass}>Week title</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Intro to Threshold"
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className={labelClass}>Target min</span>
          <input value={targetMin} onChange={(e) => setTargetMin(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Target max</span>
          <input value={targetMax} onChange={(e) => setTargetMax(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Unit</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as "miles" | "minutes")} className={fieldClass}>
            <option value="miles">Miles</option>
            <option value="minutes">Minutes</option>
          </select>
        </label>
      </div>
      {error && <FormError>{error}</FormError>}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Mount with key={week} from the page (same reasoning as WeekCalendar):
// this holds local state seeded from server props, and a plain
// ?week=... navigation wouldn't otherwise remount it.
export function WeekPlanEditor({ athleteId, weekStart, initial }: { athleteId: string; weekStart: string; initial: WeekPlanValues }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const hasContent = !!initial.label || initial.targetVolumeMin != null;

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        {initial.label ? (
          <p className="text-sm font-semibold tracking-wide text-zinc-700 uppercase dark:text-zinc-200">{initial.label}</p>
        ) : null}
        {initial.targetVolumeMin != null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Target: {formatTargetVolume(initial)}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {hasContent ? "Edit week plan" : "+ Add week title / target"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-md rounded-control border border-black/10 p-3 dark:border-white/10">
      <WeekPlanForm
        athleteId={athleteId}
        weekStart={weekStart}
        initial={initial}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
        onCancel={() => setEditing(false)}
      />
    </div>
  );
}

// Month View's own quick-edit -- clicking a week's totals in the summary
// column opens this instead of navigating to Week View, the exact same
// "edit without leaving the page you're on" pattern
// useCalendarWorkoutEditor already gives individual days (same overlay
// markup: fixed inset-0 backdrop, centered card, X close button). Full
// Week View navigation is still available via the cell's own title/target
// text -- this is an additional, faster path alongside it, not a
// replacement.
export function WeekPlanQuickEditModal({
  athleteId,
  weekStart,
  initial,
  onClose,
}: {
  athleteId: string;
  weekStart: string;
  initial: WeekPlanValues;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-black/10 bg-white p-4 shadow-modal dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Week plan</p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
              {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3">
          <WeekPlanForm
            athleteId={athleteId}
            weekStart={weekStart}
            initial={initial}
            onSaved={() => {
              onClose();
              router.refresh();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
