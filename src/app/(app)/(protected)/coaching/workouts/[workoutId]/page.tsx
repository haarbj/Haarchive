import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { formatDate } from "@/lib/format";
import {
  summarizeStep,
  summarizeDayPace,
  WORKOUT_STEP_TYPE_LABELS,
  type StepInput,
  type DayPaceReference,
} from "@/lib/private-coaching/steps";
import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import { getWorkoutDisplayLabel, effectiveWorkoutVolume, computeWorkoutStatus } from "@/lib/private-coaching/workout-status";
import { formatDistanceRange, formatDurationRange } from "@/lib/private-coaching/workout-distance";
import { compareCompletionToPlan, describeRpe, formatDistanceDelta, formatDurationDelta, formatRpeDisplay } from "@/lib/private-coaching/completion-comparison";
import { isBareXt } from "@/lib/private-coaching/day-type-visuals";
import { getWorkoutGlossaryEntry } from "@/lib/private-coaching/workout-glossary";
import { PhaseExplainer } from "@/components/private-coaching/phase-explainer";
import { effortLevelLabel } from "@/lib/private-coaching/effort-levels";
import {
  getAthleteMostRecentRace,
  resolvePaceReference,
  type PaceReferenceKey,
  type ResolvedPaceReference,
} from "@/lib/private-coaching/pace-reference";
import { getAthleteFitnessEstimates, resolvePacePercent } from "@/lib/private-coaching/fitness-estimates";
import { resolveVolumePercent, resolvedVolumeToFields, type WeekTarget } from "@/lib/private-coaching/volume-reference";
import type { WorkoutType } from "@/lib/coaching-engine";
import { formatClock } from "@/lib/running-format";
import { MILE_METERS } from "@/lib/race-distances";
import { mostRecentMonday } from "@/lib/week";
import { CompletionForm, type CompletionFormInitial } from "./completion-form";
import { missedWorkoutGuidance } from "@/lib/private-coaching/adjustment-playbook";
import { InjuryTriagePanel } from "./injury-triage-panel";
import { StravaMatchReview, type PendingStravaMatch } from "./strava-match-review";
import { ConditionsSection } from "./conditions-section";
import type { ConditionsAnalysis } from "@/lib/private-coaching/completion-conditions-service";
import { WorkoutComments, type CommentItem } from "./workout-comments";
import { ExtrasDetail } from "./extras-detail";
import { CompletionSummary, type CompletionDetail } from "@/app/(app)/(protected)/plan/completion-detail";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type WorkoutRow = {
  id: string;
  athlete_id: string;
  coach_id: string;
  scheduled_date: string;
  title: string | null;
  workout_type: WorkoutType | null;
  day_label: string | null;
  session_slot: string | null;
  published_at: string | null;
  is_optional: boolean;
  alternative_text: string | null;
  notes_from_coach: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: PaceReferenceKey | null;
  pace_percent_basis: PaceReferenceKey | null;
  pace_percent_min: number | null;
  pace_percent_max: number | null;
  planned_volume_percent: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
};
type StepRow = {
  step_type: StepInput["stepType"];
  duration_s: number | null;
  duration_max_s: number | null;
  distance_m: number | null;
  distance_max_m: number | null;
  target_type: StepInput["targetType"];
  target_min: number | null;
  target_max: number | null;
  target_unit: string | null;
  target_pace_reference: PaceReferenceKey | null;
  target_pace_percent_basis: PaceReferenceKey | null;
  target_pace_percent_min: number | null;
  target_pace_percent_max: number | null;
  repetitions: number | null;
  repetitions_max: number | null;
  rest_s: number | null;
  rest_max_s: number | null;
  instructions: string | null;
};
type ExtraRow = {
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};
type CompletionRow = {
  actual_distance_m: number | null;
  actual_duration_s: number | null;
  avg_hr: number | null;
  rpe: number | null;
  effort_level: string | null;
  conditions_notes: string | null;
  activity_type: string | null;
  athlete_notes: string | null;
  pain_reported: boolean;
  pain_notes: string | null;
  strava_activity_id: number | null;
  strava_activity_ids: number[] | null;
  conditions_analysis: ConditionsAnalysis | null;
};
type PendingMatchRow = {
  id: string;
  activity_name: string | null;
  activity_distance_m: number | null;
  activity_duration_s: number | null;
  activity_avg_hr: number | null;
  combined_activities: { id: number; name: string; distanceM: number; durationS: number; startedAt: string }[] | null;
};
type CommentRow = { id: string; author_id: string; body: string; created_at: string };
type Profile = { id: string; display_name: string; coach_display_name: string | null };

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workoutId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const session = await getAppSession();
  if (!session) redirect("/coaching");
  const { workoutId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  // scheduled_workouts_all_coach / scheduled_workouts_select_athlete RLS
  // together mean this row only comes back at all if the caller is either
  // the coach who authored it or the athlete it's published to -- no
  // manual role check needed beyond the notFound() fallback below.
  const { data: workout } = await supabase
    .from("scheduled_workouts")
    .select(
      "id, athlete_id, coach_id, scheduled_date, published_at, title, workout_type, day_label, session_slot, is_optional, alternative_text, notes_from_coach, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, pace_percent_basis, pace_percent_min, pace_percent_max, planned_volume_percent, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max",
    )
    .eq("id", workoutId)
    .maybeSingle<WorkoutRow>();
  if (!workout) notFound();

  const isCoach = session.userId === workout.coach_id;
  const backHref = isCoach ? `/coaching/athletes/${workout.athlete_id}/schedule` : "/coaching";

  // A self-coached workout (coach_id === athlete_id) is always "isCoach"
  // by that comparison alone, which would make the completion/Strava
  // section below permanently show its coach-only "Not completed yet."
  // dead end -- there'd be no way to ever log a completion. The explicit
  // toggle lets the same person choose which perspective to view, and
  // defaults to Athlete since logging a completion is the page's real
  // daily job. This is a RENDERING choice only -- every mutation below
  // (completion-actions.ts, comment-actions.ts) independently re-derives
  // authorization from the real workout row + session identity, never
  // from this param, so ?as=coach can never grant a capability the
  // session doesn't already have on this actual row.
  const isSelfCoachedWorkout = workout.coach_id === workout.athlete_id;
  const viewAs: "coach" | "athlete" = isSelfCoachedWorkout && sp.as === "coach" ? "coach" : "athlete";
  const effectiveIsCoach = isSelfCoachedWorkout ? viewAs === "coach" : isCoach;

  // The educational layer is for coached athletes and their coaches only.
  // RLS already guarantees only those two parties can read this row at
  // all, so this is belt-and-braces rather than the primary gate: it's
  // what keeps the sections off the page for a coach-less athlete whose
  // relationship was ended while a workout row remained readable.
  const showEducation = isCoach || session.isCoachedAthlete;
  const glossaryEntry = getWorkoutGlossaryEntry(workout.day_label, {
    basis: workout.pace_percent_basis,
    min: workout.pace_percent_min,
    max: workout.pace_percent_max,
  });

  const workoutWeekStart = mostRecentMonday(new Date(`${workout.scheduled_date}T00:00:00Z`));

  const [
    { data: stepRows },
    { data: extraRows },
    { data: completion },
    { data: commentRows },
    { data: pendingMatches },
    mostRecentRace,
    fitnessEstimates,
    weekTargetRow,
    { data: phaseRowsForWorkout },
  ] = await Promise.all([
      supabase
        .from("scheduled_workout_steps")
        .select(
          "step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, target_pace_percent_basis, target_pace_percent_min, target_pace_percent_max, repetitions, repetitions_max, rest_s, rest_max_s, instructions",
        )
        .eq("scheduled_workout_id", workoutId)
        .order("step_order")
        .returns<StepRow[]>(),
      supabase
        .from("scheduled_workout_extras")
        .select("kind, overview, count, distance_m, duration_s, items")
        .eq("scheduled_workout_id", workoutId)
        .order("extra_order")
        .returns<ExtraRow[]>(),
      supabase
        .from("completed_workouts")
        .select(
          "actual_distance_m, actual_duration_s, avg_hr, rpe, effort_level, conditions_notes, activity_type, athlete_notes, pain_reported, pain_notes, strava_activity_id, strava_activity_ids, conditions_analysis",
        )
        .eq("scheduled_workout_id", workoutId)
        .maybeSingle<CompletionRow>(),
      supabase
        .from("workout_comments")
        .select("id, author_id, body, created_at")
        .eq("scheduled_workout_id", workoutId)
        .order("created_at", { ascending: true })
        .returns<CommentRow[]>(),
      // Coach can never see this regardless (strava_pending_matches has no
      // coach SELECT policy at all -- that's the actual consent gate), but
      // skip the query for a coach anyway rather than rely on RLS alone here.
      // More than one candidate can be live at once now (two runs on the
      // same day both matching this workout) -- excludes anything already
      // dismissed, oldest activity first so candidates show in the order
      // they were actually run.
      effectiveIsCoach
        ? Promise.resolve({ data: [] as PendingMatchRow[] })
        : supabase
            .from("strava_pending_matches")
            .select("id, activity_name, activity_distance_m, activity_duration_s, activity_avg_hr, combined_activities")
            .eq("scheduled_workout_id", workoutId)
            .is("dismissed_at", null)
            .order("activity_started_at", { ascending: true })
            .returns<PendingMatchRow[]>(),
      // Keyed off athlete_id, not the viewer -- resolved identically for
      // both coach and athlete, since full transparency (which race a
      // resolved pace came from) is required for both, not coach-only.
      getAthleteMostRecentRace(supabase, workout.athlete_id),
      // Same "resolved identically for both coach and athlete" reasoning as
      // the race-result fetch above -- a percent-of-estimate prescription
      // (Canyon's own "95% 5k") resolves against the athlete's own current
      // fitness estimate, live, exactly like pace_reference already
      // resolves against their most recent race (see fitness-estimates.ts).
      getAthleteFitnessEstimates(supabase, workout.athlete_id),
      // Same "resolved identically for both coach and athlete" reasoning
      // as the pace resolution above -- a volume-percent day's real figure
      // is the coach's actual prescription, not a coach-only estimate (that
      // distinction is Weekly Load's, a separate, deliberately coach-only
      // computation this page never touches).
      workout.planned_volume_percent != null
        ? supabase
            .from("training_week_plans")
            .select("target_volume_min, target_volume_max, target_volume_unit")
            .eq("athlete_id", workout.athlete_id)
            .eq("week_start", workoutWeekStart)
            .maybeSingle<{ target_volume_min: number | null; target_volume_max: number | null; target_volume_unit: "miles" | "minutes" | null }>()
            .then((r) => r.data)
        : Promise.resolve(null),
      // The phase this workout's date falls in -- the containment rule
      // training-phases.ts already uses. Used for the coach-facing
      // missed-workout guidance (phase-specific) and, below, for showing
      // "Why this phase?" alongside "Why this workout" when the workout
      // falls inside a named phase.
      supabase
        .from("training_phases")
        .select("phase_type, explainer")
        .eq("athlete_id", workout.athlete_id)
        .lte("start_date", workout.scheduled_date)
        .gte("end_date", workout.scheduled_date)
        .limit(1)
        .returns<{ phase_type: string; explainer: string | null }[]>(),
    ]);
  const workoutWeekTarget: WeekTarget | null = weekTargetRow
    ? { targetVolumeMin: weekTargetRow.target_volume_min, targetVolumeMax: weekTargetRow.target_volume_max, targetVolumeUnit: weekTargetRow.target_volume_unit }
    : null;

  const extras: WorkoutExtraInput[] = (extraRows ?? []).map((e) => ({
    kind: e.kind,
    overview: e.overview,
    count: e.count,
    distanceM: e.distance_m,
    durationS: e.duration_s,
    items: e.items ?? [],
  }));

  const authorIds = [...new Set((commentRows ?? []).map((c) => c.author_id))];
  const { data: authorProfiles } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name, coach_display_name").in("id", authorIds).returns<Profile[]>()
    : { data: [] as Profile[] };
  const profileById = new Map((authorProfiles ?? []).map((p) => [p.id, p]));
  // coach_display_name only applies to the coach's own authored comments,
  // and only when the athlete is the one reading them -- same "coach
  // identity shown to their athlete, never to themselves" rule as the
  // messages thread page.
  const comments: CommentItem[] = (commentRows ?? []).map((c) => {
    const author = profileById.get(c.author_id);
    const useCoachName = !effectiveIsCoach && c.author_id === workout.coach_id;
    return {
      id: c.id,
      authorName: (useCoachName ? author?.coach_display_name : null) || author?.display_name || "Someone",
      body: c.body,
      createdAt: c.created_at,
      isOwn: c.author_id === session.userId,
    };
  });

  const promptActivityType = isBareXt(workout.day_label);

  // pace_reference and pace_percent_basis are mutually exclusive at the DB
  // layer -- whichever is set resolves live the same way, from a different
  // source (a race result vs. the athlete's own current fitness estimate).
  // See calendar-data.ts's identical resolvedWorkoutPace for the same
  // pattern -- this page previously only ever checked pace_reference, so a
  // Programs-generated pace-percent workout (Canyon's own "95% 5k") showed
  // no pace target at all.
  const resolvedWorkoutPace: ResolvedPaceReference | null = workout.pace_reference
    ? resolvePaceReference(workout.pace_reference, mostRecentRace)
    : workout.pace_percent_basis != null && workout.pace_percent_min != null && workout.pace_percent_max != null
      ? resolvePacePercent(workout.pace_percent_basis, workout.pace_percent_min, workout.pace_percent_max, fitnessEstimates)
      : null;
  const volumeFields =
    workout.planned_volume_percent != null
      ? resolvedVolumeToFields(resolveVolumePercent(workout.planned_volume_percent, workoutWeekTarget))
      : null;
  const effectiveVolume = effectiveWorkoutVolume({
    plannedDistanceM: workout.planned_distance_m,
    plannedDistanceMaxM: workout.planned_distance_max_m,
    plannedDurationS: workout.planned_duration_s,
    plannedDurationMaxS: workout.planned_duration_max_s,
    volumePercent: workout.planned_volume_percent,
    resolvedDistanceM: volumeFields?.resolvedDistanceM ?? null,
    resolvedDistanceMaxM: volumeFields?.resolvedDistanceMaxM ?? null,
    resolvedDurationS: volumeFields?.resolvedDurationS ?? null,
    resolvedDurationMaxS: volumeFields?.resolvedDurationMaxS ?? null,
  });

  // Planned-vs-completed (completion-comparison.ts) -- the same rule
  // every tile already follows, so the detail page's own numbers can
  // never disagree with what a tile showed to get here: on-plan needs no
  // extra line (the Completion section's own CompletionSummary already
  // reads as "one clean actual-only line"); off-plan gets the delta
  // ahead of it.
  const completionComparison = completion
    ? compareCompletionToPlan({
        plannedDistanceM: effectiveVolume.distanceM,
        plannedDistanceMaxM: effectiveVolume.distanceMaxM,
        plannedDurationS: effectiveVolume.durationS,
        plannedDurationMaxS: effectiveVolume.durationMaxS,
        actualDistanceM: completion.actual_distance_m,
        actualDurationS: completion.actual_duration_s,
      })
    : null;
  // Same RPE pairing rule as every tile (completion-comparison.ts): only
  // an extra line when prescribed and logged differ meaningfully --
  // CompletionSummary (below) already shows the logged RPE alone, so
  // "logged-only" needs nothing added here either.
  const rpeDisplay = completion ? describeRpe(workout.planned_rpe, workout.planned_rpe_max, completion.rpe) : null;

  const distanceText = formatDistanceRange(effectiveVolume.distanceM, effectiveVolume.distanceMaxM);
  const durationText = formatDurationRange(effectiveVolume.durationS, effectiveVolume.durationMaxS);
  // pace_reference and pace_percent_basis are mutually exclusive at the DB
  // layer (see resolvedWorkoutPace above) -- this mirrors that same
  // either/or into the one reference shape summarizeDayPace actually needs,
  // so the headline resolves identically regardless of which mode produced
  // it. Previously this only ever checked workout.pace_reference, which is
  // the exact bug: a pace_percent_basis workout fell through to a blank
  // formatPaceRange(null, null).
  const dayPaceReference: DayPaceReference | null = workout.pace_reference
    ? { kind: "race", key: workout.pace_reference }
    : workout.pace_percent_basis != null && workout.pace_percent_min != null && workout.pace_percent_max != null
      ? { kind: "percent", basis: workout.pace_percent_basis, min: workout.pace_percent_min, max: workout.pace_percent_max }
      : null;
  const dayPace = summarizeDayPace(dayPaceReference, resolvedWorkoutPace, workout.planned_pace_s_per_mi, workout.planned_pace_max_s_per_mi);
  const volumeUnresolvedText =
    workout.planned_volume_percent != null && distanceText == null && durationText == null
      ? `${workout.planned_volume_percent}% of week — no target set yet`
      : null;
  const rangeText = [distanceText, durationText, dayPace.text].filter(Boolean).join(" · ") || volumeUnresolvedText;
  // Only the athlete whose own data this is can actually act on the nudge
  // below -- a coach viewing a different athlete's workout has no way to
  // edit that athlete's Settings, so the sentence stays plain text for them
  // (still informative: it explains why the pace is unresolved) and is only
  // a real link when the viewer is that athlete themselves (which, for a
  // self-coached workout, is true in both the Athlete and Coach view-toggle
  // states, since it's the same session user either way).
  const phaseForWorkout = phaseRowsForWorkout?.[0] ?? null;
  const viewerIsAthlete = session.userId === workout.athlete_id;

  // Part E item 11, coach-only. Shown only for a session that genuinely
  // went missing: published, in the past, and never completed. A draft or
  // an upcoming session has nothing to advise about, and an athlete should
  // not be handed the coach's retooling rulebook.
  const workoutStatus = computeWorkoutStatus({
    publishedAt: workout.published_at,
    scheduledDate: workout.scheduled_date,
    hasCompletion: completion != null,
    today: new Date().toISOString().slice(0, 10),
  });
  const missedGuidance =
    effectiveIsCoach && workoutStatus === "missed"
      ? missedWorkoutGuidance({
          phaseKey: phaseForWorkout?.phase_type ?? null,
          workout: {
            id: workout.id,
            scheduledDate: workout.scheduled_date,
            dayLabel: workout.day_label,
            prescription: workout.notes_from_coach,
            plannedRpe: workout.planned_rpe,
            plannedRpeMax: workout.planned_rpe_max,
            pacePercentBasis:
              workout.pace_percent_basis === "marathon" || workout.pace_percent_basis === "5k"
                ? workout.pace_percent_basis
                : null,
            pacePercentMin: workout.pace_percent_min,
            pacePercentMax: workout.pace_percent_max,
            isOptional: workout.is_optional,
            phaseKey: phaseForWorkout?.phase_type ?? null,
          },
        })
      : null;
  const hrText =
    workout.planned_hr_bpm != null
      ? workout.planned_hr_max_bpm != null && workout.planned_hr_max_bpm !== workout.planned_hr_bpm
        ? `${workout.planned_hr_bpm}–${workout.planned_hr_max_bpm} bpm`
        : `${workout.planned_hr_bpm} bpm`
      : null;
  const rpeText =
    workout.planned_rpe != null
      ? workout.planned_rpe_max != null && workout.planned_rpe_max !== workout.planned_rpe
        ? `RPE ${workout.planned_rpe}-${workout.planned_rpe_max}`
        : `RPE ${workout.planned_rpe}`
      : null;
  const effortText = [hrText, rpeText].filter(Boolean).join(" · ") || null;

  return (
    <Container variant="content">
      <BackLink href={backHref}>{isCoach ? "Schedule" : "My Coaching"}</BackLink>
      {isSelfCoachedWorkout ? (
        <div className="mt-4 flex items-center gap-1 rounded-control border border-black/10 p-0.5 w-fit dark:border-white/10">
          <span className="pl-2 pr-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Viewing as</span>
          {(["athlete", "coach"] as const).map((v) => (
            <Link
              key={v}
              href={v === "athlete" ? `/coaching/workouts/${workoutId}` : `/coaching/workouts/${workoutId}?as=coach`}
              className={`rounded-control px-3 py-1 text-xs font-semibold capitalize ${
                viewAs === v
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
      ) : null}
      <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        {formatDate(workout.scheduled_date)}
        {workout.session_slot ? ` · ${workout.session_slot}` : ""}
        {/* Stated plainly rather than as a badge: on a plan built around
            doubles, which sessions are genuinely skippable is part of the
            prescription, not decoration. */}
        {workout.is_optional ? " · Optional" : ""}
      </p>
      <Heading>{getWorkoutDisplayLabel(workout.day_label, workout.title)}</Heading>
      {rangeText ? <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-300">{rangeText}</p> : null}
      {workout.is_optional ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This session is optional. Skipping it, moving it, or spreading its mileage across the week is all fine.
        </p>
      ) : null}
      {/* The framework's own stated substitute, verbatim -- a
          single-session version of a double-threshold day, or a
          single-workout version of a special block. */}
      {/* Part E item 11, coach-only. Advisory: it recommends, it changes
          nothing, and it is deliberately phase-specific because the cost of
          the same missed session differs by phase. */}
      {missedGuidance ? (
        <div className="mt-4 rounded-card border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Missed session
          </p>
          <p className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-white">{missedGuidance.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{missedGuidance.detail}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {missedGuidance.actions.map((action) => (
              <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {workout.alternative_text ? (
        <div className="mt-4 rounded-card border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Instead of this</p>
          <p className="mt-1.5 text-sm whitespace-pre-line text-zinc-700 dark:text-zinc-300">{workout.alternative_text}</p>
        </div>
      ) : null}
      {/* "Shown transparently" -- required for both coach and athlete, not
          coach-only (unlike the deferred weekly-load estimate). */}
      {resolvedWorkoutPace ? (
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Pace from {resolvedWorkoutPace.sourceLabel}</p>
      ) : dayPace.nudge ? (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {viewerIsAthlete && dayPace.nudgeHref ? (
            <Link
              href={dayPace.nudgeHref}
              className="underline decoration-black/20 underline-offset-2 hover:decoration-black dark:decoration-white/20 dark:hover:decoration-white"
            >
              {dayPace.nudge}
            </Link>
          ) : (
            dayPace.nudge
          )}
        </p>
      ) : null}
      {volumeFields?.volumeSourceLabel ? (
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Volume from {volumeFields.volumeSourceLabel}</p>
      ) : null}
      {effortText ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{effortText}</p> : null}

      {workout.notes_from_coach ? (
        <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{workout.notes_from_coach}</p>
      ) : null}

      <div className="mt-8 space-y-3">
        {stepRows && stepRows.length > 0 ? (
          stepRows.map((step, index) => (
            <Card key={index} padding="md">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {WORKOUT_STEP_TYPE_LABELS[step.step_type]}
              </p>
              <p className="mt-1 text-zinc-900 dark:text-white">
                {summarizeStep(
                  {
                    stepType: step.step_type,
                    durationS: step.duration_s,
                    durationMaxS: step.duration_max_s,
                    distanceM: step.distance_m,
                    distanceMaxM: step.distance_max_m,
                    targetType: step.target_type,
                    targetMin: step.target_min,
                    targetMax: step.target_max,
                    targetUnit: step.target_unit,
                    targetPaceReference: step.target_pace_reference,
                    targetPacePercentBasis: step.target_pace_percent_basis,
                    targetPacePercentMin: step.target_pace_percent_min,
                    targetPacePercentMax: step.target_pace_percent_max,
                    repetitions: step.repetitions,
                    repetitionsMax: step.repetitions_max,
                    restS: step.rest_s,
                    restMaxS: step.rest_max_s,
                    instructions: null,
                  },
                  step.target_pace_reference
                    ? resolvePaceReference(step.target_pace_reference, mostRecentRace)
                    : step.target_pace_percent_basis != null && step.target_pace_percent_min != null && step.target_pace_percent_max != null
                      ? resolvePacePercent(step.target_pace_percent_basis, step.target_pace_percent_min, step.target_pace_percent_max, fitnessEstimates)
                      : undefined,
                )}
              </p>
              {step.instructions ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{step.instructions}</p> : null}
            </Card>
          ))
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No structured steps -- see the notes above.</p>
        )}
      </div>

      {/* "Why this workout": the educational half of the session, for a
          coached athlete reading their own training or their coach reading
          it with them. An unrecognized day_label resolves to null and this
          whole block disappears, which is why there's no fallback copy --
          a session with no entry reads as a session with no explanation
          rather than a generic one. */}
      {glossaryEntry && showEducation ? (
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Why this workout
          </p>
          <Card padding="md" className="mt-3">
            <p className="font-semibold text-zinc-900 dark:text-white">{glossaryEntry.name}</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">{glossaryEntry.whatItIs}</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">{glossaryEntry.howToExecute}</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-600 dark:text-zinc-300">What it builds: </span>
              {glossaryEntry.whatItBuilds}
            </p>
            {glossaryEntry.coachAssignOnly ? (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                An advanced session your coach assigns deliberately, not one to add on your own.
              </p>
            ) : null}
            {/* The phase this workout falls in, if any -- resolvePhaseExplainer
                inside PhaseExplainer renders nothing for an unnamed/unrecognized
                phase, so a workout outside any named phase shows no extra
                section here, same "nothing invented" rule as glossaryEntry. */}
            {phaseForWorkout ? (
              <PhaseExplainer phaseType={phaseForWorkout.phase_type} explainer={phaseForWorkout.explainer} />
            ) : null}
            <Link
              href="/coaching/learn/workout-types"
              className="mt-4 inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              All workout types
            </Link>
          </Card>
        </div>
      ) : null}

      {extras.length > 0 ? (
        <div className="mt-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Extras</p>
          <div className="mt-3">
            <ExtrasDetail extras={extras} />
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Completion</p>
        {completion ? (
          <div className="mt-3">
            {completion.pain_reported ? (
              <div className="mb-3">
                <Badge tone="error">Pain reported</Badge>
                {completion.pain_notes ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{completion.pain_notes}</p> : null}
                {/* Part I item 23, coach-only. The athlete's own completion
                    report never sees the injury-paradigm classifier -- it is
                    decision support for the coach's judgment call, not
                    something to hand an athlete who is in pain right now. */}
                {effectiveIsCoach ? <InjuryTriagePanel /> : null}
              </div>
            ) : null}
            {completion.activity_type ? (
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Cross-training: {completion.activity_type}</p>
            ) : null}
            {completionComparison && !completionComparison.onPlan && (completionComparison.distanceDelta || completionComparison.durationDelta) ? (
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
                {[
                  completionComparison.distanceDelta ? formatDistanceDelta(completionComparison.distanceDelta, "full") : null,
                  completionComparison.durationDelta ? formatDurationDelta(completionComparison.durationDelta) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {rpeDisplay && rpeDisplay.kind === "pair" ? (
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">{formatRpeDisplay(rpeDisplay)}</p>
            ) : null}
            <CompletionSummary
              completion={
                {
                  actual_distance_m: completion.actual_distance_m,
                  actual_time_s: completion.actual_duration_s,
                  rpe: completion.rpe,
                  avg_hr: completion.avg_hr,
                  notes: completion.athlete_notes,
                } satisfies CompletionDetail
              }
            />
            <ConditionsSection
              scheduledWorkoutId={workoutId}
              hasStravaActivity={completion.strava_activity_id != null}
              analysis={completion.conditions_analysis}
            />

            {/* The effort/conditions context behind the RPE above. This is
                what a fitness-estimate review actually reads: an easy 8 in
                90-degree heat means something different from an easy 8 on a
                perfect day. */}
            {completion.effort_level || completion.conditions_notes ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {effortLevelLabel(completion.effort_level)}
                {completion.effort_level && completion.conditions_notes ? " · " : ""}
                {completion.conditions_notes}
              </p>
            ) : null}
            {!effectiveIsCoach ? (
              <div className="mt-3">
                <CompletionForm
                  scheduledWorkoutId={workoutId}
                  hasExisting
                  stravaSourced={completion.strava_activity_id != null}
                  promptActivityType={promptActivityType}
                  initial={
                    {
                      actualDistanceInput:
                        completion.actual_distance_m != null ? (completion.actual_distance_m / MILE_METERS).toFixed(2) : "",
                      actualDurationInput: completion.actual_duration_s != null ? formatClock(completion.actual_duration_s) : "",
                      avgHeartRateInput: completion.avg_hr != null ? String(completion.avg_hr) : "",
                      rpeInput: completion.rpe != null ? String(completion.rpe) : "",
                      effortLevelInput: completion.effort_level ?? "",
                      conditionsNotesInput: completion.conditions_notes ?? "",
                      activityTypeInput: completion.activity_type ?? "",
                      athleteNotesInput: completion.athlete_notes ?? "",
                      painReported: completion.pain_reported,
                      painNotesInput: completion.pain_notes ?? "",
                    } satisfies CompletionFormInitial
                  }
                />
              </div>
            ) : null}
          </div>
        ) : effectiveIsCoach ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Not completed yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pendingMatches && pendingMatches.length > 0 ? (
              <StravaMatchReview
                matches={pendingMatches.map(
                  (m): PendingStravaMatch => ({
                    id: m.id,
                    scheduledWorkoutId: workoutId,
                    activityName: m.activity_name,
                    distanceM: m.activity_distance_m,
                    durationS: m.activity_duration_s,
                    avgHr: m.activity_avg_hr,
                    combinedActivities: m.combined_activities,
                  }),
                )}
              />
            ) : null}
            <CompletionForm scheduledWorkoutId={workoutId} hasExisting={false} promptActivityType={promptActivityType} />
          </div>
        )}
      </div>

      <div className="mt-8">
        <WorkoutComments scheduledWorkoutId={workoutId} comments={comments} isCoach={effectiveIsCoach} />
      </div>
    </Container>
  );
}
