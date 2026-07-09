import { cache } from "react";

import { createClient } from "@/lib/db/server";

export type AppSession = {
  userId: string;
  email: string | null;
  role: "athlete" | "coach" | null;
  teamId: string | null;
  approved: boolean;
} | null;

// Cached per-request: the (protected) layout and any page rendered inside it
// both call this, and React's cache() collapses them into one query instead
// of two. `approved`/`role`/`teamId` are hardcoded here for now -- there's no
// team_memberships data yet, so every authenticated user is treated as
// approved, matching today's actual behavior exactly. The access-control
// migration upgrades this body to query team_memberships for real.
export const getAppSession = cache(async (): Promise<AppSession> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  return { userId, email: (data.claims.email as string) ?? null, role: null, teamId: null, approved: true };
});
