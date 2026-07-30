"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/db/service-role";

export type AddAthleteState = { error?: string; success?: boolean };

// Athletes with an @brophybroncos.org email join a coach's roster
// automatically (see the coach_athlete_access migration's trigger) --
// this covers everyone else: an athlete who already has an account under
// a different email, added directly by the coach rather than through
// that auto-join path. There's no separate "invite" step here (unlike
// coach_invites, which exists for onboarding a brand-new *coach*) --
// the athlete already has an account, so this just adds the membership row.
//
// profiles has no email column (email only lives in auth.users), so
// finding the match means paging through auth.admin.listUsers and
// filtering in memory -- listUsers has no email-filter parameter in the
// installed supabase-js version. Fine at this app's actual scale (a single
// high school team), not something to scale past without a better lookup.
export async function addAthleteToRoster(
  _prevState: AddAthleteState,
  formData: FormData,
): Promise<AddAthleteState> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return { error: "Not authorized." };

  const emailInput = formData.get("email");
  if (typeof emailInput !== "string" || !emailInput.trim()) {
    return { error: "Enter an email." };
  }
  const email = emailInput.trim().toLowerCase();

  const admin = createServiceRoleClient();
  const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return { error: listError.message };

  const match = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!match) {
    return { error: "No account found with that email. They need to sign up first." };
  }

  const { error } = await admin
    .from("team_memberships")
    .insert({ team_id: session.coachTeamId, user_id: match.id, role: "athlete" });
  if (error) {
    if (error.code === "23505") return { error: "That person is already on your roster." };
    return { error: error.message };
  }

  revalidatePath("/coach/roster");
  return { success: true };
}

// The reverse of addAthleteToRoster -- removes an athlete from this
// coach's team without touching their account or any of their own data
// (goals, plans, completions all stay theirs; they just stop showing up
// on this roster and this coach loses visibility into their training).
export async function removeAthleteFromRoster(athleteId: string): Promise<void> {
  const session = await getAppSession();
  if (!session?.isCoach || !session.coachTeamId) return;

  const admin = createServiceRoleClient();
  await admin
    .from("team_memberships")
    .delete()
    .eq("team_id", session.coachTeamId)
    .eq("user_id", athleteId)
    .eq("role", "athlete");

  revalidatePath("/coach/roster");
}
