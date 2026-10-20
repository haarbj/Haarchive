"use server";

import { revalidatePath } from "next/cache";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { metersFor } from "@/lib/race-distances";

// Marks the payoff seen so the one-time auto-redirect (coaching/page.tsx's
// AthleteHomeSection) never fires again -- the page itself stays reachable
// afterward through an ordinary link regardless of this flag. Mirrors
// setCoachTrainsSelf's own shape: a plain update to the caller's own
// profile row, no separate authorization check needed since
// profiles_update_own RLS already scopes this to the caller.
export async function dismissPlanPayoff(): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ plan_payoff_dismissed_at: new Date().toISOString() })
    .eq("id", session.userId);
  if (error) return { error: error.message };
  revalidatePath("/coaching");
  return {};
}

// The payoff's own inline "no goal race yet" remedy -- a plain insert
// into the same `goals` table the self-serve dashboard already reads/
// writes (see goal-race.ts's own header comment on why there's no
// second, private-coaching-specific goal table). No existing create-a-
// goal action exists to reuse (dashboard/actions.ts's updateGoal only
// ever updates a goal that already has a row) -- this is the minimal
// insert that action never needed, scoped to a coached athlete adding
// their first goal race from this view specifically.
export async function createGoalRace(raceName: string, goalDate: string): Promise<{ error?: string }> {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) return { error: "Not authorized." };
  if (!raceName.trim() || !goalDate) return { error: "Enter both a race name and a date." };

  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    user_id: session.userId,
    race_name: raceName.trim(),
    distance_m: metersFor("marathon"),
    goal_date: goalDate,
    status: "active",
  });
  if (error) return { error: error.message };
  revalidatePath("/coaching/your-plan");
  return {};
}
