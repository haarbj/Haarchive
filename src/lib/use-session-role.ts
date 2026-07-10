"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/db/client";

export type SessionRole = "athlete" | "coach" | null;

// Only meant to be called from components that already know the caller is
// authenticated (e.g. AccountMenu, rendered inside AuthStatus's
// "authenticated" branch) -- this fetches once on mount rather than
// re-listening for auth-state changes the way useAuthStatus does, since a
// user's role essentially never changes mid-session.
export function useSessionRole(): SessionRole {
  const [role, setRole] = useState<SessionRole>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getClaims().then(({ data }) => {
      const userId = data?.claims?.sub;
      if (!userId) return;
      supabase
        .from("team_memberships")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data: membership }) => {
          if (!cancelled) setRole(membership?.role ?? null);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return role;
}
