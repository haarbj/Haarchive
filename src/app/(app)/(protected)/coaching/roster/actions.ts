"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { createNotification } from "@/lib/notifications/create-notification";

const inviteAthleteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type InviteAthleteState = { error?: string; inviteUrl?: string };

// No transactional email infrastructure exists in this app (matches
// createCoachInvite's own precedent) -- the coach copies the generated
// link and sends it themselves (text, email, whatever), same $0 pattern
// already established for coach_invites. If the invited email already has
// an account, it also gets an in-app notification below (an existing
// account never goes through the signup trigger's auto-redemption path,
// which only fires for a brand-new auth.users row -- without this they'd
// have no way to discover the invite except the coach handing them the
// link out-of-band).
export async function inviteAthlete(
  _prevState: InviteAthleteState,
  formData: FormData,
): Promise<InviteAthleteState> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const parsed = inviteAthleteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  // Nothing else stops a coach inviting their own email -- acceptance would
  // otherwise succeed (emailsMatch trivially true) and produce a
  // self-referential coach_athletes row outside the deliberate self-coach
  // path (see becomeSelfCoach in ../self-coach-actions.ts). Checked here,
  // not just at acceptance, so it fails fast with a clear message instead
  // of silently generating an invite link that would only fail later.
  if (session.email && parsed.data.email === session.email.toLowerCase()) {
    return { error: "You can't invite yourself -- use self-coaching instead." };
  }

  // A self-serve (never admin-approved) coach can plan their own training
  // with the full coaching toolset, but can never invite or manage a real
  // athlete -- the one boundary the whole self-coaching feature exists to
  // protect (see isSelfServeCoach's own comment in session.ts).
  if (session.isSelfServeCoach) {
    return { error: "Self-coaching accounts can't invite other athletes." };
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("coach_athlete_invites")
    .insert({ coach_id: session.userId, athlete_email: parsed.data.email })
    .select("token")
    .single();

  if (error) {
    // coach_athlete_invites_live_idx -- one unredeemed invite per
    // (coach, email) at a time.
    if (error.code === "23505") return { error: "You already have a pending invite for this email." };
    return { error: error.message };
  }

  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "athlete_invited",
    entity_type: "coach_athlete_invites",
    metadata: { athlete_email: parsed.data.email },
  });

  // profiles has no email column (email only lives in auth.users, managed
  // by GoTrue) -- same listUsers-then-filter-in-memory lookup already
  // established in coach/roster/actions.ts's addAthleteToRoster, for the
  // same reason (listUsers has no email-filter parameter in the installed
  // supabase-js version). Fine at this app's actual scale, not something
  // to scale past without a better lookup.
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = existingUsers?.users.find((u) => u.email?.toLowerCase() === parsed.data.email);
  if (existingUser) {
    const { data: coachProfile } = await admin
      .from("profiles")
      .select("display_name, coach_display_name")
      .eq("id", session.userId)
      .maybeSingle<{ display_name: string; coach_display_name: string | null }>();
    const coachName = coachProfile?.coach_display_name || coachProfile?.display_name || "A coach";
    await createNotification({
      userId: existingUser.id,
      type: "coaching_invite_received",
      content: `${coachName} invited you to private coaching`,
      relatedEntityId: data.token,
    });
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  revalidatePath("/coaching/roster");
  return { inviteUrl: `${origin}/coaching-invite/${data.token}` };
}

export async function revokeAthleteInvite(inviteId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("coach_athlete_invites")
    .delete()
    .eq("id", inviteId)
    .eq("coach_id", session.userId)
    .is("redeemed_at", null);
  if (error) return { error: error.message };

  revalidatePath("/coaching/roster");
  return {};
}

// Soft-ends the relationship (status='ended', ended_at=now()) rather than
// deleting the row -- preserves history for a future re-engagement/
// transfer, matching coach_athletes' own "must support historical
// relationships" requirement. The athlete's own training data (scheduled
// workouts, completions, metrics) is untouched either way -- ending a
// relationship only changes who can see it going forward.
export async function removeAthleteFromRoster(coachAthleteId: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) return { error: "Not authorized." };

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("coach_athletes")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", coachAthleteId)
    .eq("coach_id", session.userId)
    .eq("status", "active")
    .select("athlete_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That athlete isn't on your roster." };

  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "relationship_ended",
    entity_type: "coach_athletes",
    entity_id: coachAthleteId,
    metadata: { athlete_id: data.athlete_id },
  });

  revalidatePath("/coaching/roster");
  return {};
}
