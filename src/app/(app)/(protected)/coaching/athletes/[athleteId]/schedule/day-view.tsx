"use client";

import type { CalendarWorkout } from "./calendar-types";
import type { ExtraPresetOption } from "./actions";
import type { TemplateOption } from "./workout-form";
import { WorkoutCard } from "./workout-card";
import { useCalendarWorkoutEditor } from "./calendar-workout-editor";

// Detailed view of one date -- a calendar/navigation surface, not a
// replacement for the workout detail page (WorkoutCard already links out
// to it). Reuses the existing WorkoutCard and the same
// useCalendarWorkoutEditor Week View uses, so Edit/+Add behave
// identically here: full parity, not a stripped-down read-only view.
// Duplicate/Move/Delete are WorkoutCard's own existing affordances and
// need no wiring here at all.
export function DayView({
  athleteId,
  date,
  workouts,
  templates,
  extraPresets,
}: {
  athleteId: string;
  date: string;
  workouts: CalendarWorkout[];
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
}) {
  const { openCreate, openEdit, editorModals } = useCalendarWorkoutEditor({ athleteId, templates, extraPresets });

  return (
    <div>
      {workouts.length > 0 ? (
        <div className="space-y-2">
          {workouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              athleteId={athleteId}
              draggable={false}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onEdit={() => openEdit(date, workout)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-300">Nothing scheduled for this day.</p>
      )}

      <button
        type="button"
        onClick={() => openCreate(date)}
        className="mt-3 w-full rounded-control border border-dashed border-black/15 py-2 text-sm font-semibold text-zinc-500 hover:border-black/30 hover:text-zinc-700 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/30 dark:hover:text-zinc-200"
      >
        + Add
      </button>

      {editorModals}
    </div>
  );
}
