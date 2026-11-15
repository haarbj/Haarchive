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

  if (input.startingWeeklyMiles < 0 || input.targetWeeklyMiles <= 0 || input.weeksAvailable < 1) {
    return { error: "Enter a starting mileage, a target mileage above zero, and at least one week." };
  }

  return { plan: generateBasePhasePlan(input) };
}

export type AddBasePhaseResult = { error?: string; daysCreated?: number };

// Writes the confirmed, coach-edited template to the athlete's schedule,
// counting backward from the plan's own start date so the base phase's
// last week ends the day before the plan's first day. Every day is created
// via the same saveScheduledWorkout() the single-athlete schedule editor
// and program assignment already use -- no parallel insert path -- so it
// lands as an unpublished draft (publish: false) exactly like every other
// coach-authored schedule entry, for the coach to review and publish from
// the normal calendar.
export async function addBasePhaseToSchedule(
  athleteId: string,
  planStartDate: string,
  weeks: { weekNumber: number; totalMiles: number; daysPerWeek: number; longRunMiles: number }[],
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
    const longRunDate = addDaysUtc(weekMonday, 6); // Sunday, matching this platform's seeded-framework convention

    const result = await saveScheduledWorkout({
      athleteId,
      scheduledDate: isoDate(longRunDate),
      workoutType: "long",
      dayLabel: "Long run",
      sessionSlot: null,
      extras: [],
      notesFromCoach: `Base phase week ${week.weekNumber} of ${weeks.length}.`,
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
    if (result.error) return { error: result.error };
    daysCreated += 1;

    const remainingDays = Math.max(0, week.daysPerWeek - 1);
    const remainingMiles = Math.max(0, week.totalMiles - week.longRunMiles);
    if (remainingDays > 0) {
      // Tue-Sat, skipping Monday as a rest day by this platform's own
      // seeded-framework convention -- up to 5 easy days, which covers
      // every daysPerWeek this generator will ever propose (max 6 total
      // including the Sunday long run).
      const easyDayOffsets = [1, 2, 3, 4, 5].slice(0, remainingDays);
      const perDay = Math.floor((remainingMiles / remainingDays) * 10) / 10;
      let assigned = 0;
      for (let d = 0; d < easyDayOffsets.length; d++) {
        const isLast = d === easyDayOffsets.length - 1;
        const distanceMiles = isLast ? Math.round((remainingMiles - assigned) * 10) / 10 : perDay;
        assigned += distanceMiles;
        const date = addDaysUtc(weekMonday, easyDayOffsets[d]);

        const easyResult = await saveScheduledWorkout({
          athleteId,
          scheduledDate: isoDate(date),
          workoutType: "easy",
          dayLabel: "Easy run",
          sessionSlot: null,
          extras: [],
          notesFromCoach: `Base phase week ${week.weekNumber} of ${weeks.length}.`,
          plannedDistanceM: milesToMeters(distanceMiles),
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
        if (easyResult.error) return { error: easyResult.error };
        daysCreated += 1;
      }
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
