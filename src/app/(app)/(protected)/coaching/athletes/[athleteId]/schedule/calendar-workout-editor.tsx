"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import type { ExtraPresetOption } from "./actions";
import type { CalendarWorkout } from "./calendar-types";
import { QuickCreatePanel } from "./quick-create-panel";
import { WorkoutForm, type TemplateOption } from "./workout-form";

type EditTarget = { date: string; workout: CalendarWorkout | null };
type QuickCreateTarget = { date: string; workout: CalendarWorkout | null };

// The create/edit modal machinery -- extracted from week-calendar.tsx so
// both WeekCalendar and DayView can mount it and get identical Edit/+Add
// behavior (an ordinary no-steps workout opens the small QuickCreatePanel;
// a workout with structured steps, or QuickCreatePanel's own "Edit full
// details" escape hatch, opens the full WorkoutForm) without duplicating
// this ~150-line block. Returns an imperative API (openCreate/openEdit)
// plus the modal JSX itself to render once in the caller's own tree --
// the caller supplies the click handlers (a grid cell's "+ Add", a
// WorkoutCard's "Edit"), this owns the overlay state and save/cancel
// plumbing.
export function useCalendarWorkoutEditor({
  athleteId,
  templates,
  extraPresets,
}: {
  athleteId: string;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
}) {
  const router = useRouter();
  const [quickCreateTarget, setQuickCreateTarget] = useState<QuickCreateTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // The form itself owns the save routine (it's the thing with the field
  // state); this ref is how "the coach closed the overlay without
  // clicking Save" gets routed into that same routine instead of a
  // separate discard path -- see requestCloseQuickCreate/requestCloseEdit.
  const quickCreateSaveRef = useRef<(() => void) | null>(null);
  const editSaveRef = useRef<(() => void) | null>(null);

  // A workout's own existing data, shaped for either QuickCreatePanel or
  // WorkoutForm's identical `existing` prop (same ExistingScheduledWorkout
  // type, see workout-form.tsx) -- shared so quick-edit and "Edit full
  // details" never map this differently.
  function toExistingScheduledWorkout(workout: CalendarWorkout) {
    return {
      id: workout.id,
      scheduledDate: workout.scheduledDate,
      title: workout.title,
      workoutType: workout.workoutType,
      dayLabel: workout.dayLabel,
      sessionSlot: workout.sessionSlot,
      extras: workout.extras,
      notesFromCoach: workout.notesFromCoach,
      plannedDistanceM: workout.plannedDistanceM,
      plannedDistanceMaxM: workout.plannedDistanceMaxM,
      plannedDurationS: workout.plannedDurationS,
      plannedDurationMaxS: workout.plannedDurationMaxS,
      plannedPaceSPerMi: workout.plannedPaceSPerMi,
      plannedPaceMaxSPerMi: workout.plannedPaceMaxSPerMi,
      // The raw, round-tripping value -- never workout.resolvedPace*,
      // which is display-only (see calendar-types.ts's own comment). The
      // edit form must always reopen showing exactly what's stored: a
      // reference stays "Reference: X," never a stale resolved number.
      plannedPaceReference: workout.paceReference,
      // Same "raw, round-tripping value" rule again -- never
      // workout.resolvedPace*, for the same reason as paceReference above.
      plannedPacePercentBasis: workout.pacePercentBasis,
      plannedPacePercentMin: workout.pacePercentMin,
      plannedPacePercentMax: workout.pacePercentMax,
      // Same "raw, round-tripping value" rule as pace above -- never
      // workout.resolvedDistanceM/resolvedDurationS, which are
      // display-only. The edit form must always reopen showing "% of
      // week: X," never a stale resolved number.
      plannedVolumePercent: workout.volumePercent,
      plannedHrBpm: workout.plannedHrBpm,
      plannedHrMaxBpm: workout.plannedHrMaxBpm,
      plannedRpe: workout.plannedRpe,
      plannedRpeMax: workout.plannedRpeMax,
      published: !!workout.publishedAt,
      steps: workout.steps,
    };
  }

  // Closing a brand-new, never-saved workout (backdrop click or the X
  // button) has real work to lose and nothing to save it to -- confirm
  // first, matching ConfirmButton's own confirm-before-discard convention
  // elsewhere on this page (Delete). Closing an EXISTING workout is
  // different: a coach who opens one just to look, then closes it, should
  // never see a discard prompt for changes they never made -- see
  // requestCloseQuickCreate/requestCloseEdit below, which route that case
  // to an auto-save instead.
  function confirmDiscard(close: () => void) {
    if (window.confirm("Discard this workout? Anything you've entered so far will be lost.")) close();
  }

  function openCreate(date: string) {
    setQuickCreateTarget({ date, workout: null });
  }

  function openEdit(date: string, workout: CalendarWorkout) {
    if (workout.steps.length > 0) setEditTarget({ date, workout });
    else setQuickCreateTarget({ date, workout });
  }

  // Closing without an explicit Save click: a new workout has nothing
  // persisted yet, so it still confirms before discarding (unchanged). An
  // existing workout being edited auto-saves via the form's own current
  // save routine (registered into the ref below) instead -- whatever's on
  // screen, changed or not, is what gets written, exactly like clicking
  // Save would have.
  function requestCloseQuickCreate() {
    if (quickCreateTarget?.workout) quickCreateSaveRef.current?.();
    else confirmDiscard(() => setQuickCreateTarget(null));
  }
  function requestCloseEdit() {
    if (editTarget?.workout) editSaveRef.current?.();
    else confirmDiscard(() => setEditTarget(null));
  }

  const editorModals = (
    <>
      {/* Both panels render as a centered overlay, never inline inside a
          narrow day column/list row -- WorkoutForm/QuickCreatePanel's own
          responsive grids (sm:grid-cols-3/4) key off VIEWPORT width, not
          their immediate container's width, so embedding either directly
          blows up into severely overlapping fields the moment the
          viewport itself is wide enough to trigger them. */}
      {quickCreateTarget ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseQuickCreate();
          }}
        >
          <div className="w-full max-w-3xl rounded-card border border-black/10 bg-white p-1 shadow-modal dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-center justify-end px-3 pt-2">
              <button
                type="button"
                onClick={requestCloseQuickCreate}
                aria-label="Close"
                className="text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3 pb-3">
              <QuickCreatePanel
                athleteId={athleteId}
                scheduledDate={quickCreateTarget.date}
                templates={templates}
                extraPresets={extraPresets}
                existing={quickCreateTarget.workout ? toExistingScheduledWorkout(quickCreateTarget.workout) : undefined}
                onDone={() => {
                  setQuickCreateTarget(null);
                  router.refresh();
                }}
                onCancel={requestCloseQuickCreate}
                registerSave={(save) => {
                  quickCreateSaveRef.current = save;
                }}
                onEditFullDetails={() => {
                  const target = quickCreateTarget;
                  setQuickCreateTarget(null);
                  if (target) setEditTarget({ date: target.date, workout: target.workout });
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseEdit();
          }}
        >
          <div className="w-full max-w-4xl rounded-card border border-black/10 bg-white p-1 shadow-modal dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-center justify-end px-3 pt-2">
              <button
                type="button"
                onClick={requestCloseEdit}
                aria-label="Close"
                className="text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3 pb-3">
              <WorkoutForm
                athleteId={athleteId}
                templates={templates}
                extraPresets={extraPresets}
                defaultDate={editTarget.date}
                existing={editTarget.workout ? toExistingScheduledWorkout(editTarget.workout) : undefined}
                onDone={() => {
                  setEditTarget(null);
                  router.refresh();
                }}
                onCancel={requestCloseEdit}
                registerSave={(save) => {
                  editSaveRef.current = save;
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return { openCreate, openEdit, editorModals };
}
