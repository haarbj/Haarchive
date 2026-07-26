import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";

// Self-serve training-plan generation is disabled for the general public
// for now -- only real team members (coach-managed schedules) can reach
// this route. Every isAthlete=true user is already fully on that
// coach-managed path (plan/new/page.tsx redirects them away from self-serve
// generation unconditionally), and the coach's own per-athlete view renders
// PlanView directly without going through this route -- so this guard
// can't regress either existing flow, only close the self-serve loophole.
export default async function PlanLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session?.isAthlete) redirect("/dashboard");

  return children;
}
