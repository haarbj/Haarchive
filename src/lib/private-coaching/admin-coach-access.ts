import "server-only";

import type { createClient } from "@/lib/db/server";
import { getUserEmailById } from "@/lib/admin/users";
import { isAdminEmail } from "@/lib/auth/session";

// Some private-coaching tools (e.g. the Pace Zone Table) are meant only
// for athletes coached by an admin account, not every private coach's
// roster -- a narrower gate than isCoachedAthlete alone, which only means
// "coached by *some* active private coach." Resolves the athlete's real
// coach (the same coach_athletes lookup AthleteHomeSection already does in
// coaching/page.tsx) and checks that coach's email against the same
// ADMIN_EMAILS allowlist isAdminEmail() already uses everywhere else --
// deliberately reusing the existing admin mechanism rather than
// introducing a second, parallel "who's special" concept. Requires a
// service-role email lookup (getUserEmailById) since RLS never exposes
// another user's email to the athlete's own session.
export async function isAthleteCoachedByAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
): Promise<boolean> {
  const { data: relationship } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", athleteId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ coach_id: string }>();

  if (!relationship) return false;
  const coachEmail = await getUserEmailById(relationship.coach_id);
  return isAdminEmail(coachEmail);
}
