"use client";

import { getDayTypeAccent, abbreviateDayLabel } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { getPhaseForWeek, weekPositionInPhase, type TrainingPhase } from "@/lib/private-coaching/training-phases";
import { useCalendarWorkoutEditor } from "./calendar-workout-editor";
import { loadTimelineWeeks, type TimelineWeek } from "./timeline-actions";
import { buildTimelineTileFigures, type TimelineEntryView } from "./timeline-helpers";
import { TimelineView } from "./timeline-view";
import type { CalendarWorkout } from "./calendar-types";
import type { ExtraPresetOption } from "./actions";
import type { TemplateOption } from "./workout-form";

// The coach route's own thin adapter onto the shared TimelineView: turns
// a CalendarWorkout into the one shared TimelineEntryView shape (tile
// markup identical to the athlete route's own adapter, see
// plan/timeline-entries.ts) and supplies the coach-only bits TimelineView
// itself knows nothing about -- the create/edit modal (via
// useCalendarWorkoutEditor, the exact same hook Week View and Month View
// mount, so completing/editing a workout from here is the same code
// path, not a parallel one), the "+ Add" affordance, and the phase/week
// position line under each sticky header.
export function CoachTimelineView({
  athleteId,
  initialWeeks,
  centerWeek,
  today,
  templates,
  extraPresets,
  phases,
}: {
  athleteId: string;
  initialWeeks: TimelineWeek[];
  centerWeek: string;
  today: string;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  phases: TrainingPhase[];
}) {
  const { openCreate, openEdit, editorModals } = useCalendarWorkoutEditor({ athleteId, templates, extraPresets });

  function normalizeEntry(workout: CalendarWorkout, date: string): TimelineEntryView {
    const { distanceText, durationText, effortText, feedbackText, hasNotes, emphasize } = buildTimelineTileFigures(workout);
    return {
      id: workout.id,
      accent: getDayTypeAccent(workout.dayLabel),
      statusTone: workout.status,
      sessionSlot: workout.sessionSlot,
      label: abbreviateDayLabel(getWorkoutDisplayLabel(workout.dayLabel, workout.title)),
      distanceText,
      durationText,
      effortText,
      feedbackText,
      hasNotes,
      emphasize,
      kind: "click",
      onClick: () => openEdit(date, workout),
    };
  }

  function weekMeta(weekStart: string) {
    const phase = getPhaseForWeek(phases, weekStart);
    if (!phase) return null;
    const position = weekPositionInPhase(phase, weekStart);
    return (
      <>
        {phase.phaseType}
        {phase.name ? ` — ${phase.name}` : ""}
        {position ? ` · Week ${position.week} of ${position.of}` : ""}
      </>
    );
  }

  return (
    <TimelineView<CalendarWorkout>
      initialWeeks={initialWeeks}
      centerWeek={centerWeek}
      today={today}
      loadWeeks={(weekStarts) => loadTimelineWeeks(athleteId, weekStarts)}
      entryKey={(w) => w.id}
      normalizeEntry={normalizeEntry}
      onAddDay={openCreate}
      weekMeta={weekMeta}
      extraContent={editorModals}
    />
  );
}
