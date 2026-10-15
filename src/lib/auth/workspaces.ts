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
  // Private 1-on-1 coaching -- shown for either side of the relationship:
  // a coach managing their roster, or an athlete who's been accepted by
  // one. isPrivateCoach and isCoachedAthlete are independent (see
  // AppSession), but both land on the same role-aware /coaching entry
  // point, so one shared menu item covers both. The label itself still
  // needs to differ, though: a bare "Coaching" read by an athlete who
  // isn't also a coach could plausibly be misread as "the people I
  // coach," not "the coaching I receive" -- "My Coaching" removes that
  // ambiguity. A coach (whether or not also a coached athlete themselves)
  // keeps the plain label, since the page's own internal "Your Coaching"/
  // "Your Own Training" sub-headers already disambiguate the dual-role case.
  if (session.isPrivateCoach || session.isCoachedAthlete) {
    workspaces.push({ label: session.isPrivateCoach ? "Coaching" : "My Coaching", href: "/coaching" });
  }
  if (hasAnyContentPermission(session.permissions) || session.isAdmin) {
    workspaces.push({ label: "Contributor Workspace", href: "/contribute" });
  }
  if (session.isAdmin) workspaces.push({ label: "Admin", href: "/admin" });
  return workspaces;
}
