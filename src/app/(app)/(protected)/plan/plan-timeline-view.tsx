"use client";

import {
  estimatedDurationRangeMin,
  workoutPrescriptionSchema,
  type DistanceBucket,
} from "@/lib/coaching-engine";
import { getDayTypeAccent, abbreviateDayLabel } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { buildTimelineTileFigures, type TimelineEntryView } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-helpers";
import { TimelineView } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-view";
import type { TimelineWeekBlock } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-helpers";
import { describePrescription, workoutTypeLabel } from "./format-workout";
import { loadAthleteTimelineWeeks, type AthleteTimelineEntry } from "./timeline-actions";
import { WorkoutCard } from "./workout-card";

// /plan's own thin adapter onto the shared TimelineView (the exact same
// component the coach route's own coach-timeline-view.tsx adapts) --
// normalizes a self-created or coach-assigned workout into the one
// shared TimelineEntryView tile shape, so the two routes' tiles are
// genuinely identical, not independently styled lookalikes. A
// coach-assigned entry's tile links straight to /coaching/workouts/[id]
// (the same page a workout_assigned notification already links to, and
// the same link plan-view.tsx's own Week-view AssignedWorkoutRow already
// uses) -- completing it there is unchanged. A self-created entry's tile
// expands in place to the exact same WorkoutCard (complete form and all)
// Week View already renders, rather than a Timeline-only rebuild of that
// flow.
export function PlanTimelineView({
  initialWeeks,
  centerWeek,
  today,
  distanceBucket,
}: {
  initialWeeks: TimelineWeekBlock<AthleteTimelineEntry>[];
  centerWeek: string;
  today: string;
  distanceBucket: DistanceBucket;
}) {
  function normalizeEntry(entry: AthleteTimelineEntry): TimelineEntryView {
    if (entry.source === "assigned") {
      const { workout } = entry;
      const { distanceText, durationText, effortText } = buildTimelineTileFigures(workout);
      return {
        id: workout.id,
        accent: getDayTypeAccent(workout.dayLabel),
        statusTone: workout.status,
        sessionSlot: workout.sessionSlot,
        label: abbreviateDayLabel(getWorkoutDisplayLabel(workout.dayLabel, workout.title)),
        distanceText,
        durationText,
        effortText,
        kind: "link",
        href: `/coaching/workouts/${workout.id}`,
      };
    }

    const { workout, completion, phase } = entry;
    const parsed = workoutPrescriptionSchema.safeParse(workout.prescription);
    const durationRange = parsed.success ? estimatedDurationRangeMin(parsed.data) : null;
    const statusTone: TimelineEntryView["statusTone"] = completion ? "completed" : workout.scheduled_date < today ? "missed" : "scheduled";

    return {
      id: workout.id,
      // Self-serve workouts have no free-text day_label (that's the
      // coach-authored vocabulary) -- workout_type ("easy"/"tempo"/"long"/
      // etc.) is close enough free text for getDayTypeAccent's own keyword
      // matching to classify reasonably, same function either route uses.
      accent: getDayTypeAccent(workout.workout_type),
      statusTone,
      sessionSlot: null,
      label: workoutTypeLabel(workout.workout_type),
      // Self-serve distance and pace are only ever available combined (see
      // describePrescription's own doc comment) -- shown as one figure
      // rather than split into separate distance/pace fields that would
      // just re-derive what that function already does correctly.
      distanceText: parsed.success ? describePrescription(parsed.data) : null,
      durationText: durationRange ? `${durationRange[0]}–${durationRange[1]} min` : null,
      effortText: null,
      kind: "expand",
      content: <WorkoutCard workout={workout} phase={phase} distanceBucket={distanceBucket} completion={completion} />,
    };
  }

  return (
    <TimelineView<AthleteTimelineEntry>
      initialWeeks={initialWeeks}
      centerWeek={centerWeek}
      today={today}
      loadWeeks={loadAthleteTimelineWeeks}
      entryKey={(entry) => entry.workout.id}
      normalizeEntry={normalizeEntry}
    />
  );
}
