import type { AppSession } from "@/lib/auth/session";
import { hasAnyContentPermission } from "@/lib/auth/permissions";

export type Workspace = {
  label: string;
  href: string;
  /** Dashboard only -- whether to also show the Training Plan sub-link (real team members only; self-serve plan generation is disabled for everyone else, see plan/layout.tsx). */
  showTrainingPlanLink?: boolean;
};

// Enumerates every workspace this session actually has access to, in a
// fixed display order -- deliberately not a single "primary role" pick.
// Athlete, coach, content-contributor/reviewer, and admin are independent
// capabilities a user can hold in any combination (see AppSession), so the
// account menu lists all of them rather than redirecting into one. Order
// matches the site's own url structure (dashboard, coach, contribute,
// admin) and is stable regardless of which capabilities are present.
//
// Dashboard is shown to every session, not just team athletes -- the site
// is open to any signed-in community member now, and /dashboard already
// degrades gracefully with no team/plan (onboarding form, per-section
// empty states).
export function buildAccountWorkspaces(session: AppSession): Workspace[] {
  if (!session) return [];

  const workspaces: Workspace[] = [];
  workspaces.push({ label: "Dashboard", href: "/dashboard", showTrainingPlanLink: session.isAthlete });
  if (session.isCoach) workspaces.push({ label: "Coach Dashboard", href: "/coach" });
  if (hasAnyContentPermission(session.permissions) || session.isAdmin) {
    workspaces.push({ label: "Contributor Workspace", href: "/contribute" });
  }
  if (session.isAdmin) workspaces.push({ label: "Admin", href: "/admin" });
  return workspaces;
}
