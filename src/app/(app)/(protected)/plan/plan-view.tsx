import { redirect } from "next/navigation";
import Link from "next/link";

import {
  addDays,
  diffDays,
  distanceBucket,
  phaseSummary,
  workoutPrescriptionSchema,
  type MesocyclePhase,
  type WorkoutType,
} from "@/lib/coaching-engine";
import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import { todayForViewer } from "@/lib/viewer-timezone";
import { getActiveCoachRelationship } from "@/lib/private-coaching/athlete-coach";
import { publishedAssignedWorkoutsThisWeek, weeklyLoadEntriesFromAssignedWorkouts } from "@/lib/private-coaching/assigned-week-workouts";
import { computeWeeklyLoad, formatWeeklyLoadText } from "@/lib/private-coaching/weekly-load";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { fetchCalendarWorkouts, summarizeWorkoutFigure } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-data";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";
import { initialWeekWindow } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/timeline-helpers";
import { CompletionSummary, type CompletionDetail } from "./completion-detail";
import { describePrescription, workoutTypeLabel } from "./format-workout";
import { PlanTimelineView } from "./plan-timeline-view";
import { weeklyLoadEntriesFromSelfServeWorkouts } from "./self-serve-weekly-load";
import { TeamScheduleView } from "./team-schedule-view";
import { loadAthleteTimelineWeeks } from "./timeline-actions";
import { WorkoutCard } from "./workout-card";
import { Card } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/heading";

type Mesocycle = {
  id: string;
  phase: MesocyclePhase;
  start_date: string;
  end_date: string;
  focus_notes: string | null;
  season_phase_id: string | null;
};

type WorkoutRow = {
  id: string;
  scheduled_date: string;
  workout_type: WorkoutType;
  prescription: unknown;
  adapted_at: string | null;
  adaptation_reason: string | null;
  adaptation_explanation: string | null;
};

// Read-only row for the coach's view of an athlete's plan -- deliberately
// not the full interactive WorkoutCard (complete/adjust/explain all act on
// behalf of "the current session's own user_id" today, not an athleteId
// parameter, so wiring those up for a coach acting on someone else's
// workout is real additional scope, not part of this pass). Same
// information, no interactive controls.
function ReadOnlyWorkoutRow({ workout, completion }: { workout: WorkoutRow; completion: CompletionDetail | null }) {
  const parsed = workoutPrescriptionSchema.safeParse(workout.prescription);
  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {formatDate(workout.scheduled_date)} · {workoutTypeLabel(workout.workout_type)}
          </p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
            {parsed.success ? describePrescription(parsed.data) : "Details unavailable"}
          </p>
          {completion && <CompletionSummary completion={completion} />}
        </div>
        {completion && (
          <Badge tone="success" className="shrink-0">
            Completed
          </Badge>
        )}
      </div>
    </Card>
  );
}

// A coach-assigned workout (scheduled_workouts), rendered alongside this
// page's own self-serve WorkoutCard/ReadOnlyWorkoutRow list -- links
// straight into /coaching/workouts/[id], the exact same page a
// workout_assigned notification links to, rather than reimplementing
// completion here. "Completing it from the grid works the same as from
// the notification link" is true by construction: it's the same link.
function AssignedWorkoutRow({ workout }: { workout: CalendarWorkout }) {
  const figure = summarizeWorkoutFigure(
    getWorkoutDisplayLabel(workout.dayLabel, workout.title),
    workout.resolvedDistanceM ?? workout.plannedDistanceM,
    workout.resolvedDistanceMaxM ?? workout.plannedDistanceMaxM,
    workout.resolvedDurationS ?? workout.plannedDurationS,
    workout.resolvedDurationMaxS ?? workout.plannedDurationMaxS,
  );
  const isCompleted = workout.status === "completed";
  return (
    <CardLink href={`/coaching/workouts/${workout.id}`} padding="sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 group-hover:underline dark:text-white">
            {formatDate(workout.scheduledDate)} · {figure}
          </p>
          {workout.notesFromCoach ? (
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{workout.notesFromCoach}</p>
          ) : null}
        </div>
        {isCompleted && (
          <Badge tone="success" className="shrink-0">
            Completed
          </Badge>
        )}
      </div>
    </CardLink>
  );
}

type PlanViewProps = {
  userId: string;
  coachView?: boolean;
  /** Week stays the default/fallback -- Timeline is opt-in via `?view=timeline`, and never offered at all to a coach viewing someone else's plan (coachView already has its own dedicated Timeline on /coaching/athletes/[athleteId]/schedule). */
  view?: "week" | "timeline";
};

// Shared between the self-serve /plan page (userId = the caller's own
// session) and the coach's per-athlete view (userId = the route's
// athleteId) -- render logic is identical either way, only whose rows are
// visible differs, which is purely an RLS question already solved by the
// coach-athlete RLS migration. Every query here is explicitly scoped by
// userId rather than left to RLS alone, since RLS for a coach session
// permits reading multiple different athletes' rows, not just one.
export async function PlanView({ userId, coachView = false, view = "week" }: PlanViewProps) {
  const activeView: "week" | "timeline" = !coachView && view === "timeline" ? "timeline" : "week";
  const supabase = await createClient();

  // Team-connected athletes get their schedule from a coach-published
  // group plan, not an individually-generated one -- checked first and
  // returned early so the rest of this function (self-serve training_plans/
  // workouts) stays completely untouched for non-team athletes.
  const { data: teamMembership } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (teamMembership) {
    return (
      <>
        <Heading>Training Schedule</Heading>
        <div className="mt-10">
          <TeamScheduleView userId={userId} coachView={coachView} />
        </div>
      </>
    );
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("race_name, distance_m")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Falls back to "middle" for the edge case of a plan outliving its goal
  // (e.g. the goal was later marked achieved/abandoned) -- a plan can't be
  // generated without an active goal in the first place, so this is a
  // defensive default, not the common path.
  const bucket = goal?.distance_m ? distanceBucket(goal.distance_m) : "middle";

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, name, start_date, end_date")
    .eq("user_id", userId)
    .in("status", ["draft", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    if (coachView) {
      return (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          This athlete doesn&rsquo;t have a training plan yet.
        </p>
      );
    }
    redirect("/plan/new");
  }

  const { data: mesocycles } = await supabase
    .from("mesocycles")
    .select("id, phase, start_date, end_date, focus_notes, season_phase_id")
    .eq("training_plan_id", plan.id)
    .order("start_date", { ascending: true })
    .returns<Mesocycle[]>();

  // The viewer's own local date, not the server's -- see viewer-timezone.ts.
  const today = await todayForViewer();
  const currentMesocycle =
    mesocycles?.find((m) => m.start_date <= today && today <= m.end_date) ?? null;
  const planComplete = !currentMesocycle && mesocycles && today > (mesocycles.at(-1)?.end_date ?? "");

  // A coach-editable season phase's display name/goal, when this mesocycle
  // is linked to one -- overrides the hardcoded phaseSummary() copy below.
  // Absent for any self-serve plan with no season, which renders exactly
  // as it always has.
  const { data: seasonPhase } = currentMesocycle?.season_phase_id
    ? await supabase
        .from("season_phases")
        .select("display_name, primary_goal")
        .eq("id", currentMesocycle.season_phase_id)
        .maybeSingle()
    : { data: null };

  const weekIndex = Math.max(0, Math.floor(diffDays(plan.start_date, today) / 7));
  const weekStart = addDays(plan.start_date, weekIndex * 7);
  const weekEnd = addDays(weekStart, 6);

  // ~2 weeks behind, ~4 weeks ahead of the current week on first render --
  // the exact same initialWeekWindow the coach route's own Timeline uses,
  // via loadAthleteTimelineWeeks (this route's own data layer, see its own
  // header comment for why it re-queries training_plans/mesocycles itself
  // rather than reusing `plan`/`mesocycles` above: it also has to be
  // independently callable from the client as the athlete scrolls).
  const timelineInitialWeeks = activeView === "timeline" ? await loadAthleteTimelineWeeks(initialWeekWindow(weekStart)) : null;

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, scheduled_date, workout_type, prescription, adapted_at, adaptation_reason, adaptation_explanation")
    .eq("mesocycle_id", currentMesocycle?.id ?? mesocycles?.at(-1)?.id ?? "")
    .gte("scheduled_date", weekStart)
    .lte("scheduled_date", weekEnd)
    .order("scheduled_date", { ascending: true })
    .returns<WorkoutRow[]>();

  const workoutIds = workouts?.map((w) => w.id) ?? [];
  const { data: completions } = await supabase
    .from("workout_completions")
    .select("workout_id, actual_distance_m, actual_time_s, rpe, avg_hr, notes, strava_activity_id")
    .in("workout_id", workoutIds.length > 0 ? workoutIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<(CompletionDetail & { workout_id: string })[]>();

  // The aerobic-decoupling check (see completion-detail.tsx) would try to
  // fetch the *viewer's own* connected Strava account for this activity ID
  // -- harmless for the athlete themselves, but a guaranteed-to-fail,
  // confusing button for a coach viewing someone else's plan (coachView),
  // since it's not the coach's activity. Strip it here rather than in the
  // shared CompletionSummary component, so the fix applies regardless of
  // which card renders it.
  const completionByWorkoutId = new Map(
    (completions ?? []).map((c) => [c.workout_id, coachView ? { ...c, strava_activity_id: null } : c]),
  );

  // Coach-assigned workouts (scheduled_workouts) are a completely separate
  // table from this page's self-serve workouts/training_plans -- an
  // athlete with an active coach_athletes relationship (self-coach or a
  // real coach) can have both at once, and this page previously only ever
  // queried the self-serve table, so a coach-assigned workout never
  // appeared here even though it was fully visible and completable from
  // its own notification link (/coaching/workouts/[id]). Scoped to the
  // self-view path only (coachView already has its own dedicated
  // per-athlete calendar at /coaching/athletes/[athleteId]/schedule --
  // this fetch is additive here, not a replacement for that view).
  let assignedWorkouts: CalendarWorkout[] = [];
  if (!coachView) {
    const relationship = await getActiveCoachRelationship(supabase, userId);
    if (relationship) {
      const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      const workoutsByDate = await fetchCalendarWorkouts(supabase, userId, relationship.coachId, weekDates, today);
      assignedWorkouts = publishedAssignedWorkoutsThisWeek(workoutsByDate);
    }
  }

  // "Weekly Load" combines coach-assigned and self-created workouts into
  // one figure -- weeklyLoadEntriesFromSelfServeWorkouts (self-serve-
  // weekly-load.ts) maps a self-created workout's own prescription into
  // the same WeeklyLoadEntry shape weeklyLoadEntriesFromAssignedWorkouts
  // already builds for assigned ones, via coreDistanceOf (coaching-
  // engine/adaptations.ts) rather than re-deriving a prescription's
  // distance here. computeWeeklyLoad/formatWeeklyLoadText are the exact
  // same functions the coach's own week-calendar.tsx footer uses --
  // reused, not reimplemented.
  const weeklyLoadEntries = [
    ...weeklyLoadEntriesFromSelfServeWorkouts(workouts ?? [], completionByWorkoutId),
    ...weeklyLoadEntriesFromAssignedWorkouts(assignedWorkouts),
  ];
  const weeklyLoad = computeWeeklyLoad(weeklyLoadEntries, null);
  const { scheduledText, completedText, scheduledDurationText, completedDurationText } = formatWeeklyLoadText(weeklyLoad, "miles", null);

  return (
    <>
      <Heading>
        {plan.name}
      </Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        {goal?.race_name ? `Building toward ${goal.race_name} on ${formatDate(plan.end_date)}.` : null}
      </p>

      {/* Week stays the default, unchanged view -- Timeline is an
          additional way to browse the same training, not a replacement,
          so switching to it and back never loses anything about how Week
          already looks or behaves. Omitted entirely for coachView, which
          has its own dedicated Timeline at /coaching/athletes/
          [athleteId]/schedule. */}
      {!coachView && (
        <nav className="mt-6 flex items-center gap-1 rounded-control border border-black/10 p-0.5 dark:border-white/10" aria-label="Schedule view">
          {(["week", "timeline"] as const).map((v) => (
            <Link
              key={v}
              href={`?view=${v}`}
              className={`rounded-control px-3 py-1.5 text-xs font-semibold capitalize ${
                activeView === v
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {v}
            </Link>
          ))}
        </nav>
      )}

      {activeView === "timeline" && timelineInitialWeeks ? (
        <div className="mt-8">
          <PlanTimelineView
            initialWeeks={timelineInitialWeeks}
            centerWeek={weekStart}
            today={today}
            distanceBucket={bucket}
          />
        </div>
      ) : planComplete ? (
        <Card padding="md" className="mt-10">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            This plan has run its course.{" "}
            {coachView ? "Nice work." : "Nice work. Set a new goal on your dashboard whenever you’re ready for the next one."}
          </p>
        </Card>
      ) : (
        <>
          {currentMesocycle && (
            <Card padding="md" className="mt-10">
              <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                Current phase
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900 capitalize dark:text-white">
                {seasonPhase?.display_name ?? currentMesocycle.phase}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {seasonPhase?.primary_goal || phaseSummary(currentMesocycle.phase, bucket)}
              </p>
              {currentMesocycle.focus_notes && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {currentMesocycle.focus_notes}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(currentMesocycle.start_date)} – {formatDate(currentMesocycle.end_date)}
              </p>
            </Card>
          )}

          <div className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
                This week
              </p>
              {weeklyLoadEntries.length > 0 && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span>
                    Scheduled: {scheduledText}
                    {scheduledDurationText ? ` / ${scheduledDurationText}` : ""}
                  </span>
                  <span className="mx-1.5">·</span>
                  <span>
                    Completed: {completedText}
                    {completedDurationText ? ` / ${completedDurationText}` : ""}
                  </span>
                </p>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {workouts && workouts.length > 0
                ? workouts.map((workout) =>
                    coachView ? (
                      <ReadOnlyWorkoutRow key={workout.id} workout={workout} completion={completionByWorkoutId.get(workout.id) ?? null} />
                    ) : (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        phase={currentMesocycle?.phase ?? null}
                        distanceBucket={bucket}
                        completion={completionByWorkoutId.get(workout.id) ?? null}
                        today={today}
                      />
                    ),
                  )
                : null}
              {assignedWorkouts.map((workout) => (
                <AssignedWorkoutRow key={workout.id} workout={workout} />
              ))}
              {(!workouts || workouts.length === 0) && assignedWorkouts.length === 0 && (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  No workouts scheduled this week.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
