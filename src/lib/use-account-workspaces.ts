"use client";

import { useEffect, useState } from "react";

import { fetchAccountWorkspaces } from "@/app/(app)/account-actions";
import type { Workspace } from "@/lib/auth/workspaces";

// Replaces the old single-role useSessionRole hook: a user's account menu
// now lists every workspace they have access to (Dashboard, Coach
// Dashboard, Contributor Workspace, Admin), not just one. Only meant to be
// called from components that already know the caller is authenticated
// (e.g. AccountMenu, rendered inside AuthStatus's "authenticated" branch).
export function useAccountWorkspaces(): Workspace[] {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAccountWorkspaces().then((result) => {
      if (!cancelled) setWorkspaces(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return workspaces;
}
