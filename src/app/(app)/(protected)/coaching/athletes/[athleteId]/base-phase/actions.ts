"use server";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import {
  generateBasePhasePlan,
  hasReportedInjuryHistory,
  type BasePhaseInput,
  type BasePhasePlan,
} from "@/lib/private-coaching/base-phase-generator";
import { saveScheduledWorkout } from "../schedule/actions";
import { MILE_METERS } from "@/lib/race-distances";

// Base phase template generator -- the coach-facing wrapper around
// base-phase-generator.ts's pure math. See that module's own header for
// what's reused from the Training Load Planner vs newly built here.

export type BasePhaseDefaults = {
  athleteName: string;
  startingWeeklyMiles: number | null;
  currentDaysPerWeek: number | null;
  /**
   * True if the athlete has reported injury history on their own profile
   * (athlete_profiles.training_background_injury_history, coach-visible
   * free text -- see that migration's own comment). When true, the
   * generator must not run at all; see §5 of the task spec.
   */
  hasInjuryHistory: boolean;
  injuryHistoryText: string | null;
};

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
    .select("current_weekly_mileage, running_days_per_week, training_background_injury_history")
    .eq("user_id", athleteId)
    .maybeSingle<{
      current_weekly_mileage: number | null;
      running_days_per_week: number | null;
      training_background_injury_history: string | null;
    }>();

  const injuryText = athleteProfile?.training_background_injury_history ?? null;

  return {
    defaults: {
      athleteName: profile.display_name,
      startingWeeklyMiles: athleteProfile?.current_weekly_mileage ?? null,
      currentDaysPerWeek: athleteProfile?.running_days_per_week ?? null,
      hasInjuryHistory: hasReportedInjuryHistory(injuryText),
      injuryHistoryText: injuryText,
    },
  };
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

// Writes the confirmed, coach-edited template to the athlete's schedule,
// counting backward from the plan's own start date so the base phase's
// last week ends the day before the plan's first day. Every day is created
// via the same saveScheduledWorkout() the single-athlete schedule editor
// and program assignment already use -- no parallel insert path -- so it
// lands as an unpublished draft (publish: false) exactly like every other
// coach-authored schedule entry, for the coach to review and publish from
// the normal calendar.
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
  planStartDate: string,
  weeks: AddBasePhaseWeek[],
): Promise<AddBasePhaseResult> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  if (weeks.length === 0) return { error: "Nothing to add." };

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

  // Base phase fills the N weeks immediately before the plan starts: the
  // last base week's Sunday is the Sunday right before planStartDate's own
  // Monday. Working backward from the last week to the first keeps this
  // correct regardless of how many weeks are confirmed.
  const planStart = new Date(`${planStartDate}T00:00:00Z`);
  const planStartMonday = mostRecentMondayUtc(planStart);
  const lastBaseWeekMonday = addDaysUtc(planStartMonday, -7);

  let daysCreated = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const week = weeks[i];
    const weeksFromLast = weeks.length - 1 - i;
    const weekMonday = addDaysUtc(lastBaseWeekMonday, -7 * weeksFromLast);
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

    // MLRs: the days that become workout days once the real plan starts --
    // longer easy runs here, never a workout, per the generator's own
    // design (base-phase-generator.ts's module header).
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
