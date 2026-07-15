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
    .select("permission")
    .eq("user_id", userId)
    .returns<{ permission: ContentPermission }[]>();

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
  };
});
