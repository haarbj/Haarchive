import { describe, expect, it } from "vitest";

import { buildAccountWorkspaces } from "@/lib/auth/workspaces";
import type { AppSession } from "@/lib/auth/session";

function baseSession(overrides: Partial<NonNullable<AppSession>> = {}): AppSession {
  return {
    userId: "user-1",
    email: "runner@example.com",
    memberships: [],
    isAthlete: false,
    isCoach: false,
    athleteTeamId: null,
    coachTeamId: null,
    approved: false,
    isAdmin: false,
    permissions: [],
    ...overrides,
  };
}

describe("buildAccountWorkspaces", () => {
  it("returns nothing for a null session", () => {
    expect(buildAccountWorkspaces(null)).toEqual([]);
  });

  it("shows only Dashboard for an athlete-only user", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isAthlete: true, approved: true }));
    expect(workspaces).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
  });

  it("shows only Coach Dashboard for a coach-only user", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isCoach: true, approved: true }));
    expect(workspaces).toEqual([{ label: "Coach Dashboard", href: "/coach" }]);
  });

  it("shows both Dashboard and Coach Dashboard for an athlete+coach user, in that order", () => {
    const workspaces = buildAccountWorkspaces(
      baseSession({ isAthlete: true, isCoach: true, approved: true }),
    );
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Coach Dashboard", href: "/coach" },
    ]);
  });

  it("shows Contributor Workspace for a content_contributor", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ permissions: ["content_contributor"] }));
    expect(workspaces).toEqual([{ label: "Contributor Workspace", href: "/contribute" }]);
  });

  it("shows Contributor Workspace for a reviewer", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ permissions: ["reviewer"] }));
    expect(workspaces).toEqual([{ label: "Contributor Workspace", href: "/contribute" }]);
  });

  it("shows Contributor Workspace and Admin for an admin with no content permission", () => {
    // Admins can always reach /contribute (see contribute/layout.tsx), even
    // without holding content_contributor/reviewer themselves.
    const workspaces = buildAccountWorkspaces(baseSession({ isAdmin: true }));
    expect(workspaces).toEqual([
      { label: "Contributor Workspace", href: "/contribute" },
      { label: "Admin", href: "/admin" },
    ]);
  });

  it("does not duplicate Contributor Workspace for an admin who also holds a content permission", () => {
    const workspaces = buildAccountWorkspaces(
      baseSession({ isAdmin: true, permissions: ["content_contributor"] }),
    );
    expect(workspaces.filter((w) => w.href === "/contribute")).toHaveLength(1);
  });

  it("shows every workspace, in a fixed order, for athlete + coach + contributor + admin", () => {
    const workspaces = buildAccountWorkspaces(
      baseSession({
        isAthlete: true,
        isCoach: true,
        isAdmin: true,
        approved: true,
        permissions: ["content_contributor"],
      }),
    );
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Coach Dashboard", href: "/coach" },
      { label: "Contributor Workspace", href: "/contribute" },
      { label: "Admin", href: "/admin" },
    ]);
  });

  it("returns nothing for a session with no capabilities at all", () => {
    expect(buildAccountWorkspaces(baseSession())).toEqual([]);
  });
});
