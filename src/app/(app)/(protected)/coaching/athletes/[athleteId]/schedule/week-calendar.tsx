"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { rescheduleWorkout, publishWorkouts, deleteWorkouts, type ExtraPresetOption } from "./actions";
import type { CalendarWorkout } from "./calendar-types";
import { WorkoutCard } from "./workout-card";
import { useCalendarWorkoutEditor } from "./calendar-workout-editor";
import type { TemplateOption } from "./workout-form";
import { effectiveWorkoutVolume } from "@/lib/private-coaching/workout-status";
import { computeWeeklyLoad, formatWeeklyLoadText, type WeeklyLoadEntry } from "@/lib/private-coaching/weekly-load";
import { formatTargetVolume, type WeekPlanValues } from "./week-plan-editor";
import { formatWeekday, formatDate } from "@/lib/format";
import { FormError } from "@/components/ui/form-error";
import { InlineConfirmButton } from "@/components/ui/inline-confirm-button";

// The calendar's grid + weekly footer. Week navigation itself (prev/next/
// today, the athlete switcher, phase/goal-race context, surrounding-week
// strips) lives in the server-rendered page header around this component
// -- pure links need no client JS. This component owns drag-and-drop and,
// via useCalendarWorkoutEditor, the create/edit panels.
//
// Mount this with key={weekStart} from the parent page: navigating
// ?week=... is a normal Next.js navigation, and without a key change React
// would otherwise reuse this client component's instance across weeks,
// leaving stale local state (drag/edit state, the optimistic workoutsByDate
// copy) from the previous week in place.
export function WeekCalendar({
  athleteId,
  days,
  workoutsByDate: initialWorkoutsByDate,
  templates,
  extraPresets,
  today,
  easyPaceSPerMi,
  volumeUnitPreference,
  weekPlan,
}: {
  athleteId: string;
  days: string[];
  workoutsByDate: Record<string, CalendarWorkout[]>;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  today: string;
  // Weekly Load's own reconciliation inputs -- see weekly-load.ts. Both
  // coach-facing only: an athlete never sees this page's own footer.
  easyPaceSPerMi: number | null;
  volumeUnitPreference: "miles" | "minutes";
  // The coach's own stated target for this week (WeekPlanEditor, rendered
  // above the grid) -- shown again here so "did I plan close to target"
  // never requires scrolling back up and holding two numbers in your head.
  weekPlan: WeekPlanValues;
}) {
  const router = useRouter();
  const [workoutsByDate, setWorkoutsByDate] = useState(initialWorkoutsByDate);

  // workoutsByDate is seeded once on mount and otherwise only touched by
  // the optimistic drag/drop handler below -- router.refresh() (called
  // after create/edit/delete/duplicate/move all succeed) re-runs the
  // server page and gives this component fresh props, but by itself does
  // NOT reset already-mounted client state, so without this the calendar
  // would silently keep showing stale data (a deleted card staying
  // visible, an edit not appearing) even though the mutation succeeded
  // server-side. Resetting during render (React's documented pattern for
  // "adjusting state when a prop changes") rather than in a useEffect
  // avoids an extra commit and satisfies react-hooks/set-state-in-effect.
  // initialWorkoutsByDate only gets a new object reference when the
  // server actually re-rendered (i.e. exactly when a refresh happened),
  // so this can't clobber an in-flight optimistic drag, which never calls
  // router.refresh() itself.
  const [syncedProps, setSyncedProps] = useState(initialWorkoutsByDate);
  if (initialWorkoutsByDate !== syncedProps) {
    setSyncedProps(initialWorkoutsByDate);
    setWorkoutsByDate(initialWorkoutsByDate);
  }

  const [dragging, setDragging] = useState<{ workoutId: string; fromDate: string } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const { openCreate, openEdit, editorModals } = useCalendarWorkoutEditor({ athleteId, templates, extraPresets });

  function clearDrag() {
    setDragging(null);
    setDragOverDate(null);
  }

  function handleDrop(date: string) {
    setDragOverDate(null);
    if (!dragging) return;
    const { workoutId, fromDate } = dragging;
    setDragging(null);
    if (fromDate === date) return;

    const snapshot = workoutsByDate;
    const moved = snapshot[fromDate]?.find((w) => w.id === workoutId);
    if (!moved) return;

    // Optimistic: move it in local state immediately, don't wait for the
    // round trip -- waiting would make a direct-manipulation gesture feel
    // broken. Reverted below if the write actually fails.
    setWorkoutsByDate({
      ...snapshot,
      [fromDate]: (snapshot[fromDate] ?? []).filter((w) => w.id !== workoutId),
      [date]: [...(snapshot[date] ?? []), { ...moved, scheduledDate: date }],
    });
    setDragError(null);

    rescheduleWorkout(workoutId, athleteId, date).then((result) => {
      if (result.error) {
        setWorkoutsByDate(snapshot); // never silently leave a card in a column the write didn't reach
        setDragError(result.error);
      }
    });
  }

  const allWorkouts = days.flatMap((d) => workoutsByDate[d] ?? []);

  // Draft counts for the batch-publish affordances below -- week-wide for
  // the Weekly Load footer button, per-day for each column's own button.
  // Both read the exact same optimistic workoutsByDate state the grid
  // itself renders from, so a card that already moved off this week (drag)
  // or was deleted isn't counted.
  const draftWorkoutIds = allWorkouts.filter((w) => w.publishedAt == null).map((w) => w.id);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function publishIds(ids: string[]) {
    setPublishError(null);
    const result = await publishWorkouts(ids, athleteId);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    router.refresh();
  }

  // Deletes every workout in scope, draft or already-published -- unlike
  // publishIds above, there's no draft-only filter, since "delete this
  // day/week" means clear it entirely, the same as a single workout's own
  // Delete regardless of its status.
  async function deleteIds(ids: string[]) {
    setDeleteError(null);
    const result = await deleteWorkouts(ids, athleteId);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    router.refresh();
  }

  // Everything except cross-training counts toward mileage -- a
  // duration-only non-XT day is estimated via the athlete's own easy pace;
  // XT always stays separate, shown additively. See weekly-load.ts. Each
  // entry's distance/duration is already the workout's EFFECTIVE value
  // (a volume-percent day's own resolved figure, same merge every other
  // surface on this calendar uses).
  const weeklyLoadEntries: WeeklyLoadEntry[] = allWorkouts.map((w) => {
    const effective = effectiveWorkoutVolume(w);
    return {
      dayLabel: w.dayLabel,
      distanceM: effective.distanceM,
      durationS: effective.durationS,
      actualDistanceM: w.completion?.actualDistanceM ?? null,
      actualDurationS: w.completion?.actualDurationS ?? null,
      scheduledDate: w.scheduledDate,
    };
  });
  const weeklyLoad = computeWeeklyLoad(weeklyLoadEntries, easyPaceSPerMi, today);
  const { scheduledText, completedText, remainingText, unscheduledText, scheduledDurationText, completedDurationText, countText } = formatWeeklyLoadText(
    weeklyLoad,
    volumeUnitPreference,
    easyPaceSPerMi,
  );
  const targetText = formatTargetVolume(weekPlan);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[1100px] grid-cols-7 gap-2">
          {days.map((date) => {
            const isToday = date === today;
            const isDragOver = dragOverDate === date;
            const dayWorkouts = workoutsByDate[date] ?? [];
            const dayDraftIds = dayWorkouts.filter((w) => w.publishedAt == null).map((w) => w.id);
            const dayAllIds = dayWorkouts.map((w) => w.id);
            return (
              <div
                key={date}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setDragOverDate(date);
                }}
                onDragLeave={() => setDragOverDate((d) => (d === date ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(date);
                }}
                className={`rounded-control border p-2 ${
                  isDragOver
                    ? "border-accent-tip ring-2 ring-accent-tip"
                    : isToday
                      ? "border-black/20 dark:border-white/20"
                      : "border-black/10 dark:border-white/10"
                }`}
              >
                <p className={`text-xs font-semibold tracking-wide uppercase ${isToday ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {formatWeekday(date)}
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(date)}</p>

                <div className="mt-2 space-y-2">
                  {dayWorkouts.map((workout) => (
                    <WorkoutCard
                      key={workout.id}
                      workout={workout}
                      athleteId={athleteId}
                      draggable={dragging === null || dragging.workoutId === workout.id}
                      onDragStart={(workoutId, fromDate) => setDragging({ workoutId, fromDate })}
                      onDragEnd={clearDrag}
                      onEdit={() => openEdit(date, workout)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => openCreate(date)}
                  className="mt-2 w-full rounded-control border border-dashed border-black/15 py-1.5 text-xs font-semibold text-zinc-500 hover:border-black/30 hover:text-zinc-700 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/30 dark:hover:text-zinc-200"
                >
                  + Add
                </button>

                {dayDraftIds.length > 0 ? (
                  <div className="mt-1.5">
                    <InlineConfirmButton
                      action={() => publishIds(dayDraftIds)}
                      confirmMessage={`Publish ${dayDraftIds.length} draft${dayDraftIds.length === 1 ? "" : "s"}? They'll become visible to the athlete.`}
                      label={`Publish ${dayDraftIds.length} draft${dayDraftIds.length === 1 ? "" : "s"}`}
                      pendingLabel="Publishing…"
                      className="w-full rounded-control border border-dashed border-black/15 py-1.5 text-xs font-semibold text-zinc-500 hover:border-black/30 hover:text-zinc-700 disabled:opacity-50 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/30 dark:hover:text-zinc-200"
                    />
                  </div>
                ) : null}

                {dayAllIds.length > 0 ? (
                  <div className="mt-1.5">
                    <InlineConfirmButton
                      action={() => deleteIds(dayAllIds)}
                      confirmMessage={`Delete ${dayAllIds.length} workout${dayAllIds.length === 1 ? "" : "s"} on ${formatDate(date)}? This includes any already published or completed, and can't be undone.`}
                      label={`Delete ${dayAllIds.length} workout${dayAllIds.length === 1 ? "" : "s"}`}
                      pendingLabel="Deleting…"
                      className="w-full rounded-control border border-dashed border-black/15 py-1.5 text-xs font-semibold text-zinc-500 hover:border-red-400 hover:text-red-600 disabled:opacity-50 dark:border-white/15 dark:text-zinc-400 dark:hover:border-red-500 dark:hover:text-red-400"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {editorModals}

      {dragError ? (
        <div className="mt-3">
          <FormError>{dragError}</FormError>
        </div>
      ) : null}

      <div className="mt-6 rounded-control border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Weekly Load</p>
          <div className="flex flex-wrap items-center gap-3">
            {targetText ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Target: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{targetText}</span>
              </p>
            ) : null}
            {draftWorkoutIds.length > 0 ? (
              <InlineConfirmButton
                action={() => publishIds(draftWorkoutIds)}
                confirmMessage={`Publish ${draftWorkoutIds.length} draft${draftWorkoutIds.length === 1 ? "" : "s"}? They'll become visible to the athlete.`}
                label={`Publish week · ${draftWorkoutIds.length} draft${draftWorkoutIds.length === 1 ? "" : "s"}`}
                pendingLabel="Publishing…"
                className="rounded-pill border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-600 hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
              />
            ) : null}
            {allWorkouts.length > 0 ? (
              <InlineConfirmButton
                action={() => deleteIds(allWorkouts.map((w) => w.id))}
                confirmMessage={`Delete all ${allWorkouts.length} workout${allWorkouts.length === 1 ? "" : "s"} this week? This includes any already published or completed, and can't be undone.`}
                label={`Delete week · ${allWorkouts.length} workout${allWorkouts.length === 1 ? "" : "s"}`}
                pendingLabel="Deleting…"
                className="rounded-pill border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-red-400 hover:text-red-600 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:border-red-500 dark:hover:text-red-400"
              />
            ) : null}
          </div>
        </div>
        {publishError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{publishError}</p>
        ) : null}
        {deleteError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{deleteError}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <p>
            <span className="text-zinc-500 dark:text-zinc-400">Scheduled: </span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {scheduledText}
              {scheduledDurationText ? ` / ${scheduledDurationText}` : ""}
            </span>
          </p>
          <p>
            <span className="text-zinc-500 dark:text-zinc-400">Completed: </span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {completedText}
              {completedDurationText ? ` / ${completedDurationText}` : ""}
            </span>
          </p>
          <p>
            <span className="text-zinc-500 dark:text-zinc-400">Remaining: </span>
            <span className="font-semibold text-zinc-900 dark:text-white">{remainingText}</span>
          </p>
          {unscheduledText ? (
            <p>
              <span className="text-zinc-500 dark:text-zinc-400">Unscheduled: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{unscheduledText}</span>
            </p>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {countText}
          {weeklyLoad.estimatedCount > 0
            ? ` · ${weeklyLoad.estimatedCount} duration-only ${weeklyLoad.estimatedCount === 1 ? "day" : "days"} estimated from easy pace`
            : ""}
        </p>
      </div>
    </div>
  );
}
