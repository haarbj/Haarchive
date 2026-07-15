"use server";

import { getAppSession } from "@/lib/auth/session";
import { buildAccountWorkspaces, type Workspace } from "@/lib/auth/workspaces";

// isAdmin can only ever be computed server-side (ADMIN_EMAILS is a
// server-only env var, never shipped to the browser), so the account menu
// -- a client component -- fetches its workspace list through this action
// rather than querying Supabase directly the way the old role-only hook
// did. Called once per mount, same as the hook it replaces: a user's
// capabilities essentially never change mid-session.
export async function fetchAccountWorkspaces(): Promise<Workspace[]> {
  const session = await getAppSession();
  return buildAccountWorkspaces(session);
}
