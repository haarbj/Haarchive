import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Flag } from "lucide-react";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { WorkoutType } from "@/lib/coaching-engine";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";
import { mostRecentMonday, shiftWeek, shiftMonth, weekDates, monthGridDates, addDays } from "@/lib/week";
import { formatDate } from "@/lib/format";
import { getAthleteGoalRace, weeksUntilGoalRace, formatGoalRaceContext, formatWeeksAwayLabel } from "@/lib/private-coaching/goal-race";
import { getAthleteMostRecentRace, resolvePaceReference } from "@/lib/private-coaching/pace-reference";
import {
  getPhaseForWeek,
  weekPositionInPhase,
  roadmapWeeks,
  type TrainingPhase,
} from "@/lib/private-coaching/training-phases";
import { fetchCalendarWorkouts, fetchWeekSummary, mapSteps, type StepRow } from "./calendar-data";
import { WeekCalendar } from "./week-calendar";
import { DayView } from "./day-view";
import { MonthView, type MonthWeekSummary } from "./month-view";
import { PhaseView, type PhaseViewWeekInfo } from "./phase-view";
import type { ProgramOption } from "./assign-program-form";
import { WeekStrip } from "./week-strip";
import { WeekCopyPasteControls } from "./week-copy-paste-controls";
import type { TemplateOption } from "./workout-form";
import type { ExtraPresetOption } from "./actions";
import type { PhaseGoalOption } from "./phase-form";
import { AthleteSwitcher, type RosterOption } from "./athlete-switcher";
import { WeekPlanEditor, type WeekPlanValues } from "./week-plan-editor";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type CalendarView = "week" | "day" | "month" | "phase";

type Profile = { display_name: string };
type ExtraPresetRow = {
  id: string;
  name: string;
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};
type WeekPlanRow = {
  week_start: string;
  label: string | null;
  target_volume_min: number | null;
  target_volume_max: number | null;
  target_volume_unit: "miles" | "minutes" | null;
  notes: string | null;
};
type TemplateRow = {
  id: string;
  name: string;
  workout_type: WorkoutType | null;
  day_label: string | null;
  session_slot: string | null;
  planned_distance_m: number | null;
  planned_distance_max_m: number | null;
  planned_duration_s: number | null;
  planned_duration_max_s: number | null;
  planned_pace_s_per_mi: number | null;
  planned_pace_max_s_per_mi: number | null;
  pace_reference: PaceReferenceKey | null;
  planned_volume_percent: number | null;
  planned_hr_bpm: number | null;
  planned_hr_max_bpm: number | null;
  planned_rpe: number | null;
  planned_rpe_max: number | null;
};
type TemplateExtraRow = {
  template_id: string;
  kind: string;
  overview: string | null;
  count: number | null;
  distance_m: number | null;
  duration_s: number | null;
  items: string[] | null;
};
type PhaseRow = {
  id: string;
  athlete_id: string;
  phase_type: string;
  name: string | null;
  start_date: string;
  end_date: string;
  goal_id: string | null;
  notes: string | null;
  explainer: string | null;
  source_program_id: string | null;
  source_program_phase_definition_id: string | null;
};
type GoalOptionRow = { id: string; race_name: string; goal_date: string };

function isValidIsoDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function AthleteSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ view?: string; week?: string; date?: string; month?: string; copiedWeek?: string; assignProgramId?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");
  const { athleteId } = await params;
  const sp = await searchParams;

  // A program's own "Assign to athlete" deep link always lands on Phase
  // View with the assign form open, regardless of whatever view= it was
  // given (there isn't one) -- the assign flow only exists there.
  const view: CalendarView = sp.assignProgramId
    ? "phase"
    : sp.view === "day" || sp.view === "month" || sp.view === "phase"
      ? sp.view
      : "week";
  const copiedWeek = isValidIsoDate(sp.copiedWeek) ? sp.copiedWeek : null;
  const today = new Date().toISOString().slice(0, 10);

  // A single canonical "reference date," derived from whichever param the
  // active view actually uses -- lets every view's own tab link (Week/Day/
  // Month/Phase) land somewhere sensible relative to what's currently on
  // screen, rather than always resetting to today.
  const referenceDate = isValidIsoDate(sp.date)
    ? sp.date
    : isValidIsoDate(sp.week)
      ? sp.week
      : sp.month && /^\d{4}-\d{2}$/.test(sp.month)
        ? `${sp.month}-01`
        : today;
  const week = isValidIsoDate(sp.week) ? sp.week : mostRecentMonday(new Date(`${referenceDate}T00:00:00Z`));
  const date = isValidIsoDate(sp.date) ? sp.date : referenceDate;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : referenceDate.slice(0, 7);

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", athleteId).maybeSingle<Profile>();
  if (!profile) notFound();

  // Shared across every view: templates/extraPresets (create/edit
  // affordances in Week and Day views), the coach's roster (AthleteSwitcher),
  // the athlete's goal race, and their training phases -- all cheap,
  // coach-or-athlete-scoped reads, not per-view-bounded like workout data.
  const { data: templateRows } = await supabase
    .from("workout_templates")
    .select(
      "id, name, workout_type, day_label, session_slot, planned_distance_m, planned_distance_max_m, planned_duration_s, planned_duration_max_s, planned_pace_s_per_mi, planned_pace_max_s_per_mi, pace_reference, planned_volume_percent, planned_hr_bpm, planned_hr_max_bpm, planned_rpe, planned_rpe_max",
    )
    .eq("coach_id", session.userId)
    .order("name")
    .returns<TemplateRow[]>();
  const templateIds = (templateRows ?? []).map((t) => t.id);
  const [{ data: templateStepRows }, { data: templateExtraRows }] = await Promise.all([
    templateIds.length
      ? supabase
          .from("workout_template_steps")
          .select(
            "template_id, step_type, duration_s, duration_max_s, distance_m, distance_max_m, target_type, target_min, target_max, target_unit, target_pace_reference, repetitions, repetitions_max, rest_s, rest_max_s, instructions",
          )
          .in("template_id", templateIds)
          .order("step_order")
      : Promise.resolve({ data: [] }),
    templateIds.length
      ? supabase
          .from("workout_template_extras")
          .select("template_id, kind, overview, count, distance_m, duration_s, items")
          .in("template_id", templateIds)
          .order("extra_order")
          .returns<TemplateExtraRow[]>()
      : Promise.resolve({ data: [] as TemplateExtraRow[] }),
  ]);
  const templateStepsRaw = (templateStepRows ?? []).map(
    (r) =>
      ({
        ...r,
        parent_id: r.template_id,
        target_pace_percent_basis: null,
        target_pace_percent_min: null,
        target_pace_percent_max: null,
      }) as StepRow,
  );
  const templateExtrasByTemplateId = new Map<string, { kind: string; overview: string | null; count: number | null; distanceM: number | null; durationS: number | null; items: string[] }[]>();
  for (const row of templateExtraRows ?? []) {
    const list = templateExtrasByTemplateId.get(row.template_id) ?? [];
    list.push({ kind: row.kind, overview: row.overview, count: row.count, distanceM: row.distance_m, durationS: row.duration_s, items: row.items ?? [] });
    templateExtrasByTemplateId.set(row.template_id, list);
  }
  const templates: TemplateOption[] = (templateRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    dayLabel: t.day_label,
    sessionSlot: t.session_slot,
    plannedDistanceM: t.planned_distance_m,
    plannedDistanceMaxM: t.planned_distance_max_m,
    plannedDurationS: t.planned_duration_s,
    plannedDurationMaxS: t.planned_duration_max_s,
    plannedPaceSPerMi: t.planned_pace_s_per_mi,
    plannedPaceMaxSPerMi: t.planned_pace_max_s_per_mi,
    plannedPaceReference: t.pace_reference,
    plannedVolumePercent: t.planned_volume_percent,
    plannedHrBpm: t.planned_hr_bpm,
    plannedHrMaxBpm: t.planned_hr_max_bpm,
    plannedRpe: t.planned_rpe,
    plannedRpeMax: t.planned_rpe_max,
    extras: templateExtrasByTemplateId.get(t.id) ?? [],
    workoutType: t.workout_type,
    steps: mapSteps(templateStepsRaw, t.id),
  }));

  const { data: extraPresetRows } = await supabase
    .from("coach_extra_presets")
    .select("id, name, kind, overview, count, distance_m, duration_s, items")
    .eq("coach_id", session.userId)
    .order("name")
    .returns<ExtraPresetRow[]>();
  const extraPresets: ExtraPresetOption[] = (extraPresetRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    overview: p.overview,
    count: p.count,
    distanceM: p.distance_m,
    durationS: p.duration_s,
    items: p.items ?? [],
  }));

  const { data: relationships } = await supabase
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", session.userId)
    .eq("status", "active")
    .returns<{ athlete_id: string }[]>();
  const rosterIds = (relationships ?? []).map((r) => r.athlete_id);
  const { data: rosterProfiles } = rosterIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", rosterIds).returns<{ id: string; display_name: string }[]>()
    : { data: [] as { id: string; display_name: string }[] };
  const roster: RosterOption[] = (rosterProfiles ?? [])
    .map((p) => ({ athleteId: p.id, displayName: p.display_name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const goalRace = await getAthleteGoalRace(supabase, athleteId);

  const { data: phaseRows } = await supabase
    .from("training_phases")
    .select(
      "id, athlete_id, phase_type, name, start_date, end_date, goal_id, notes, explainer, source_program_id, source_program_phase_definition_id",
    )
    .eq("athlete_id", athleteId)
    .order("start_date")
    .returns<PhaseRow[]>();
  const phases: TrainingPhase[] = (phaseRows ?? []).map((p) => ({
    id: p.id,
    athleteId: p.athlete_id,
    phaseType: p.phase_type,
    name: p.name,
    startDate: p.start_date,
    endDate: p.end_date,
    goalId: p.goal_id,
    notes: p.notes,
    explainer: p.explainer,
    sourceProgramId: p.source_program_id,
    sourceProgramPhaseDefinitionId: p.source_program_phase_definition_id,
  }));

  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, race_name, goal_date")
    .eq("user_id", athleteId)
    .eq("status", "active")
    .not("goal_date", "is", null)
    .order("goal_date")
    .returns<GoalOptionRow[]>();
  const goalOptions: PhaseGoalOption[] = (goalRows ?? []).map((g) => ({ id: g.id, raceName: g.race_name, goalDate: g.goal_date }));

  // Tab links preserve the reference date translated into each view's own
  // param, not just reset to today -- switching from "looking at Sep 14"
  // in Week View to Day View lands on Sep 14, not today.
  function tabHref(targetView: CalendarView) {
    if (targetView === "week") return `?view=week&week=${week}`;
    if (targetView === "day") return `?view=day&date=${date}`;
    if (targetView === "month") return `?view=month&month=${month}`;
    return "?view=phase";
  }
  const switcherQueryString = new URLSearchParams(
    view === "week"
      ? { view: "week", week }
      : view === "day"
        ? { view: "day", date }
        : view === "month"
          ? { view: "month", month }
          : { view: "phase" },
  ).toString();

  return (
    <Container variant="content">
      <BackLink href={`/coaching/athletes/${athleteId}`}>{profile.display_name}</BackLink>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1 rounded-control border border-black/10 p-0.5 dark:border-white/10">
          {(["week", "day", "month", "phase"] as const).map((v) => (
            <Link
              key={v}
              href={tabHref(v)}
              className={`rounded-control px-3 py-1.5 text-xs font-semibold capitalize ${
                view === v
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {v}
            </Link>
          ))}
        </nav>
        <AthleteSwitcher currentAthleteId={athleteId} queryString={switcherQueryString} roster={roster} />
      </div>

      {view === "week" ? (
        <WeekViewSection
          athleteId={athleteId}
          week={week}
          today={today}
          copiedWeek={copiedWeek}
          phases={phases}
          goalRace={goalRace}
          templates={templates}
          extraPresets={extraPresets}
          supabase={supabase}
          session={session}
        />
      ) : null}

      {view === "day" ? (
        <DayViewSection
          athleteId={athleteId}
          date={date}
          today={today}
          phases={phases}
          goalRace={goalRace}
          templates={templates}
          extraPresets={extraPresets}
          supabase={supabase}
          session={session}
        />
      ) : null}

      {view === "month" ? (
        <MonthViewSection
          athleteId={athleteId}
          month={month}
          today={today}
          phases={phases}
          goalRace={goalRace}
          templates={templates}
          extraPresets={extraPresets}
          copiedWeek={copiedWeek}
          supabase={supabase}
          session={session}
        />
      ) : null}

      {view === "phase" ? (
        <PhaseViewSection
          athleteId={athleteId}
          phases={phases}
          goalRace={goalRace}
          goalOptions={goalOptions}
          copiedWeek={copiedWeek}
          supabase={supabase}
          preselectProgramId={sp.assignProgramId ?? null}
        />
      ) : null}
    </Container>
  );
}

// ---- Per-view sections -----------------------------------------------
// Each is an async Server Component doing exactly the fetch its own view
// needs (bounded to that view's date range), never the others' -- Day
// fetches one date, Week fetches its own week plus two adjacent-week
// summaries, Month fetches the grid range, Phase fetches only
// training_week_plans metadata for the weeks its roadmap actually shows.
// None of these ever query strava_pending_matches.

async function WeekViewSection({
  athleteId,
  week,
  today,
  copiedWeek,
  phases,
  goalRace,
  templates,
  extraPresets,
  supabase,
  session,
}: {
  athleteId: string;
  week: string;
  today: string;
  copiedWeek: string | null;
  phases: TrainingPhase[];
  goalRace: Awaited<ReturnType<typeof getAthleteGoalRace>>;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  supabase: Awaited<ReturnType<typeof createClient>>;
  session: { userId: string };
}) {
  const days = weekDates(week);
  const prevWeek = shiftWeek(week, -1);
  const nextWeek = shiftWeek(week, 1);
  const thisWeek = mostRecentMonday(new Date());

  const [workoutsByDate, prevSummary, nextSummary, weekPlanRow, mostRecentRace, coachProfile] = await Promise.all([
    fetchCalendarWorkouts(supabase, athleteId, session.userId, days, today),
    fetchWeekSummary(supabase, athleteId, session.userId, prevWeek, addDays(prevWeek, 6)),
    fetchWeekSummary(supabase, athleteId, session.userId, nextWeek, addDays(nextWeek, 6)),
    supabase
      .from("training_week_plans")
      .select("label, target_volume_min, target_volume_max, target_volume_unit, notes")
      .eq("athlete_id", athleteId)
      .eq("week_start", week)
      .maybeSingle<WeekPlanRow>()
      .then((r) => r.data),
    // Weekly Load's own reconciliation needs the athlete's easy pace to
    // estimate a duration-only non-XT day into mileage -- see
    // weekly-load.ts. A second getAthleteMostRecentRace call alongside
    // fetchCalendarWorkouts's own internal one (self-contained, same
    // reasoning as that module's own comment on why it re-resolves rather
    // than trusting a caller to already have it).
    getAthleteMostRecentRace(supabase, athleteId),
    supabase
      .from("profiles")
      .select("coach_default_volume_unit")
      .eq("id", session.userId)
      .maybeSingle<{ coach_default_volume_unit: "miles" | "minutes" | null }>()
      .then((r) => r.data),
  ]);
  // Easy is a zone (a fast/slow range), not a point value -- the estimate
  // uses the zone's own midpoint ("around that pace") rather than either
  // edge, which would systematically over- or under-estimate distance for
  // a given duration.
  const resolvedEasyPace = resolvePaceReference("easy", mostRecentRace);
  const easyPaceSPerMi = resolvedEasyPace
    ? resolvedEasyPace.maxSPerMi != null
      ? Math.round((resolvedEasyPace.minSPerMi + resolvedEasyPace.maxSPerMi) / 2)
      : resolvedEasyPace.minSPerMi
    : null;
  const volumeUnitPreference: "miles" | "minutes" = coachProfile?.coach_default_volume_unit ?? "miles";

  const weekPlan: WeekPlanValues = {
    label: weekPlanRow?.label ?? null,
    targetVolumeMin: weekPlanRow?.target_volume_min ?? null,
    targetVolumeMax: weekPlanRow?.target_volume_max ?? null,
    targetVolumeUnit: weekPlanRow?.target_volume_unit ?? null,
    notes: weekPlanRow?.notes ?? null,
  };

  const phase = getPhaseForWeek(phases, week);
  const position = phase ? weekPositionInPhase(phase, week) : null;
  const goalContext = formatGoalRaceContext(weeksUntilGoalRace(week, goalRace?.goalDate ?? null), goalRace?.raceName ?? null);

  return (
    <>
      <div className="mt-4">
        {phase ? (
          <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">
            {phase.phaseType}
            {phase.name ? ` — ${phase.name}` : ""}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href={`?view=week&week=${prevWeek}${copiedWeek ? `&copiedWeek=${copiedWeek}` : ""}`}
            className="rounded-control border border-black/10 px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="Previous week"
          >
            ‹
          </Link>
          <Heading variant="compact">
            {position ? `Week ${position.week} of ${position.of} · ` : ""}
            {formatDate(days[0])} – {formatDate(days[6])}
          </Heading>
          <Link
            href={`?view=week&week=${nextWeek}${copiedWeek ? `&copiedWeek=${copiedWeek}` : ""}`}
            className="rounded-control border border-black/10 px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="Next week"
          >
            ›
          </Link>
          {week !== thisWeek ? (
            <Link
              href={`?view=week&week=${thisWeek}`}
              className="rounded-pill border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Today
            </Link>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{goalContext}</p>
      </div>

      <WeekPlanEditor key={week} athleteId={athleteId} weekStart={week} initial={weekPlan} />
      <div className="mt-2">
        <WeekCopyPasteControls athleteId={athleteId} baseParams={{ view: "week", week }} week={week} copiedWeek={copiedWeek} />
      </div>

      <div className="mt-4">
        <WeekStrip
          athleteId={athleteId}
          pageWeek={week}
          weekStart={prevWeek}
          weekEnd={addDays(prevWeek, 6)}
          summary={prevSummary}
          phases={phases}
          copiedWeek={copiedWeek}
          label="Previous week"
        />
      </div>

      <div className="mt-4">
        <WeekCalendar
          key={week}
          athleteId={athleteId}
          days={days}
          workoutsByDate={workoutsByDate}
          templates={templates}
          extraPresets={extraPresets}
          today={today}
          easyPaceSPerMi={easyPaceSPerMi}
          volumeUnitPreference={volumeUnitPreference}
          weekPlan={weekPlan}
        />
      </div>

      <div className="mt-4">
        <WeekStrip
          athleteId={athleteId}
          pageWeek={week}
          weekStart={nextWeek}
          weekEnd={addDays(nextWeek, 6)}
          summary={nextSummary}
          phases={phases}
          copiedWeek={copiedWeek}
          label="Next week"
        />
      </div>
    </>
  );
}

async function DayViewSection({
  athleteId,
  date,
  today,
  phases,
  goalRace,
  templates,
  extraPresets,
  supabase,
  session,
}: {
  athleteId: string;
  date: string;
  today: string;
  phases: TrainingPhase[];
  goalRace: Awaited<ReturnType<typeof getAthleteGoalRace>>;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  supabase: Awaited<ReturnType<typeof createClient>>;
  session: { userId: string };
}) {
  const workoutsByDate = await fetchCalendarWorkouts(supabase, athleteId, session.userId, [date], today);
  const containingWeek = mostRecentMonday(new Date(`${date}T00:00:00Z`));
  const prevDay = addDays(date, -1);
  const nextDay = addDays(date, 1);
  const phase = getPhaseForWeek(phases, containingWeek);
  const position = phase ? weekPositionInPhase(phase, containingWeek) : null;
  const goalContext = formatGoalRaceContext(weeksUntilGoalRace(containingWeek, goalRace?.goalDate ?? null), goalRace?.raceName ?? null);

  return (
    <>
      <div className="mt-4">
        {phase ? (
          <p className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-white">
            {phase.phaseType}
            {phase.name ? ` — ${phase.name}` : ""}
            {position ? ` · Week ${position.week} of ${position.of}` : ""}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href={`?view=day&date=${prevDay}`}
            className="rounded-control border border-black/10 px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="Previous day"
          >
            ‹
          </Link>
          <Heading variant="compact">{formatDate(date)}</Heading>
          <Link
            href={`?view=day&date=${nextDay}`}
            className="rounded-control border border-black/10 px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="Next day"
          >
            ›
          </Link>
          {date !== today ? (
            <Link
              href={`?view=day&date=${today}`}
              className="rounded-pill border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Today
            </Link>
          ) : null}
          <Link
            href={`?view=week&week=${containingWeek}`}
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            View week
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{goalContext}</p>
      </div>

      <div className="mt-4">
        <DayView athleteId={athleteId} date={date} workouts={workoutsByDate[date] ?? []} templates={templates} extraPresets={extraPresets} />
      </div>
    </>
  );
}

async function MonthViewSection({
  athleteId,
  month,
  today,
  phases,
  goalRace,
  templates,
  extraPresets,
  copiedWeek,
  supabase,
  session,
}: {
  athleteId: string;
  month: string;
  today: string;
  phases: TrainingPhase[];
  goalRace: Awaited<ReturnType<typeof getAthleteGoalRace>>;
  templates: TemplateOption[];
  extraPresets: ExtraPresetOption[];
  copiedWeek: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  session: { userId: string };
}) {
  const gridDates = monthGridDates(month);
  const weekStarts = gridDates.filter((_, i) => i % 7 === 0);
  const [workoutsByDate, weekPlanRows] = await Promise.all([
    fetchCalendarWorkouts(supabase, athleteId, session.userId, gridDates, today),
    supabase
      .from("training_week_plans")
      .select("week_start, label, target_volume_min, target_volume_max, target_volume_unit, notes")
      .eq("athlete_id", athleteId)
      .in("week_start", weekStarts)
      .returns<WeekPlanRow[]>()
      .then((r) => r.data ?? []),
  ]);
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = today.slice(0, 7);

  // A small read-only phase label if a single phase covers the whole
  // visible month -- omitted (not attempted as a partial/spanning visual)
  // if the month spans a phase transition or has no phase coverage at all.
  const monthDatesInTargetMonth = gridDates.filter((d) => d.slice(0, 7) === month);
  const phasesForMonth = new Set(
    monthDatesInTargetMonth.map((d) => getPhaseForWeek(phases, mostRecentMonday(new Date(`${d}T00:00:00Z`)))?.id).filter(Boolean),
  );
  const uniformPhase = phasesForMonth.size === 1 ? phases.find((p) => phasesForMonth.has(p.id)) : null;

  // Per-row context, keyed by that row's own Monday: title (a coach-set
  // week label if one exists, else the covering phase's type, else
  // nothing invented), the coach's own target volume (training_week_plans,
  // the same field WeekPlanEditor's "Target: 35–40 miles" reads --
  // deliberately NOT a sum of scheduled workouts, see MonthWeekSummary's
  // own comment), and distance to the goal race. This is what makes Month
  // View answer "what week is this and what's the target" without a coach
  // having to jump into Week or Phase View first.
  const weekPlanByStart = new Map(weekPlanRows.map((r) => [r.week_start, r]));
  const weekSummaries: Record<string, MonthWeekSummary> = {};
  for (const weekStart of weekStarts) {
    const plan = weekPlanByStart.get(weekStart);
    const phase = getPhaseForWeek(phases, weekStart);
    weekSummaries[weekStart] = {
      weekStart,
      title: plan?.label ?? (phase ? phase.phaseType : null),
      rawLabel: plan?.label ?? null,
      rawNotes: plan?.notes ?? null,
      targetVolumeMin: plan?.target_volume_min ?? null,
      targetVolumeMax: plan?.target_volume_max ?? null,
      targetVolumeUnit: plan?.target_volume_unit ?? null,
      weeksAwayLabel: formatWeeksAwayLabel(weeksUntilGoalRace(weekStart, goalRace?.goalDate ?? null)),
    };
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`?view=month&month=${prevMonth}`}
          className="rounded-control border border-black/10 px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          aria-label="Previous month"
        >
          ‹
        </Link>
        <Heading variant="compact">
          {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
        </Heading>
        <Link
          href={`?view=month&month=${nextMonth}`}
          className="rounded-control border border-black/10 px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          aria-label="Next month"
        >
          ›
        </Link>
        {month !== thisMonth ? (
          <Link
            href={`?view=month&month=${thisMonth}`}
            className="rounded-pill border border-black/10 px-3 py-1 text-xs font-semibold text-zinc-600 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            Today
          </Link>
        ) : null}
        {uniformPhase ? (
          <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">
            Phase: {uniformPhase.phaseType}
          </span>
        ) : null}
      </div>

      {/* A standing, always-visible goal-race fact -- independent of which
          month is on screen -- so a coach never has to navigate to Phase
          View just to be reminded what the athlete is training for. The
          per-row "weeks away" column below carries the actual countdown;
          this line is the race itself. */}
      {goalRace ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-accent-navy">
          <Flag className="h-4 w-4" aria-hidden />
          {goalRace.raceName} · {formatDate(goalRace.goalDate)}
        </p>
      ) : null}

      <div className="mt-4">
        <MonthView
          athleteId={athleteId}
          monthIso={month}
          gridDates={gridDates}
          workoutsByDate={workoutsByDate}
          today={today}
          templates={templates}
          extraPresets={extraPresets}
          goalRace={goalRace}
          weekSummaries={weekSummaries}
          copiedWeek={copiedWeek}
        />
      </div>
    </>
  );
}

async function PhaseViewSection({
  athleteId,
  phases,
  goalRace,
  goalOptions,
  copiedWeek,
  supabase,
  preselectProgramId,
}: {
  athleteId: string;
  phases: TrainingPhase[];
  goalRace: Awaited<ReturnType<typeof getAthleteGoalRace>>;
  goalOptions: PhaseGoalOption[];
  copiedWeek: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  preselectProgramId: string | null;
}) {
  // Every week the roadmap will actually render: each phase's own weeks
  // plus any Unphased gap weeks between consecutive phases -- bounded to
  // exactly what's shown, never the athlete's whole history. Uses the
  // exact same section-building logic PhaseView itself renders from
  // (roadmapWeeks/buildRoadmapSections, training-phases.ts), so the
  // weeks this query fetches training_week_plans for can never drift out
  // of sync with the weeks the client actually displays.
  const weekList = roadmapWeeks(phases);
  // Bounded to [earliest phase start, latest phase end] -- the same
  // "exactly what's shown, never the athlete's whole history" rule
  // weekList itself already follows -- rather than one query per phase,
  // since phases on this page never overlap (savePhase enforces it).
  const phaseDraftRange = phases.length
    ? { start: phases.reduce((min, p) => (p.startDate < min ? p.startDate : min), phases[0].startDate), end: phases.reduce((max, p) => (p.endDate > max ? p.endDate : max), phases[0].endDate) }
    : null;
  const [{ data: weekPlanRows }, programs, { data: phaseWorkoutRows }] = await Promise.all([
    weekList.length
      ? supabase
          .from("training_week_plans")
          .select("week_start, label, target_volume_min, target_volume_max, target_volume_unit, notes")
          .eq("athlete_id", athleteId)
          .in("week_start", weekList)
          .returns<WeekPlanRow[]>()
      : Promise.resolve({ data: [] as WeekPlanRow[] }),
    loadProgramOptions(supabase),
    phaseDraftRange
      ? supabase
          .from("scheduled_workouts")
          .select("id, scheduled_date")
          .eq("athlete_id", athleteId)
          .is("published_at", null)
          .gte("scheduled_date", phaseDraftRange.start)
          .lte("scheduled_date", phaseDraftRange.end)
          .returns<{ id: string; scheduled_date: string }[]>()
      : Promise.resolve({ data: [] as { id: string; scheduled_date: string }[] }),
  ]);

  const weekInfoByWeek: Record<string, PhaseViewWeekInfo> = {};
  for (const row of weekPlanRows ?? []) {
    weekInfoByWeek[row.week_start] = {
      label: row.label,
      targetVolumeMin: row.target_volume_min,
      targetVolumeMax: row.target_volume_max,
      targetVolumeUnit: row.target_volume_unit,
    };
  }

  // Every still-draft workout id, bucketed by whichever phase's date range
  // actually contains it -- a phase's own "Publish phase" button only ever
  // sees ids inside its own [startDate, endDate], never a neighboring
  // phase's or an Unphased gap's.
  const draftIdsByPhase: Record<string, string[]> = {};
  for (const row of phaseWorkoutRows ?? []) {
    const phase = phases.find((p) => row.scheduled_date >= p.startDate && row.scheduled_date <= p.endDate);
    if (!phase) continue;
    (draftIdsByPhase[phase.id] ??= []).push(row.id);
  }

  return (
    <div className="mt-6">
      <PhaseView
        athleteId={athleteId}
        phases={phases}
        weekInfoByWeek={weekInfoByWeek}
        draftIdsByPhase={draftIdsByPhase}
        goalRace={goalRace}
        goalOptions={goalOptions}
        copiedWeek={copiedWeek}
        programs={programs}
        preselectProgramId={preselectProgramId}
      />
    </div>
  );
}

type ProgramRow = {
  id: string;
  name: string;
  scales_distance_with_mileage: boolean;
  scales_duration_with_mileage: boolean;
  framework_key: string | null;
};
type VariantRow = { id: string; program_id: string; name: string };
type VariantPhaseRow = { variant_id: string; phase_definition_id: string; position: number };
type PhaseDefRow = {
  id: string;
  program_id: string;
  phase_key: string;
  name: string | null;
  duration_weeks_min: number;
  duration_weeks_max: number;
  is_optional: boolean;
};

type VolumeVariantRow = {
  id: string;
  program_id: string;
  name: string;
  position: number;
  peak_mileage: number | null;
  initial_mileage: number | null;
};

// This coach's whole Program library, assembled in JS from separate
// queries (same pattern assign-program-actions.ts's own loadResolvedGeneration
// already uses) rather than a deep nested PostgREST embed -- feeds
// AssignProgramForm's program/variant/phase pickers. RLS scopes every one
// of these four tables to coach_id = auth.uid() already (see the Programs
// migrations), so no explicit coach filter is needed here.
async function loadProgramOptions(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ProgramOption[]> {
  const { data: programRows } = await supabase
    .from("training_programs")
    .select("id, name, scales_distance_with_mileage, scales_duration_with_mileage, framework_key")
    .order("name")
    .returns<ProgramRow[]>();
  const programIds = (programRows ?? []).map((p) => p.id);
  if (programIds.length === 0) return [];

  const [{ data: variantRows }, { data: phaseDefRows }, { data: variantPhaseRows }, { data: volumeVariantRows }] = await Promise.all([
    supabase.from("program_duration_variants").select("id, program_id, name").in("program_id", programIds).order("name").returns<VariantRow[]>(),
    supabase
      .from("program_phase_definitions")
      .select("id, program_id, phase_key, name, duration_weeks_min, duration_weeks_max, is_optional")
      .in("program_id", programIds)
      .returns<PhaseDefRow[]>(),
    supabase.from("program_variant_phases").select("variant_id, phase_definition_id, position").order("position").returns<VariantPhaseRow[]>(),
    supabase
      .from("program_volume_variants")
      .select("id, program_id, name, position, peak_mileage, initial_mileage")
      .in("program_id", programIds)
      .order("position")
      .returns<VolumeVariantRow[]>(),
  ]);

  const phaseDefById = new Map((phaseDefRows ?? []).map((p) => [p.id, p]));
  const variantPhasesByVariant = new Map<string, VariantPhaseRow[]>();
  for (const row of variantPhaseRows ?? []) {
    const list = variantPhasesByVariant.get(row.variant_id) ?? [];
    list.push(row);
    variantPhasesByVariant.set(row.variant_id, list);
  }
  const variantsByProgram = new Map<string, VariantRow[]>();
  for (const row of variantRows ?? []) {
    const list = variantsByProgram.get(row.program_id) ?? [];
    list.push(row);
    variantsByProgram.set(row.program_id, list);
  }
  const volumeVariantsByProgram = new Map<string, VolumeVariantRow[]>();
  for (const row of volumeVariantRows ?? []) {
    const list = volumeVariantsByProgram.get(row.program_id) ?? [];
    list.push(row);
    volumeVariantsByProgram.set(row.program_id, list);
  }

  return (programRows ?? []).map((program) => ({
    id: program.id,
    name: program.name,
    scalesDistanceWithMileage: program.scales_distance_with_mileage,
    scalesDurationWithMileage: program.scales_duration_with_mileage,
    frameworkKey: program.framework_key,
    variants: (variantsByProgram.get(program.id) ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      phases: (variantPhasesByVariant.get(variant.id) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((vp) => phaseDefById.get(vp.phase_definition_id))
        .filter((p): p is PhaseDefRow => p != null)
        .map((p) => ({
          id: p.id,
          label: p.name ?? p.phase_key,
          isOptional: p.is_optional,
          durationWeeksMin: p.duration_weeks_min,
          durationWeeksMax: p.duration_weeks_max,
        })),
    })),
    volumeVariants: (volumeVariantsByProgram.get(program.id) ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      peakMileage: v.peak_mileage,
      initialMileage: v.initial_mileage,
    })),
  }));
}
