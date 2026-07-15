import { cache } from "react";

import { createClient } from "@/lib/db/server";
import type { ContentPermission } from "@/lib/auth/permissions";

export type AppSession = {
  userId: string;
  email: string | null;
  role: "athlete" | "coach" | null;
  teamId: string | null;
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
// of two. `approved` = has a team_memberships row (see the access-control
// migration's own reasoning for reusing that table instead of a new column).
// Admin status is a separate, orthogonal concern -- an email allowlist, not
// tied to team membership at all -- so it's checked independently and can
// unlock access even without an approved team membership.
export const getAppSession = cache(async (): Promise<AppSession> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const email = (data.claims.email as string) ?? null;

  const { data: membership } = await supabase
    .from("team_memberships")
    .select("team_id, role")
    .eq("user_id", userId)
    .maybeSingle();

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
    role: membership?.role ?? null,
    teamId: membership?.team_id ?? null,
    approved: !!membership,
    isAdmin: isAdminEmail(email),
    permissions: (permissionRows ?? []).map((row) => row.permission),
  };
});
