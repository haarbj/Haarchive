"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { notifyAdmins, createNotification } from "@/lib/notifications/create-notification";
import { checkClubIntakeReadiness, recommendClubFramework } from "@/lib/private-coaching/club-intake";
import { clubIntakeSubmissionSchema } from "@/lib/validation/club-intake";

export type ResolvedClubIntakeCycle = {
  id: string;
  label: string;
  raceName: string;
  raceDate: string;
  deadlineAt: string;
  isClosed: boolean;
  isExpired: boolean;
};

// club_intake_cycles has zero RLS policies (deny-all) -- resolving a token
// to render this page has to go through the service-role client, exactly
// like coach_athlete_invites' own resolveInvite/resolvePrivateCoachInvite.
export async function resolveClubIntakeCycle(token: string): Promise<ResolvedClubIntakeCycle | null> {
  if (!token) return null;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("club_intake_cycles")
    .select("id, label, race_name, race_date, deadline_at, is_closed")
    .eq("token", token)
    .maybeSingle<{ id: string; label: string; race_name: string; race_date: string; deadline_at: string; is_closed: boolean }>();
  if (!data) return null;

  return {
    id: data.id,
    label: data.label,
    raceName: data.race_name,
    raceDate: data.race_date,
    deadlineAt: data.deadline_at,
    isClosed: data.is_closed,
    isExpired: new Date(data.deadline_at).getTime() < Date.now(),
  };
}

export type ExistingClubIntakeSubmission = {
  status: "pending" | "approved" | "waitlisted" | "redirected_not_ready";
};

export async function loadExistingSubmission(cycleId: string, athleteId: string): Promise<ExistingClubIntakeSubmission | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("club_intake_submissions")
    .select("status")
    .eq("cycle_id", cycleId)
    .eq("athlete_id", athleteId)
    .maybeSingle<{ status: ExistingClubIntakeSubmission["status"] }>();
  return data ?? null;
}

// Supabase's own emailConfirmedAt -- the "verified email before the
// queue" gate. getAppSession()'s claims-based session has no confirmation
// timestamp on it (see session.ts), so this checks the real auth user
// directly rather than extending AppSession for one caller.
export async function isEmailVerified(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return !!data.user?.email_confirmed_at;
}

export async function resendVerificationEmail(): Promise<{ error?: string; sent?: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return { error: "Sign in first." };
  const { error } = await supabase.auth.resend({ type: "signup", email: data.user.email });
  if (error) return { error: error.message };
  return { sent: true };
}

export type SubmitClubIntakeState = { error?: string; success?: boolean; redirectedNotReady?: boolean };

export async function submitClubIntake(
  token: string,
  _prevState: SubmitClubIntakeState,
  formData: FormData,
): Promise<SubmitClubIntakeState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first, then open this link again." };

  const verified = await isEmailVerified();
  if (!verified) return { error: "Verify your email first -- check your inbox for the confirmation link." };

  const admin = createServiceRoleClient();
  const { data: cycle } = await admin
    .from("club_intake_cycles")
    .select("id, race_name, race_date, deadline_at, is_closed")
    .eq("token", token)
    .maybeSingle<{ id: string; race_name: string; race_date: string; deadline_at: string; is_closed: boolean }>();
  if (!cycle) return { error: "This form link isn't valid." };
  if (cycle.is_closed || new Date(cycle.deadline_at).getTime() < Date.now()) {
    return { error: "This intake cycle is closed." };
  }

  const raw = {
    currentWeeklyMileage: formData.get("currentWeeklyMileage"),
    raceName: formData.get("raceName") || undefined,
    raceDate: formData.get("raceDate") || undefined,
    finishTimeS: formData.get("finishTimeS") || undefined,
    plansTimeTrial: formData.get("plansTimeTrial") === "on",
    yearsRunning: formData.get("yearsRunning"),
    plansCompleted: formData.get("plansCompleted") || 0,
    goalType: formData.get("goalType"),
    goalTimeS: formData.get("goalTimeS") || undefined,
    injuryHistory: formData.get("injuryHistory") || undefined,
    schoolEmail: formData.get("schoolEmail") || undefined,
    interested1on1: formData.get("interested1on1") === "on",
    wtpBracket: formData.get("wtpBracket") || undefined,
    agreementLogHonestly: formData.get("agreementLogHonestly") === "on",
    agreementSayIfWrong: formData.get("agreementSayIfWrong") === "on",
    agreementRunPrescribedPaces: formData.get("agreementRunPrescribedPaces") === "on",
    agreementReadTheWhy: formData.get("agreementReadTheWhy") === "on",
  };

  const parsed = clubIntakeSubmissionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const readiness = checkClubIntakeReadiness(data.currentWeeklyMileage);

  const row: Record<string, unknown> = {
    cycle_id: cycle.id,
    athlete_id: session.userId,
    current_weekly_mileage: data.currentWeeklyMileage,
    race_name: data.raceName ?? null,
    race_date: data.raceDate ?? null,
    finish_time_s: data.finishTimeS ?? null,
    plans_time_trial: data.plansTimeTrial,
    years_running: data.yearsRunning,
    plans_completed: data.plansCompleted,
    goal_type: data.goalType,
    goal_time_s: data.goalType === "time" ? data.goalTimeS ?? null : null,
    injury_history: data.injuryHistory ?? null,
    school_email: data.schoolEmail || null,
    interested_1on1: data.interested1on1,
    wtp_bracket: data.wtpBracket ?? null,
    agreement_log_honestly: data.agreementLogHonestly,
    agreement_say_if_wrong: data.agreementSayIfWrong,
    agreement_run_prescribed_paces: data.agreementRunPrescribedPaces,
    agreement_read_the_why: data.agreementReadTheWhy,
    status: readiness.ready ? "pending" : "redirected_not_ready",
    readiness_fail: !readiness.ready,
    proposed_framework_key: null,
    proposed_peak_mileage: null,
  };

  // Computed regardless of readiness -- the readiness gate and this
  // recommendation are both advisory (see club-intake.ts's own header
  // comment), and the coach can approve a below-the-line submission
  // anyway. A proposed framework on that row gives them something to
  // start from rather than nothing.
  {
    const rec = recommendClubFramework({
      currentWeeklyMileage: data.currentWeeklyMileage,
      yearsRunning: data.yearsRunning,
      goalType: data.goalType,
    });
    row.proposed_framework_key = rec.frameworkKey;
    // A light heuristic, not a resolved program_volume_variant: the
    // athlete's own current mileage, rounded up to the nearest 5 and
    // clamped into the recommended framework's real peak-mileage range --
    // a starting point for the coach's own variant choice in the existing
    // assign-program wizard, never a substitute for it.
    const roundedUp = Math.ceil(data.currentWeeklyMileage / 5) * 5;
    row.proposed_peak_mileage = Math.min(Math.max(roundedUp, rec.peakMileageMin), rec.peakMileageMax);
  }

  const { error: upsertError } = await admin
    .from("club_intake_submissions")
    .upsert(row, { onConflict: "cycle_id,athlete_id" });
  if (upsertError) return { error: upsertError.message };

  if (readiness.ready) {
    const flags = [
      data.injuryHistory ? "injury/illness history" : null,
      data.interested1on1 ? "interested in 1-on-1" : null,
    ].filter(Boolean);
    await notifyAdmins({
      type: "club_intake_submitted",
      content: `Club intake: ${session.email ?? "an athlete"} submitted (proposed ${row.proposed_framework_key})${flags.length ? ` -- flags: ${flags.join(", ")}` : ""}`,
      relatedEntityId: session.userId,
    });
    await createNotification({
      userId: session.userId,
      type: "club_intake_queued",
      content: "You're in the queue for the club intake. You'll hear back once submissions are reviewed.",
    });
    if (data.interested1on1) {
      await createNotification({
        userId: session.userId,
        type: "club_intake_interest_1on1",
        content:
          "Thanks, you're in the interest pool for 1-on-1 coaching. Here's how this works: I'm taking ~15-20 athletes. Selection is based on meeting the minimum requirements, current mileage, and first-come, everyone else gets the waitlist, plus a free plan either way. You'll hear back by the week of Nov 2. I'll announce pricing before anyone commits to anything, no one's locked in by filling out this form. Nothing to do now, keep running.",
      });
    }
  } else {
    await notifyAdmins({
      type: "club_intake_submitted",
      content: `Club intake: ${session.email ?? "an athlete"} submitted below the readiness line (${data.currentWeeklyMileage} mi/week) -- routed to base-building, but still approvable (proposed ${row.proposed_framework_key}).`,
      relatedEntityId: session.userId,
    });
  }

  revalidatePath(`/club-interest/${token}`);
  return { success: true, redirectedNotReady: !readiness.ready };
}
