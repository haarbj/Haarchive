"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

// The sole intended caller capable of inserting a coach_athletes row where
// coach_id = athlete_id (see the self-coach migration's own comment on why
// dropping coach_athletes_not_self is safe specifically because this is
// the only path that means to produce that shape). Any signed-in user can
// call this -- there is deliberately no isPrivateCoach check, since
// unlocking the coaching toolset for your OWN training without being an
// admin-approved coach is the entire point. Idempotent: safe to call again
// for a user who's already a real or self-serve coach, or already
// self-coached.
export async function becomeSelfCoach(): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const admin = createServiceRoleClient();

  // Only grant the permission if this user doesn't already have it in some
  // form (real, admin-granted coaches who click this just get the
  // self-referential relationship below -- their existing grant is never
  // touched or overwritten).
  if (!session.isPrivateCoach) {
    const { error } = await admin
      .from("user_permissions")
      .insert({ user_id: session.userId, permission: "private_coach", granted_by: session.userId });
    if (error) return { error: error.message };
  }

  const { data: existing } = await admin
    .from("coach_athletes")
    .select("id")
    .eq("coach_id", session.userId)
    .eq("athlete_id", session.userId)
    .eq("status", "active")
    .maybeSingle();

  if (!existing) {
    const { error } = await admin
      .from("coach_athletes")
      .insert({ coach_id: session.userId, athlete_id: session.userId, status: "active" });
    if (error) return { error: error.message };

    await admin.from("audit_log").insert({
      actor_id: session.userId,
      action: "self_coach_enabled",
      entity_type: "coach_athletes",
      entity_id: session.userId,
      metadata: {},
    });
  }

  revalidatePath("/coaching");
  revalidatePath("/settings");
  return {};
}
