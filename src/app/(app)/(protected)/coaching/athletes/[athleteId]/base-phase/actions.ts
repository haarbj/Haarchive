"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  generateBasePhasePlan,
  hasReportedInjuryHistory,
  type BasePhaseAthleteType,
  type BasePhaseInput,
  type BasePhasePlan,
} from "@/lib/private-coaching/base-phase-generator";
import { saveScheduledWorkout } from "../schedule/actions";
import { MILE_METERS } from "@/lib/race-distances";

// Base phase template generator -- the coach-facing wrapper around
// base-phase-generator.ts's pure math. See that module's own header for
// what's reused from the Training Load Planner vs newly built here.
//
// This file derives as much as it can from real platform data (a selected
// plan's own first workout week, the athlete's real completed-workout
// history, their profile) so the coach confirms and adjusts numbers rather
// than typing them from scratch. Every derived value stays coach-editable
// in the form -- nothing here is a silent override.

export type BasePhaseProgramOption = {
  id: string;
  name: string;
  variants: { id: string; name: string }[];
  /** Shared across every duration variant of a program -- same convention as assign-program-form.tsx's ProgramOption. Empty for a hand-authored program with no volume levels. */
  volumeVariants: { id: string; name: string }[];
};

export type BasePhaseDefaults = {
  athleteName: string;
  startingWeeklyMiles: number | null;
  /** True once startingWeeklyMiles came from real completed-workout history rather than the athlete's self-reported profile field. */
  startingWeeklyMilesFromHistory: boolean;
  currentDaysPerWeek: number | null;
  currentDaysPerWeekFromHistory: boolean;
  longestRunInLast30DaysMiles: number | null;
  /** Suggested from years_running -- the coach confirms or overrides it, never auto-applied silently. */
  suggestedAthleteType: BasePhaseAthleteType;
  /** From the nearest upcoming already-scheduled phase that traces back to a real Program, if one exists. */
  suggestedPlanStartDate: string | null;
  programs: BasePhaseProgramOption[];
  /**
   * True if the athlete has reported injury history on their own profile
   * (athlete_profiles.training_background_injury_history, coach-visible
   * free text -- see that migration's own comment). When true, the
   * generator must not run at all; see §5 of the task spec.
   */
  hasInjuryHistory: boolean;
  injuryHistoryText: string | null;
};

export type PlanFirstWeek = { totalMiles: number; daysPerWeek: number };

type ProgramRow = { id: string; name: string };
type VariantRow = { id: string; program_id: string; name: string };
type VolumeVariantRow = { id: string; program_id: string; name: string; position: number };

// Exported for reuse by the group base-phase route (roster/groups/[groupId]/base-phase/)
// -- a plain program listing with no athlete dependency, same reuse
// discipline as loadGroupMembersForAssign in the group program-assign
// feature.
export async function loadProgramOptionsForBasePhase(supabase: Awaited<ReturnType<typeof createClient>>): Promise<BasePhaseProgramOption[]> {
  const { data: programRows } = await supabase.from("training_programs").select("id, name").order("name").returns<ProgramRow[]>();
  const programIds = (programRows ?? []).map((p) => p.id);
  if (programIds.length === 0) return [];

  const [{ data: variantRows }, { data: volumeRows }] = await Promise.all([
    supabase.from("program_duration_variants").select("id, program_id, name").in("program_id", programIds).order("name").returns<VariantRow[]>(),
    supabase
      .from("program_volume_variants")
      .select("id, program_id, name, position")
      .in("program_id", programIds)
      .order("position")
      .returns<VolumeVariantRow[]>(),
  ]);

  const variantsByProgram = new Map<string, VariantRow[]>();
  for (const v of variantRows ?? []) variantsByProgram.set(v.program_id, [...(variantsByProgram.get(v.program_id) ?? []), v]);
  const volumesByProgram = new Map<string, VolumeVariantRow[]>();
  for (const v of volumeRows ?? []) volumesByProgram.set(v.program_id, [...(volumesByProgram.get(v.program_id) ?? []), v]);

  return (programRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    variants: (variantsByProgram.get(p.id) ?? []).map((v) => ({ id: v.id, name: v.name })),
    volumeVariants: (volumesByProgram.get(p.id) ?? []).map((v) => ({ id: v.id, name: v.name })),
  }));
}

function metersToMiles(m: number): number {
  return m / MILE_METERS;
}

// Average of a day's min/max distance, or just the min when no max is set
// (Mesa's own real data: most days carry a max, a few don't) -- never a
// pace-derived guess, matching this platform's own "never assume a pace to
// estimate a distance" rule (framework-structure.ts's own header).
function dayMidpointMiles(day: { planned_distance_m: number | null; planned_distance_max_m: number | null }): number {
  if (day.planned_distance_m == null) return 0;
  const max = day.planned_distance_max_m ?? day.planned_distance_m;
  return metersToMiles((day.planned_distance_m + max) / 2);
}

// Pulls the plan's own first workout week (the general phase's week 1) --
// just its total mileage and running-day count, not a literal day-by-day
// mileage template (explicitly not what this generator uses -- see this
// module's header and base-phase-generator.ts's own percentage template,
// which still does the day-by-day split). A "rest day" is a day with no
// planned distance AND no steps -- Mesa's own week 1 has exactly one of
// these (Sunday); a day with no distance but real steps (e.g. a VO2
// session authored as time, not distance) is a running day, just one
// without a fixed mileage of its own.
export async function loadPlanFirstWeek(variantId: string, volumeVariantId: string | null): Promise<{ error?: string; week?: PlanFirstWeek }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: variantPhaseRows } = await supabase
    .from("program_variant_phases")
    .select("position, phase_definition_id, program_phase_definitions(is_optional)")
    .eq("variant_id", variantId)
    .order("position", { ascending: true })
    .returns<{ position: number; phase_definition_id: string; program_phase_definitions: { is_optional: boolean } | null }[]>();
  if (!variantPhaseRows || variantPhaseRows.length === 0) return { error: "This plan has no phases defined yet." };

  const general = variantPhaseRows.find((vp) => !vp.program_phase_definitions?.is_optional) ?? variantPhaseRows[0];
  const generalPhaseId = general.phase_definition_id;

  const { data: days } = await supabase
    .from("program_days")
    .select("id, day_of_week, planned_distance_m, planned_distance_max_m")
    .eq("phase_definition_id", generalPhaseId)
    .eq("week_number", 1)
    .returns<{ id: string; day_of_week: number; planned_distance_m: number | null; planned_distance_max_m: number | null }[]>();
  if (!days || days.length === 0) return { error: "This plan's first week has no days authored yet." };

  const dayIds = days.map((d) => d.id);
  const { data: stepRows } = dayIds.length
    ? await supabase.from("program_day_steps").select("program_day_id").in("program_day_id", dayIds).returns<{ program_day_id: string }[]>()
    : { data: [] as { program_day_id: string }[] };
  const dayIdsWithSteps = new Set((stepRows ?? []).map((s) => s.program_day_id));

  const restDayCount = days.filter((d) => d.planned_distance_m == null && !dayIdsWithSteps.has(d.id)).length;
  const daysPerWeek = Math.max(1, 7 - restDayCount);

  let totalMiles: number | null = null;
  if (volumeVariantId) {
    const { data: weekVolume } = await supabase
      .from("program_phase_week_volumes")
      .select("goal_mileage_min, goal_mileage_max")
      .eq("phase_definition_id", generalPhaseId)
      .eq("volume_variant_id", volumeVariantId)
      .eq("week_number", 1)
      .maybeSingle<{ goal_mileage_min: number | null; goal_mileage_max: number | null }>();
    if (weekVolume?.goal_mileage_min != null) {
      totalMiles = weekVolume.goal_mileage_max != null ? (weekVolume.goal_mileage_min + weekVolume.goal_mileage_max) / 2 : weekVolume.goal_mileage_min;
    }
  }
  // No volume variant selected (or no authored week-volume target for it) --
  // fall back to summing each day's own midpoint distance. A day with
  // steps but no distance (e.g. Mesa's own Wednesday) contributes 0 in this
  // fallback, same known limitation as the authored-total path not
  // existing for a hand-authored program.
  if (totalMiles == null) {
    totalMiles = days.reduce((sum, d) => sum + dayMidpointMiles(d), 0);
  }

  return { week: { totalMiles: Math.round(totalMiles * 10) / 10, daysPerWeek } };
}

// RLS (profiles_select_private_coach / athlete_profiles_select_private_coach,
// both scoped by coaches_this_athlete()) already restricts this to an
// athlete this coach actually coaches -- a null/empty result here means
// either the athlete doesn't exist or this coach doesn't coach them, and
// both collapse to the same "not found" response, same as every other
// athlete-scoped route in this directory.
export async function loadBasePhaseDefaults(athleteId: string): Promise<{ error?: string; defaults?: BasePhaseDefaults }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", athleteId)
    .maybeSingle<{ display_name: string }>();
  if (!profile) return { error: "Athlete not found." };

  const { data: athleteProfile } = await supabase
    .from("athlete_profiles")
    .select("current_weekly_mileage, running_days_per_week, training_background_injury_history, years_running")
    .eq("user_id", athleteId)
    .maybeSingle<{
      current_weekly_mileage: number | null;
      running_days_per_week: number | null;
      training_background_injury_history: string | null;
      years_running: number | null;
    }>();

  const injuryText = athleteProfile?.training_background_injury_history ?? null;

  const [recentWeek, longestRun, upcomingPhase] = await Promise.all([
    loadRecentWeekFromHistory(supabase, athleteId),
    loadLongestRunLast30Days(supabase, athleteId),
    loadUpcomingPlanStartDate(supabase, athleteId),
  ]);

  const programs = await loadProgramOptionsForBasePhase(supabase);

  return {
    defaults: {
      athleteName: profile.display_name,
      startingWeeklyMiles: recentWeek?.miles ?? athleteProfile?.current_weekly_mileage ?? null,
      startingWeeklyMilesFromHistory: recentWeek != null,
      currentDaysPerWeek: recentWeek?.days ?? athleteProfile?.running_days_per_week ?? null,
      currentDaysPerWeekFromHistory: recentWeek != null,
      longestRunInLast30DaysMiles: longestRun,
      // A running history of at least a year is treated as "has a real
      // aerobic base to restart from" -- a coach-confirmable suggestion,
      // never applied silently (see base-phase-generator-form.tsx).
      suggestedAthleteType: (athleteProfile?.years_running ?? 0) >= 1 ? "restarting" : "beginner",
      suggestedPlanStartDate: upcomingPhase,
      programs,
      hasInjuryHistory: hasReportedInjuryHistory(injuryText),
      injuryHistoryText: injuryText,
    },
  };
}

// The trailing 7 days' real completed mileage/day-count for this athlete,
// via the private-coaching completed_workouts table (not workout_completions
// -- that's the separate self-serve/team product's table; see
// checkin-praise-data.ts's own query for this exact join pattern). Null if
// nothing was actually completed in that window, so the caller falls back
// to the athlete's self-reported profile fields instead.
async function loadRecentWeekFromHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<{ miles: number; days: number } | null> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("id")
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", weekAgo)
    .returns<{ id: string }[]>();
  const ids = (scheduled ?? []).map((s) => s.id);
  if (ids.length === 0) return null;

  const { data: completed } = await supabase
    .from("completed_workouts")
    .select("actual_distance_m, completed_at")
    .in("scheduled_workout_id", ids)
    .returns<{ actual_distance_m: number | null; completed_at: string }[]>();
  if (!completed || completed.length === 0) return null;

  const totalMeters = completed.reduce((sum, c) => sum + (c.actual_distance_m ?? 0), 0);
  const distinctDays = new Set(completed.map((c) => c.completed_at.slice(0, 10))).size;
  return { miles: Math.round(metersToMiles(totalMeters) * 10) / 10, days: distinctDays };
}

async function loadLongestRunLast30Days(supabase: Awaited<ReturnType<typeof createClient>>, athleteId: string): Promise<number | null> {
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: scheduled } = await supabase
    .from("scheduled_workouts")
    .select("id")
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", thirtyDaysAgoIso.slice(0, 10))
    .returns<{ id: string }[]>();
  const ids = (scheduled ?? []).map((s) => s.id);
  if (ids.length === 0) return null;

  const { data: completed } = await supabase
    .from("completed_workouts")
    .select("actual_distance_m")
    .in("scheduled_workout_id", ids)
    .gte("completed_at", thirtyDaysAgoIso)
    .returns<{ actual_distance_m: number | null }[]>();
  const maxMeters = (completed ?? []).reduce((max, c) => Math.max(max, c.actual_distance_m ?? 0), 0);
  return maxMeters > 0 ? Math.round(metersToMiles(maxMeters) * 10) / 10 : null;
}

// The nearest already-scheduled training_phases row for this athlete that
// genuinely traces back to a real Program (source_program_id set, not a
// hand-authored phase) and hasn't started yet -- training_phases' own
// no-overlap constraint means there's never more than one answer. Null if
// nothing's scheduled, which just means the coach picks a date themselves.
async function loadUpcomingPlanStartDate(supabase: Awaited<ReturnType<typeof createClient>>, athleteId: string): Promise<string | null> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("training_phases")
    .select("start_date")
    .eq("athlete_id", athleteId)
    .not("source_program_id", "is", null)
    .gt("start_date", todayIso)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ start_date: string }>();
  return data?.start_date ?? null;
}

// Pure preview -- never writes anything. Re-checks injury history
// server-side rather than trusting the client to have honestly respected
// the UI's own block, since this is the one input this feature treats as
// an absolute, never-overridable gate (see base-phase-generator.ts's
// INJURY_RETURN_CRITERIA and the task's own §5 requirement).
export async function previewBasePhase(
  athleteId: string,
  input: BasePhaseInput,
): Promise<{ error?: string; blockedForInjuryHistory?: boolean; injuryHistoryText?: string | null; plan?: BasePhasePlan }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const { data: athleteProfile } = await supabase
    .from("athlete_profiles")
    .select("training_background_injury_history")
    .eq("user_id", athleteId)
    .maybeSingle<{ training_background_injury_history: string | null }>();

  if (hasReportedInjuryHistory(athleteProfile?.training_background_injury_history)) {
    return { blockedForInjuryHistory: true, injuryHistoryText: athleteProfile?.training_background_injury_history ?? null };
  }

  if (input.startingWeeklyMiles < 0 || input.targetWeek.totalMiles <= 0 || input.weeksAvailable < 1) {
    return { error: "Enter a starting mileage, the plan's first workout week mileage, and at least one week." };
  }

  return { plan: generateBasePhasePlan(input) };
}

export type AddBasePhaseResult = { error?: string; daysCreated?: number };

export type AddBasePhaseWeek = {
  weekNumber: number;
  longRunMiles: number;
  mlrMiles: number[];
  easyMiles: number[];
};

// Anchor choice for where the base phase lands on the calendar, matching
// the assign-program wizard's own anchor pattern (start date vs target
// event date -- see assign-program-form.tsx). "endingWeek": the coach picks
// the date the real plan starts; the base is laid out backward so its last
// week ends the Sunday before. "startingWeek": the coach picks the date the
// base itself begins; it's laid out forward from there. Before this anchor
// existed, the generator only supported the endingWeek behavior.
export type BasePhaseAnchor = { kind: "endingWeek"; planStartDate: string } | { kind: "startingWeek"; baseStartDate: string };

export type BasePhaseDateRange = { startDate: string; endDate: string };

function resolveBasePhaseDateRange(anchor: BasePhaseAnchor, weekCount: number): BasePhaseDateRange {
  if (anchor.kind === "endingWeek") {
    const planStartMonday = mostRecentMondayUtc(new Date(`${anchor.planStartDate}T00:00:00Z`));
    const lastWeekMonday = addDaysUtc(planStartMonday, -7);
    const firstWeekMonday = addDaysUtc(lastWeekMonday, -7 * (weekCount - 1));
    return { startDate: isoDate(firstWeekMonday), endDate: isoDate(addDaysUtc(lastWeekMonday, 6)) };
  }
  const firstWeekMonday = mostRecentMondayUtc(new Date(`${anchor.baseStartDate}T00:00:00Z`));
  const lastWeekMonday = addDaysUtc(firstWeekMonday, 7 * (weekCount - 1));
  return { startDate: isoDate(firstWeekMonday), endDate: isoDate(addDaysUtc(lastWeekMonday, 6)) };
}

export type BasePhaseConflict = { phaseType: string; name: string | null; startDate: string; endDate: string };

// True once the base phase's own computed range (duration + anchor) runs
// into the plan's own start week -- checked independently of the anchor
// mode, since "starting week" mode picks the base's start date freely and
// a duration typed too long can walk the base phase straight past (or
// into) the plan's own first day with nothing in the database to catch it
// (the plan may not even be assigned yet, so there's no training_phases
// row for it to overlap against). Never silently shifted to fit -- this is
// a hard block, not a "clear and reassign" conflict, since there's usually
// nothing to clear: the fix is a shorter duration or a different anchor.
function overlapsPlanStart(range: BasePhaseDateRange, planStartDate: string): boolean {
  const planStartMonday = isoDate(mostRecentMondayUtc(new Date(`${planStartDate}T00:00:00Z`)));
  return range.endDate >= planStartMonday;
}

// Resolves the calendar range for a given duration (weekCount) + anchor and
// checks it two ways: against the plan's own start date (overlapsPlanStart,
// above -- always checked, regardless of anchor mode), and against this
// athlete's existing training_phases (the same overlap-pre-check pattern
// savePhase() already uses, schedule/actions.ts) -- surfaced here so both
// the single-athlete form and the group assign flow can show a conflict
// before anything is written.
export async function checkBasePhaseSchedule(
  athleteId: string,
  anchor: BasePhaseAnchor,
  weekCount: number,
  planStartDate: string,
): Promise<{ error?: string; range?: BasePhaseDateRange; conflict?: BasePhaseConflict | null; overlapsPlanStart?: boolean }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (weekCount < 1) return { error: "Enter how many weeks the base phase lasts." };
  if (!planStartDate) return { error: "Enter the plan's own start date." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const range = resolveBasePhaseDateRange(anchor, weekCount);
  const { data: overlapping } = await supabase
    .from("training_phases")
    .select("phase_type, name, start_date, end_date")
    .eq("athlete_id", athleteId)
    .lte("start_date", range.endDate)
    .gte("end_date", range.startDate)
    .maybeSingle<{ phase_type: string; name: string | null; start_date: string; end_date: string }>();

  return {
    range,
    conflict: overlapping
      ? { phaseType: overlapping.phase_type, name: overlapping.name, startDate: overlapping.start_date, endDate: overlapping.end_date }
      : null,
    overlapsPlanStart: overlapsPlanStart(range, planStartDate),
  };
}

// Writes the confirmed, coach-edited template to the athlete's schedule:
// one training_phases row labeled "Base" spanning the whole range (so it
// shows up grouped and labeled in Phase View exactly like General/
// Supportive/Specific -- "Base" is already a suggested phase type with its
// own accent color in training-phases.ts, so no changes were needed there),
// then each day via the same saveScheduledWorkout() the single-athlete
// schedule editor and program assignment already use -- no parallel insert
// path -- so it lands as an unpublished draft (publish: false) exactly like
// every other coach-authored schedule entry, for the coach to review and
// publish from the normal calendar.
//
// Sunday is always off (per the generator's own percentage template), so
// the long run lands on Saturday instead of this platform's usual Sunday
// convention for authored Programs -- a base phase isn't one of those
// seeded frameworks. MLRs land on weekdays mirroring the plan's own
// workout-day placement loosely (spread through the week rather than
// bunched), easy days fill whatever's left, and the specific days that go
// unused as frequency drops below 6 are a reasonable default (the task
// only pins down Sunday-always-off and Thursday-off-at-5-days).
const DAY_OFFSETS_BY_COUNT: Record<number, { long: number; mlr: number[]; easy: number[] }> = {
  // Offsets from Monday (0=Mon ... 6=Sun). Saturday (5) is always the long
  // run; Tue/Fri are always the MLRs, so dropping easy days to go from 6
  // down to 3 only ever removes Mon/Wed/Thu in that order -- the spec's own
  // "Thursday also off at 5 days" falls out of this directly.
  6: { long: 5, mlr: [1, 4], easy: [0, 2, 3] }, // Tue/Fri MLR; Mon/Wed/Thu easy; Sun off
  5: { long: 5, mlr: [1, 4], easy: [0, 2] }, // drop Thu easy -- Thu+Sun off, matching the spec exactly
  4: { long: 5, mlr: [1, 4], easy: [2] }, // drop Mon easy too -- Mon/Thu/Sun off
  3: { long: 5, mlr: [1, 4], easy: [] }, // Tue/Fri MLR, Sat long -- "two MLRs plus one long run, no easy days"
};

export async function addBasePhaseToSchedule(
  athleteId: string,
  anchor: BasePhaseAnchor,
  weeks: AddBasePhaseWeek[],
  planStartDate: string,
  clearOverlapping = false,
): Promise<AddBasePhaseResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (weeks.length === 0) return { error: "Nothing to add." };
  if (!planStartDate) return { error: "Enter the plan's own start date." };

  const supabase = await createClient();
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!relationship) return { error: "You don't coach this athlete." };

  const range = resolveBasePhaseDateRange(anchor, weeks.length);
  const firstWeekMonday = new Date(`${range.startDate}T00:00:00Z`);

  // Re-checked here rather than trusting the caller's earlier preview
  // snapshot -- never silently shifted to fit; the coach has to shorten
  // the duration or pick a different anchor.
  if (overlapsPlanStart(range, planStartDate)) {
    return {
      error: "This duration and anchor would place the base phase overlapping the plan's own start date. Shorten the duration or choose a different anchor.",
    };
  }

  // Re-checked here rather than trusting the caller's earlier preview
  // snapshot -- the athlete's calendar can change between that preview and
  // this submit, same "never trust the client" discipline as every other
  // assignment flow on this platform.
  const { data: overlapping } = await supabase
    .from("training_phases")
    .select("id, start_date, end_date")
    .eq("athlete_id", athleteId)
    .lte("start_date", range.endDate)
    .gte("end_date", range.startDate)
    .maybeSingle<{ id: string; start_date: string; end_date: string }>();
  if (overlapping) {
    if (!clearOverlapping) {
      return {
        error: "This date range overlaps an existing phase for this athlete. Clear it and reassign, or choose a different anchor.",
      };
    }
    await supabase
      .from("scheduled_workouts")
      .delete()
      .eq("athlete_id", athleteId)
      .gte("scheduled_date", overlapping.start_date)
      .lte("scheduled_date", overlapping.end_date);
    await supabase.from("training_phases").delete().eq("id", overlapping.id);
  }

  const { error: phaseError } = await supabase.from("training_phases").insert({
    athlete_id: athleteId,
    coach_id: session.userId,
    phase_type: "Base",
    name: null,
    start_date: range.startDate,
    end_date: range.endDate,
  });
  if (phaseError) return { error: phaseError.message };

  let daysCreated = 0;
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    const weekMonday = addDaysUtc(firstWeekMonday, 7 * i);
    const daysPerWeek = 1 + week.mlrMiles.length + week.easyMiles.length;
    const offsets = DAY_OFFSETS_BY_COUNT[daysPerWeek] ?? DAY_OFFSETS_BY_COUNT[6];

    const longResult = await saveScheduledWorkout({
      athleteId,
      scheduledDate: isoDate(addDaysUtc(weekMonday, offsets.long)),
      workoutType: "long",
      dayLabel: "Long run",
      sessionSlot: null,
      extras: [],
      notesFromCoach: `Base phase week ${week.weekNumber} of ${weeks.length} -- easy pace, this is a base-building long run, not a workout.`,
      plannedDistanceM: milesToMeters(week.longRunMiles),
      plannedDistanceMaxM: null,
      plannedDurationS: null,
      plannedDurationMaxS: null,
      plannedPaceSPerMi: null,
      plannedPaceMaxSPerMi: null,
      plannedPaceReference: null,
      plannedPacePercentBasis: null,
      plannedPacePercentMin: null,
      plannedPacePercentMax: null,
      plannedVolumePercent: null,
      plannedHrBpm: null,
      plannedHrMaxBpm: null,
      plannedRpe: null,
      plannedRpeMax: null,
      steps: [],
      publish: false,
    });
    if (longResult.error) return { error: longResult.error };
    daysCreated += 1;

    for (let m = 0; m < week.mlrMiles.length; m++) {
      const offset = offsets.mlr[m] ?? offsets.mlr[offsets.mlr.length - 1];
      const result = await saveScheduledWorkout({
        athleteId,
        scheduledDate: isoDate(addDaysUtc(weekMonday, offset)),
        workoutType: "easy",
        dayLabel: "Medium-long run",
        sessionSlot: null,
        extras: [],
        notesFromCoach: `Base phase week ${week.weekNumber} of ${weeks.length} -- this is one of the days that becomes a workout once the plan starts; easy pace for now.`,
        plannedDistanceM: milesToMeters(week.mlrMiles[m]),
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        plannedPaceSPerMi: null,
        plannedPaceMaxSPerMi: null,
        plannedPaceReference: null,
        plannedPacePercentBasis: null,
        plannedPacePercentMin: null,
        plannedPacePercentMax: null,
        plannedVolumePercent: null,
        plannedHrBpm: null,
        plannedHrMaxBpm: null,
        plannedRpe: null,
        plannedRpeMax: null,
        steps: [],
        publish: false,
      });
      if (result.error) return { error: result.error };
      daysCreated += 1;
    }

    for (let e = 0; e < week.easyMiles.length; e++) {
      const offset = offsets.easy[e] ?? offsets.easy[offsets.easy.length - 1];
      const result = await saveScheduledWorkout({
        athleteId,
        scheduledDate: isoDate(addDaysUtc(weekMonday, offset)),
        workoutType: "easy",
        dayLabel: "Easy run",
        sessionSlot: null,
        extras: [],
        notesFromCoach: `Base phase week ${week.weekNumber} of ${weeks.length}.`,
        plannedDistanceM: milesToMeters(week.easyMiles[e]),
        plannedDistanceMaxM: null,
        plannedDurationS: null,
        plannedDurationMaxS: null,
        plannedPaceSPerMi: null,
        plannedPaceMaxSPerMi: null,
        plannedPaceReference: null,
        plannedPacePercentBasis: null,
        plannedPacePercentMin: null,
        plannedPacePercentMax: null,
        plannedVolumePercent: null,
        plannedHrBpm: null,
        plannedHrMaxBpm: null,
        plannedRpe: null,
        plannedRpeMax: null,
        steps: [],
        publish: false,
      });
      if (result.error) return { error: result.error };
      daysCreated += 1;
    }
  }

  return { daysCreated };
}

function mostRecentMondayUtc(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function milesToMeters(miles: number): number {
  return Math.round(miles * MILE_METERS);
}
