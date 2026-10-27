import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";

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
export default async function PlanLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session?.isAthlete && !session?.isCoachedAthlete) redirect("/dashboard");

  return children;
}
