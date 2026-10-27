import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { resolveViewAsState } from "@/lib/private-coaching/view-as";

// Self-serve training-plan generation is disabled for the general public
// for now -- only a coach-managed athlete (team-based isAthlete, OR
// privately-coached isCoachedAthlete) can reach this route. This used to
// check isAthlete alone, written before private coaching (coach_athletes)
// existed as a product -- that silently locked a privately-coached,
// non-team athlete out of /plan entirely (redirect("/dashboard") on every
// visit), which meant plan-view.tsx's own coach-assigned-workout
// rendering and Weekly Load figure (added Oct 19 for exactly this
// audience) could never actually run for them: the route itself was
// unreachable before either piece of logic ever got a chance to execute.
// plan/new/page.tsx's own session?.athleteTeamId check only ever blocked
// the team case from self-serve generation -- isCoachedAthlete needed
// the same treatment there, not just here, or opening this gate would
// have let a privately-coached athlete reach self-serve generation and
// create a plan that collides with their coach's own assignments.
//
// A second gap, found separately: this check only ever looked at the
// SIGNED-IN session's own isAthlete/isCoachedAthlete, with no view-as
// awareness at all -- a coach actively viewing as one of their athletes
// is neither of those things themselves, so they were redirected to
// /dashboard on every /plan visit, silently dropping out of view-as
// (plan/page.tsx below this layout is already fully view-as aware and
// never got the chance to run). resolveViewAsState re-validates the
// relationship itself, so a coach with no active view-as mode still
// falls through to the ordinary redirect, unchanged.
export default async function PlanLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (session?.isAthlete || session?.isCoachedAthlete) return children;

  if (session?.isPrivateCoach) {
    const supabase = await createClient();
    const viewAs = await resolveViewAsState(supabase, session.userId);
    if (viewAs) return children;
  }

  redirect("/dashboard");
}
