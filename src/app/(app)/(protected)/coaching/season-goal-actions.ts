"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { isViewingAsAthlete, VIEW_AS_REFUSAL } from "@/lib/private-coaching/view-as";
import { seasonGoalSchema } from "@/lib/validation/athlete-profile";

export type UpdateSeasonGoalState = { error?: string };

// Athlete-authored only -- there is no coach-facing version of this
// action anywhere in the codebase, and this one always writes to the
// CALLER's own row (eq/upsert keyed on session.userId, never a
// parameter), so there's no id to spoof a coach's way into. The
// isViewingAsAthlete guard is still here for the same reason every other
// athlete-surface mutation has it (see view-as.ts's own header): a coach
// browsing as an athlete should never be able to write anything,
// regardless of whose row it would land on.
export async function updateSeasonGoal(_prevState: UpdateSeasonGoalState, formData: FormData): Promise<UpdateSeasonGoalState> {
  const session = await getAppSession();
  if (!session) return { error: "Sign in first." };

  const supabase = await createClient();
  if (await isViewingAsAthlete(supabase, session.userId)) return { error: VIEW_AS_REFUSAL };

  const parsed = seasonGoalSchema.safeParse(formData.get("seasonGoal") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your season goal." };

  // upsert, not update: a brand-new athlete who hasn't completed any
  // other part of onboarding yet may have no athlete_profiles row at all
  // (same reasoning updateTrainingBackground/the settings form already
  // follow for this exact table).
  const { error } = await supabase.from("athlete_profiles").upsert({
    user_id: session.userId,
    season_goal: parsed.data || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/coaching");
  return {};
}
