import type { AppSession } from "@/lib/auth/session";
import { hasAnyContentPermission } from "@/lib/auth/permissions";

export type Workspace = { label: string; href: string };

// Enumerates every workspace this session actually has access to, in a
// fixed display order -- deliberately not a single "primary role" pick.
// Athlete, coach, content-contributor/reviewer, and admin are independent
// capabilities a user can hold in any combination (see AppSession), so the
// account menu lists all of them rather than redirecting into one. Order
// matches the site's own url structure (dashboard, coach, contribute,
// admin) and is stable regardless of which capabilities are present.
export function buildAccountWorkspaces(session: AppSession): Workspace[] {
  if (!session) return [];

  const workspaces: Workspace[] = [];
  if (session.isAthlete) workspaces.push({ label: "Dashboard", href: "/dashboard" });
  if (session.isCoach) workspaces.push({ label: "Coach Dashboard", href: "/coach" });
  if (hasAnyContentPermission(session.permissions) || session.isAdmin) {
    workspaces.push({ label: "Contributor Workspace", href: "/contribute" });
  }
  if (session.isAdmin) workspaces.push({ label: "Admin", href: "/admin" });
  return workspaces;
}
