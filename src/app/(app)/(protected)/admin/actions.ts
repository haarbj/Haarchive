"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

// Fixed at the access-control migration's own seed id -- one team for v1,
// see that migration's comment for why it's a hardcoded constant rather than
// a runtime lookup.
const BRONCOS_TEAM_ID = "00000000-0000-0000-0000-000000000001";

export type CreateCoachInviteState = { error?: string; inviteUrl?: string };

// Uses the service-role client deliberately: coach_invites has zero RLS
// policies for authenticated/anon (see the access-control migration), so
// admin Server Actions are the only application-level path that can ever
// read or write it. The isAdmin check right below is the real gate, not
// RLS -- this table's RLS is "nobody but service-role or the trigger," full
// stop, by design.
export async function createCoachInvite(
  _prevState: CreateCoachInviteState,
  formData: FormData,
): Promise<CreateCoachInviteState> {
  const session = await getAppSession();
  if (!session?.isAdmin) return { error: "Not authorized." };

  const emailInput = formData.get("email");
  if (typeof emailInput !== "string" || !emailInput.trim()) {
    return { error: "Enter an email." };
  }
  const email = emailInput.trim();
  if (!email.toLowerCase().endsWith("@brophyprep.org")) {
    return { error: "Coach invites must use an @brophyprep.org email." };
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("coach_invites")
    .insert({ email, team_id: BRONCOS_TEAM_ID, created_by: session.userId })
    .select("token")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "An invite for this email already exists." };
    return { error: error.message };
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return { inviteUrl: `${origin}/signup?invite=${data.token}` };
}

// Only an unredeemed invite can be revoked -- once someone has actually
// signed up with it, removing the row wouldn't undo the account they
// already created, it would just orphan the audit trail of how they got it.
export async function revokeCoachInvite(inviteId: string): Promise<void> {
  const session = await getAppSession();
  if (!session?.isAdmin) return;

  const admin = createServiceRoleClient();
  await admin.from("coach_invites").delete().eq("id", inviteId).is("redeemed_at", null);

  revalidatePath("/admin");
}
