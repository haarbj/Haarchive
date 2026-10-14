"use server";

import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";
import { emailsMatch, isInviteExpired } from "@/lib/private-coaching/invites";

export type ResolvedInvite = {
  athleteEmail: string;
  coachDisplayName: string;
  expired: boolean;
};

// coach_athlete_invites has zero RLS policies (deny-all) -- resolving a
// token to render this page has to go through the service-role client,
// same reasoning as coach_invites' own resolveInvite.
export async function resolvePrivateCoachInvite(token: string): Promise<ResolvedInvite | null> {
  if (!token) return null;

  const admin = createServiceRoleClient();
  const { data: invite } = await admin
    .from("coach_athlete_invites")
    .select("coach_id, athlete_email, expires_at, redeemed_at")
    .eq("token", token)
    .maybeSingle<{ coach_id: string; athlete_email: string; expires_at: string; redeemed_at: string | null }>();
  if (!invite || invite.redeemed_at) return null;

  const { data: coachProfile } = await admin
    .from("profiles")
    .select("display_name, coach_display_name")
    .eq("id", invite.coach_id)
    .maybeSingle<{ display_name: string; coach_display_name: string | null }>();

  return {
    athleteEmail: invite.athlete_email,
    coachDisplayName: coachProfile?.coach_display_name || coachProfile?.display_name || "your coach",
    expired: isInviteExpired(invite.expires_at),
  };
}

export type AcceptInviteState = { error?: string };

// Redeems an invite for an athlete who ALREADY had an account before this
// invite was sent (a brand-new signup instead redeems automatically via
// the handle_new_user() trigger -- see
// 20260825070000_private_coaching_signup_redemption.sql). Re-validates
// everything server-side rather than trusting the page's own resolved
// state, since that was rendered on a possibly-stale request.
//
// (token, prevState, formData) -- the token param is fixed via .bind(null,
// token) at the call site (see accept-button.tsx), which is what makes the
// resulting function's signature line up with what useActionState expects.
// prevState/formData are required by useActionState's calling convention
// (see the comment above) but unused by this action itself.
export async function acceptPrivateCoachInvite(
  token: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: AcceptInviteState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<AcceptInviteState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first, then open this link again." };

  const admin = createServiceRoleClient();
  const { data: invite } = await admin
    .from("coach_athlete_invites")
    .select("id, coach_id, athlete_email, expires_at, redeemed_at")
    .eq("token", token)
    .maybeSingle<{ id: string; coach_id: string; athlete_email: string; expires_at: string; redeemed_at: string | null }>();

  if (!invite) return { error: "That invite link isn't valid." };
  if (invite.redeemed_at) return { error: "That invite has already been accepted." };
  if (isInviteExpired(invite.expires_at)) return { error: "That invite has expired -- ask your coach to send a new one." };
  if (!session.email || !emailsMatch(session.email, invite.athlete_email)) {
    return { error: `This invite was sent to ${invite.athlete_email}, which doesn't match your signed-in account.` };
  }
  // Defense in depth alongside inviteAthlete's own self-invite check
  // (roster/actions.ts) -- this table's coach_athletes_not_self CHECK
  // constraint no longer blocks this at the DB layer (see the
  // self-coach migration), so this is the only remaining backstop against
  // an invite created before that app-level check existed.
  if (invite.coach_id === session.userId) {
    return { error: "You can't accept your own invite." };
  }

  const { error: insertError } = await admin
    .from("coach_athletes")
    .insert({ coach_id: invite.coach_id, athlete_id: session.userId, status: "active" });
  if (insertError) {
    // coach_athletes_active_pair_idx -- already an active pair.
    if (insertError.code === "23505") return { error: "You're already one of this coach's athletes." };
    return { error: insertError.message };
  }

  await admin
    .from("coach_athlete_invites")
    .update({ redeemed_at: new Date().toISOString(), redeemed_by: session.userId })
    .eq("id", invite.id);

  await admin.from("audit_log").insert({
    actor_id: session.userId,
    action: "athlete_accepted",
    entity_type: "coach_athletes",
    entity_id: invite.coach_id,
    metadata: { via: "accept_action" },
  });

  redirect("/coaching");
}
