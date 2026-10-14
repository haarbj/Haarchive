import { cache } from "react";

import { createClient } from "@/lib/db/server";
import type { ContentPermission } from "@/lib/auth/permissions";

export type TeamMembership = {
  teamId: string;
  role: "athlete" | "coach";
};

export type AppSession = {
  userId: string;
  email: string | null;
  memberships: TeamMembership[];
  // Independent capabilities, not a single "primary role" -- a user can be
  // an athlete on one team and a coach on another simultaneously, so
  // nothing here assumes at most one team_memberships row per user.
  // Derived from `memberships` for convenient call-site checks.
  isAthlete: boolean;
  isCoach: boolean;
  // The team a capability applies to, for code that needs to scope a
  // query/write to it (e.g. the coach dashboard's own team_id inserts).
  // Whichever matching row comes first if a user ever held more than one
  // of the same role (not reachable today: unique(team_id, user_id) plus
  // exactly one team in the whole app means at most one row per role).
  athleteTeamId: string | null;
  coachTeamId: string | null;
  approved: boolean;
  isAdmin: boolean;
  permissions: ContentPermission[];
  // Derived from permissions.includes("private_coach") -- the gate for the
  // private 1-on-1 coaching product, entirely independent of isCoach
  // (team_memberships-based). A user could hold both, neither, or just one.
  // A COARSE capability gate only -- real, per-athlete/per-workout/
  // per-thread access is never decided by this flag alone anywhere in the
  // app; every actual data access re-verifies a real coach_athletes row or
  // relies on RLS's coaches_this_athlete(), which is what makes it safe for
  // this to be true for a self-serve coach too (see isSelfServeCoach).
  isPrivateCoach: boolean;
  // True when isPrivateCoach's underlying user_permissions row was granted
  // by the user themselves (granted_by = their own id, via becomeSelfCoach
  // in coaching/self-coach-actions.ts) rather than an admin. This is
  // PROVENANCE, not a security boundary -- it is checked in exactly one
  // place (inviteAthlete, roster/actions.ts) to enforce the one real
  // product boundary self-coaching exists to protect: a self-serve coach
  // can plan/track their own training with the full toolset, but can never
  // invite or manage a real athlete. Every other coaching-platform action
  // continues to authorize off the real relationship/row regardless of this
  // flag -- never add a second `if (isSelfServeCoach)` check anywhere else
  // without a similarly specific reason.
  isSelfServeCoach: boolean;
  // Whether this user is the athlete side of at least one active
  // coach_athletes row -- unlike isPrivateCoach (an admin-granted
  // capability), this is just a fact derived from a relationship existing,
  // the same way isAthlete is derived from team_memberships. Drives
  // whether "Coaching" shows up in their account menu (see
  // buildAccountWorkspaces) without them needing any special permission.
  // True for a self-coach too (their own coach_athletes row has them as
  // both sides) -- this is what makes coaching/page.tsx's existing
  // isDualRole rendering (isPrivateCoach && isCoachedAthlete) show both
  // "Your Coaching" and "Your Own Training" for a self-coach automatically,
  // with no new branch needed there.
  isCoachedAthlete: boolean;
} | null;

export function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

// Cached per-request: the (protected) layout and any page rendered inside it
// both call this, and React's cache() collapses them into one query instead
// of two. `approved` = has at least one team_memberships row (see the
// access-control migration's own reasoning for reusing that table instead
// of a new column). Admin status is a separate, orthogonal concern -- an
// email allowlist, not tied to team membership at all -- so it's checked
// independently and can unlock access even without an approved team
// membership.
export const getAppSession = cache(async (): Promise<AppSession> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const email = (data.claims.email as string) ?? null;

  // Not .maybeSingle(): a user can hold more than one team_memberships row
  // (athlete on one team, coach on another) -- capabilities are
  // independent, not a single role to pick between.
  const { data: membershipRows } = await supabase
    .from("team_memberships")
    .select("team_id, role")
    .eq("user_id", userId)
    .returns<{ team_id: string; role: "athlete" | "coach" }[]>();

  const memberships: TeamMembership[] = (membershipRows ?? []).map((row) => ({
    teamId: row.team_id,
    role: row.role,
  }));

  // Content permissions (content_contributor/reviewer) are additive to, and
  // never grant, admin -- admin stays exclusively the ADMIN_EMAILS allowlist
  // below, by deliberate choice (see the content_permissions migration).
  const { data: permissionRows } = await supabase
    .from("user_permissions")
    .select("permission, granted_by")
    .eq("user_id", userId)
    .returns<{ permission: ContentPermission; granted_by: string | null }[]>();
  const privateCoachRow = (permissionRows ?? []).find((row) => row.permission === "private_coach");

  // One extra, cheap query (cached per-request same as everything else
  // here) -- coach_athletes_select_as_athlete already scopes this to the
  // caller's own rows, so this can only ever confirm "yes, someone
  // actively coaches me," never leak who.
  const { data: coachedRow } = await supabase
    .from("coach_athletes")
    .select("id")
    .eq("athlete_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return {
    userId,
    email,
    memberships,
    isAthlete: memberships.some((m) => m.role === "athlete"),
    isCoach: memberships.some((m) => m.role === "coach"),
    athleteTeamId: memberships.find((m) => m.role === "athlete")?.teamId ?? null,
    coachTeamId: memberships.find((m) => m.role === "coach")?.teamId ?? null,
    approved: memberships.length > 0,
    isAdmin: isAdminEmail(email),
    permissions: (permissionRows ?? []).map((row) => row.permission),
    isPrivateCoach: !!privateCoachRow,
    isSelfServeCoach: privateCoachRow?.granted_by === userId,
    isCoachedAthlete: !!coachedRow,
  };
});
