"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { deleteScheduledWorkout, duplicateScheduledWorkout, rescheduleWorkout } from "./actions";
import type { CalendarWorkout } from "./calendar-types";
import { getDayTypeAccent, DAY_TYPE_BORDER_CLASSES } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutDisplayLabel, describeWorkoutDetail } from "@/lib/private-coaching/workout-status";
import { formatClock } from "@/lib/running-format";
import { formatMiles } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";

const STATUS_BADGE: Record<CalendarWorkout["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "warning" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  missed: { label: "Missed", tone: "error" },
};

// Prescription -> status -> actual, in that order, and nothing else --
// deliberately not a control panel. Duplicate/Move/Delete are small
// icon-only affordances so they don't compete with the card's real
// content; the card body itself links out to the existing workout detail
// page, which stays the place for full step-by-step/comment detail.
export function WorkoutCard({
  workout,
  athleteId,
  draggable,
  onDragStart,
  onDragEnd,
  onEdit,
}: {
  workout: CalendarWorkout;
  athleteId: string;
  draggable: boolean;
  onDragStart: (workoutId: string, fromDate: string) => void;
  onDragEnd: () => void;
  // Opens the existing full WorkoutForm pre-filled with this workout --
  // unchanged in kind from the pre-rebuild flat list's own "Edit" link,
  // just triggered from a card instead of a list row. Not the same thing
  // as "quick-edit-in-place" (Phase 2); this is the pre-existing
  // open-a-form-to-edit capability, which the rebuild must not regress.
  onEdit: () => void;
}) {
  const router = useRouter();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState(workout.scheduledDate);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // workout.plannedPaceSPerMi/MaxSPerMi are untouched raw DB values (see
  // calendar-types.ts's own comment) -- the resolved* fields are what
  // describeWorkoutDetail actually renders from when a reference is
  // active, reassembled here into the ResolvedPaceReference shape it
  // expects.
  const resolvedWorkoutPace =
    workout.paceReference && workout.resolvedPaceMinSPerMi != null
      ? {
          minSPerMi: workout.resolvedPaceMinSPerMi,
          maxSPerMi: workout.resolvedPaceMaxSPerMi,
          sourceLabel: workout.paceReferenceSourceLabel ?? "",
        }
      : null;
  // Always passed, not gated on workout.paceReference -- a STEP can have
  // its own reference even when the workout-level pace doesn't, and
  // omitting `resolved` entirely here would make summarizeStep treat that
  // step's reference as "not applicable" (a template's bare-label
  // rendering) instead of actually resolving it for this real athlete.
  const { heading, rangeText, stepsSummary, extrasText } = describeWorkoutDetail(workout, {
    workoutPace: resolvedWorkoutPace,
    stepPaces: workout.stepPaceReferences,
  });
  const status = STATUS_BADGE[workout.status];
  const accent = getDayTypeAccent(workout.dayLabel);
  const displayLabel = getWorkoutDisplayLabel(workout.dayLabel, workout.title);

  async function handleMoveSubmit() {
    setMoveError(null);
    if (!moveDate || moveDate === workout.scheduledDate) return setMoveOpen(false);
    setIsMoving(true);
    const result = await rescheduleWorkout(workout.id, athleteId, moveDate);
    setIsMoving(false);
    if (result.error) return setMoveError(result.error);
    setMoveOpen(false);
    router.refresh();
  }

  async function handleDuplicate() {
    setIsDuplicating(true);
    await duplicateScheduledWorkout(workout.id, athleteId);
    setIsDuplicating(false);
    router.refresh();
  }

  return (
    <div
      data-workout-card
      className={`rounded-control border border-l-4 border-black/10 bg-white p-2.5 text-sm dark:border-white/10 ${DAY_TYPE_BORDER_CLASSES[accent]} dark:bg-zinc-900`}
    >
      <div className="flex items-start justify-between gap-1">
        {/* day_label (what KIND of day this is -- MLR, Threshold, Fartlek)
            is the card's real heading now that title is gone as a
            coach-facing concept; getWorkoutDisplayLabel falls back to a
            legacy row's title only if it predates day_label. Decorative
            color aside, this text is always here regardless of accent. */}
        <div className="min-w-0 flex-1">
          <Link href={`/coaching/workouts/${workout.id}`} className="hover:underline">
            <p className="line-clamp-2 font-medium text-zinc-900 dark:text-white">{heading}</p>
          </Link>
        </div>
        {draggable ? (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              const card = (e.target as HTMLElement).closest("[data-workout-card]");
              if (card) e.dataTransfer.setDragImage(card, 20, 20);
              onDragStart(workout.id, workout.scheduledDate);
            }}
            onDragEnd={onDragEnd}
            className="cursor-grab px-1 text-zinc-400 select-none active:cursor-grabbing"
            aria-hidden
            title="Drag to move"
          >
            ⠿
          </span>
        ) : null}
      </div>

      {rangeText ? (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{rangeText}</p>
      ) : stepsSummary ? (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">{stepsSummary}</p>
      ) : null}

      {extrasText ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{extrasText}</p> : null}

      {/* "Shown transparently" -- a resolved pace reference always names
          the race it came from, right here, not just as a bare number. */}
      {workout.paceReferenceSourceLabel ? (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">from {workout.paceReferenceSourceLabel}</p>
      ) : null}
      {workout.volumeSourceLabel ? (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">from {workout.volumeSourceLabel}</p>
      ) : null}

      <div className="mt-1.5">
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {workout.completion ? (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {[
            workout.completion.actualDistanceM != null ? formatMiles(workout.completion.actualDistanceM) : null,
            workout.completion.actualDurationS != null ? formatClock(workout.completion.actualDurationS) : null,
            workout.completion.stravaActivityId != null ? "Strava" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onEdit}
          className="font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isDuplicating}
          onClick={handleDuplicate}
          className="font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {isDuplicating ? "Duplicating…" : "Duplicate"}
        </button>
        <button
          type="button"
          onClick={() => setMoveOpen((v) => !v)}
          className="font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        >
          Move
        </button>
        <ConfirmButton
          action={() => deleteScheduledWorkout(workout.id, athleteId).then(() => router.refresh())}
          confirmMessage={`Delete "${displayLabel}"?`}
          label="Delete"
          pendingLabel="Deleting…"
          className="font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
        />
      </div>

      {moveOpen ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            className="rounded-control border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-950"
          />
          <button
            type="button"
            disabled={isMoving}
            onClick={handleMoveSubmit}
            className="text-xs font-semibold text-zinc-900 underline underline-offset-2 disabled:opacity-50 dark:text-white"
          >
            {isMoving ? "Moving…" : "Move here"}
          </button>
          {moveError ? <p className="w-full text-xs text-accent-error">{moveError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
