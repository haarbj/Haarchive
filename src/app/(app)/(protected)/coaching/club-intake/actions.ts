"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type ClubIntakeQueueRow = {
  id: string;
  athleteId: string;
  athleteName: string;
  status: "pending" | "approved" | "waitlisted" | "redirected_not_ready";
  currentWeeklyMileage: number;
  yearsRunning: number;
  plansCompleted: number;
  raceName: string | null;
  raceDate: string | null;
  finishTimeS: number | null;
  plansTimeTrial: boolean;
  goalType: "finish" | "time";
  goalTimeS: number | null;
  injuryHistory: string | null;
  schoolEmail: string | null;
  interested1on1: boolean;
  wtpBracket: string | null;
  proposedFrameworkKey: string | null;
  proposedPeakMileage: number | null;
  readinessFail: boolean;
  createdAt: string;
  coachAthleteId: string | null;
  tier: "free" | "paid" | null;
};

export type ClubIntakeCycleSummary = { id: string; label: string; raceName: string; raceDate: string; deadlineAt: string; isClosed: boolean };

export async function loadClubIntakeCycles(): Promise<ClubIntakeCycleSummary[]> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return [];
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("club_intake_cycles")
    .select("id, label, race_name, race_date, deadline_at, is_closed")
    .order("created_at", { ascending: false })
    .returns<{ id: string; label: string; race_name: string; race_date: string; deadline_at: string; is_closed: boolean }[]>();
  return (data ?? []).map((c) => ({ id: c.id, label: c.label, raceName: c.race_name, raceDate: c.race_date, deadlineAt: c.deadline_at, isClosed: c.is_closed }));
}

type SubmissionRow = {
  id: string;
  athlete_id: string;
  status: ClubIntakeQueueRow["status"];
  current_weekly_mileage: number;
  years_running: number;
  plans_completed: number;
  race_name: string | null;
  race_date: string | null;
  finish_time_s: number | null;
  plans_time_trial: boolean;
  goal_type: ClubIntakeQueueRow["goalType"];
  goal_time_s: number | null;
  injury_history: string | null;
  school_email: string | null;
  interested_1on1: boolean;
  wtp_bracket: string | null;
  proposed_framework_key: string | null;
  proposed_peak_mileage: number | null;
  readiness_fail: boolean;
  created_at: string;
};

export async function loadClubIntakeQueue(cycleId: string): Promise<ClubIntakeQueueRow[]> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return [];

  const admin = createServiceRoleClient();
  const { data: submissions } = await admin
    .from("club_intake_submissions")
    .select(
      "id, athlete_id, status, current_weekly_mileage, years_running, plans_completed, race_name, race_date, finish_time_s, plans_time_trial, goal_type, goal_time_s, injury_history, school_email, interested_1on1, wtp_bracket, proposed_framework_key, proposed_peak_mileage, readiness_fail, created_at",
    )
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: true })
    .returns<SubmissionRow[]>();
  if (!submissions || submissions.length === 0) return [];

  const athleteIds = submissions.map((s) => s.athlete_id);
  const { data: profiles } = await admin.from("profiles").select("id, display_name").in("id", athleteIds).returns<{ id: string; display_name: string }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const { data: relationships } = await admin
    .from("coach_athletes")
    .select("id, athlete_id, tier")
    .eq("coach_id", session.userId)
    .in("athlete_id", athleteIds)
    .eq("status", "active")
    .returns<{ id: string; athlete_id: string; tier: "free" | "paid" }[]>();
  const relationshipByAthlete = new Map((relationships ?? []).map((r) => [r.athlete_id, r]));

  return submissions.map((s) => ({
    id: s.id,
    athleteId: s.athlete_id,
    athleteName: nameById.get(s.athlete_id) ?? "Athlete",
    status: s.status,
    currentWeeklyMileage: s.current_weekly_mileage,
    yearsRunning: s.years_running,
    plansCompleted: s.plans_completed,
    raceName: s.race_name,
    raceDate: s.race_date,
    finishTimeS: s.finish_time_s,
    plansTimeTrial: s.plans_time_trial,
    goalType: s.goal_type,
    goalTimeS: s.goal_time_s,
    injuryHistory: s.injury_history,
    schoolEmail: s.school_email,
    interested1on1: s.interested_1on1,
    wtpBracket: s.wtp_bracket,
    proposedFrameworkKey: s.proposed_framework_key,
    proposedPeakMileage: s.proposed_peak_mileage,
    readinessFail: s.readiness_fail,
    createdAt: s.created_at,
    coachAthleteId: relationshipByAthlete.get(s.athlete_id)?.id ?? null,
    tier: relationshipByAthlete.get(s.athlete_id)?.tier ?? null,
  }));
}

export type ReviewActionState = { error?: string };

/**
 * Approve a pending submission: creates the coach_athletes relationship
 * (tier='free', the baseline Club Plan every approved athlete gets) and
 * backfills athlete_profiles/goals/race_results wherever a field there is
 * currently empty -- never clobbering something the athlete already set
 * themselves via Settings. This unlocks the athlete for the existing
 * assign-program wizard (which requires a real coach_athletes row to
 * authorize against); it does not itself generate a plan -- that stays a
 * deliberate, per-athlete coach decision in the existing wizard, same as
 * every other assignment on this platform.
 */
export async function approveClubIntakeSubmission(submissionId: string): Promise<ReviewActionState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { data: submission } = await admin
    .from("club_intake_submissions")
    .select("id, athlete_id, cycle_id, status, current_weekly_mileage, years_running, injury_history, race_name, race_date, finish_time_s, goal_type, goal_time_s")
    .eq("id", submissionId)
    .maybeSingle<{
      id: string;
      athlete_id: string;
      cycle_id: string;
      status: string;
      current_weekly_mileage: number;
      years_running: number;
      injury_history: string | null;
      race_name: string | null;
      race_date: string | null;
      finish_time_s: number | null;
      goal_type: "finish" | "time";
      goal_time_s: number | null;
    }>();
  if (!submission) return { error: "Submission not found." };

  const { data: cycle } = await admin
    .from("club_intake_cycles")
    .select("race_name, race_date")
    .eq("id", submission.cycle_id)
    .maybeSingle<{ race_name: string; race_date: string }>();

  const { error: relError } = await admin
    .from("coach_athletes")
    .insert({ coach_id: session.userId, athlete_id: submission.athlete_id, status: "active", tier: "free" });
  if (relError && relError.code !== "23505") return { error: relError.message };

  const { data: existingProfile } = await admin
    .from("athlete_profiles")
    .select("current_weekly_mileage, years_running, training_background_injury_history")
    .eq("user_id", submission.athlete_id)
    .maybeSingle<{ current_weekly_mileage: number | null; years_running: number | null; training_background_injury_history: string | null }>();

  const profileUpdate: Record<string, unknown> = {};
  if (existingProfile?.current_weekly_mileage == null) profileUpdate.current_weekly_mileage = submission.current_weekly_mileage;
  if (existingProfile?.years_running == null) profileUpdate.years_running = submission.years_running;
  if (!existingProfile?.training_background_injury_history && submission.injury_history) {
    profileUpdate.training_background_injury_history = submission.injury_history;
  }
  if (Object.keys(profileUpdate).length > 0) {
    await admin.from("athlete_profiles").upsert({ user_id: submission.athlete_id, ...profileUpdate }, { onConflict: "user_id" });
  }

  if (cycle) {
    const { data: existingGoal } = await admin
      .from("goals")
      .select("id")
      .eq("user_id", submission.athlete_id)
      .eq("race_name", cycle.race_name)
      .maybeSingle<{ id: string }>();
    if (!existingGoal) {
      const MARATHON_METERS = 42195;
      await admin.from("goals").insert({
        user_id: submission.athlete_id,
        race_name: cycle.race_name,
        distance_m: MARATHON_METERS,
        goal_time_s: submission.goal_type === "time" ? submission.goal_time_s : null,
        goal_date: cycle.race_date,
        priority: "A",
        status: "active",
      });
    }
  }

  if (submission.race_name && submission.race_date && submission.finish_time_s) {
    const { data: existingRace } = await admin
      .from("race_results")
      .select("id")
      .eq("user_id", submission.athlete_id)
      .eq("race_name", submission.race_name)
      .eq("race_date", submission.race_date)
      .maybeSingle<{ id: string }>();
    if (!existingRace) {
      const FIVE_K_METERS = 5000;
      await admin.from("race_results").insert({
        user_id: submission.athlete_id,
        race_name: submission.race_name,
        race_date: submission.race_date,
        distance_m: FIVE_K_METERS,
        finish_time_s: submission.finish_time_s,
        course_type: "road",
      });
    }
  }

  await admin
    .from("club_intake_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: session.userId })
    .eq("id", submissionId);

  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "club_intake_approved",
    entity_type: "club_intake_submissions",
    entity_id: submissionId,
    metadata: { athlete_id: submission.athlete_id },
  });

  revalidatePath("/coaching/club-intake");
  return {};
}

export async function waitlistClubIntakeSubmission(submissionId: string): Promise<ReviewActionState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("club_intake_submissions")
    .update({ status: "waitlisted", reviewed_at: new Date().toISOString(), reviewed_by: session.userId })
    .eq("id", submissionId);
  if (error) return { error: error.message };
  revalidatePath("/coaching/club-intake");
  return {};
}

export async function setCoachAthleteTier(coachAthleteId: string, tier: "free" | "paid"): Promise<ReviewActionState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("coach_athletes")
    .update({ tier })
    .eq("id", coachAthleteId)
    .eq("coach_id", session.userId);
  if (error) return { error: error.message };
  revalidatePath("/coaching/roster");
  return {};
}
