"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";
import { mostRecentCompletedMonday } from "@/lib/week";
import { isViewingAsAthlete, VIEW_AS_REFUSAL } from "@/lib/private-coaching/view-as";

// Writes to the same weekly_checkins table the self-serve dashboard card
// already uses (extended with new columns in Phase 1, not duplicated --
// see that migration's own comment) -- a private-coaching athlete's
// check-in and a self-serve athlete's check-in are the same kind of row,
// keyed the same way (user_id, week_start). This is a separate, fuller
// form rather than editing weekly-checkin-card.tsx directly, so the
// existing self-serve/team dashboard experience (a compact 4-field card)
// is completely unaffected by the private-coaching product's larger field
// set.
const rating = z.coerce.number().int().min(1).max(5);

const checkinSchema = z.object({
  overallFeel: rating,
  fatigue: rating,
  soreness: rating,
  sleepQuality: rating,
  stress: rating,
  pain: z.coerce.boolean().optional().default(false),
  painNotes: z.string().optional(),
  biggestPositive: z.string().optional(),
  biggestConcern: z.string().optional(),
  scheduleConstraints: z.string().optional(),
  notes: z.string().optional(),
});

export type SubmitCheckinState = { error?: string; success?: boolean };

export async function submitCoachingCheckin(
  _prevState: SubmitCheckinState,
  formData: FormData,
): Promise<SubmitCheckinState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const supabase = await createClient();
  // View-as is presentation only -- a coach browsing an athlete's
  // check-in form while in the mode can never submit it, regardless of
  // whose row it would write to.
  if (await isViewingAsAthlete(supabase, session.userId)) return { error: VIEW_AS_REFUSAL };

  const parsed = checkinSchema.safeParse({
    overallFeel: formData.get("overallFeel"),
    fatigue: formData.get("fatigue"),
    soreness: formData.get("soreness"),
    sleepQuality: formData.get("sleepQuality"),
    stress: formData.get("stress"),
    pain: formData.get("pain"),
    painNotes: formData.get("painNotes") || undefined,
    biggestPositive: formData.get("biggestPositive") || undefined,
    biggestConcern: formData.get("biggestConcern") || undefined,
    scheduleConstraints: formData.get("scheduleConstraints") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your answers." };

  // Must match checkin/page.tsx's own computation exactly, or the form
  // would display one week while this writes a different one.
  const weekStart = mostRecentCompletedMonday(new Date());

  // Read before the upsert below -- same reasoning as completion-actions.ts's
  // isFirstCompletion/isNewlyReportedPain: this upsert also handles editing
  // an already-submitted check-in for the week (onConflict: "user_id,week_start"),
  // so it can't unconditionally notify the coach on every submit. That used
  // to re-fire "X submitted a check-in" (and, if pain was already flagged,
  // "X reported pain") on every edit -- caught live on staging. Only notify
  // for what's actually new: a first-time submission for the week, or pain
  // reported for the first time this week.
  const { data: existingCheckin } = await supabase
    .from("weekly_checkins")
    .select("id, pain")
    .eq("user_id", session.userId)
    .eq("week_start", weekStart)
    .maybeSingle<{ id: string; pain: boolean }>();
  const isFirstSubmission = !existingCheckin;
  const isNewlyReportedPain = (parsed.data.pain ?? false) && !(existingCheckin?.pain ?? false);

  const { error } = await supabase.from("weekly_checkins").upsert(
    {
      user_id: session.userId,
      week_start: weekStart,
      overall_feel: parsed.data.overallFeel,
      fatigue: parsed.data.fatigue,
      soreness: parsed.data.soreness,
      sleep_quality: parsed.data.sleepQuality,
      stress: parsed.data.stress,
      pain: parsed.data.pain ?? false,
      pain_notes: parsed.data.painNotes?.trim() || null,
      biggest_positive: parsed.data.biggestPositive?.trim() || null,
      biggest_concern: parsed.data.biggestConcern?.trim() || null,
      schedule_constraints: parsed.data.scheduleConstraints?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) return { error: error.message };

  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", session.userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ coach_id: string }>();
  if (relationship) {
    // A coach with more than one athlete can't tell who a bare "Weekly
    // check-in submitted" notification is even about -- caught live on
    // staging. athlete_id here is the submitting athlete themselves
    // (session.userId), so profiles_select_own already lets them read
    // their own name for this.
    const { data: athleteProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", session.userId)
      .maybeSingle<{ display_name: string }>();
    const athleteName = athleteProfile?.display_name ?? "An athlete";

    if (isFirstSubmission) {
      await createNotification({
        userId: relationship.coach_id,
        type: "checkin_submitted",
        content: `${athleteName} submitted a check-in for the week of ${weekStart}`,
        relatedEntityId: session.userId,
      });
    }
    if (isNewlyReportedPain) {
      await createNotification({
        userId: relationship.coach_id,
        type: "pain_reported",
        content: `${athleteName} reported pain in this week's check-in`,
        relatedEntityId: session.userId,
      });
    }
  }

  const admin = createServiceRoleClient();
  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "checkin_submitted",
    entity_type: "weekly_checkins",
    metadata: { week_start: weekStart, pain: parsed.data.pain ?? false },
  });

  revalidatePath("/coaching/checkin");
  return { success: true };
}
