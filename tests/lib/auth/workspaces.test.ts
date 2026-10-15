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
    isPrivateCoach: false,
    isSelfServeCoach: false,
    isCoachedAthlete: false,
    ...overrides,
  };
}

describe("buildAccountWorkspaces", () => {
  it("returns nothing for a null session", () => {
    expect(buildAccountWorkspaces(null)).toEqual([]);
  });

  it("shows Dashboard (without the Training Plan sub-link) for a plain signed-in user with no other capabilities", () => {
    // The site is open to any signed-in community member -- Dashboard is
    // no longer gated on team membership, only the Training Plan sub-link is.
    expect(buildAccountWorkspaces(baseSession())).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
    ]);
  });

  it("shows Dashboard with the Training Plan sub-link enabled for a real team athlete", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isAthlete: true, approved: true }));
    expect(workspaces).toEqual([{ label: "Dashboard", href: "/dashboard", showTrainingPlanLink: true }]);
  });

  it("shows Dashboard and Coach Dashboard for a coach-only user, with the Training Plan sub-link disabled", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isCoach: true, approved: true }));
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
      { label: "Coach Dashboard", href: "/coach" },
    ]);
  });

  it("shows both Dashboard (with Training Plan) and Coach Dashboard for an athlete+coach user, in that order", () => {
    const workspaces = buildAccountWorkspaces(
      baseSession({ isAthlete: true, isCoach: true, approved: true }),
    );
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: true },
      { label: "Coach Dashboard", href: "/coach" },
    ]);
  });

  it("shows Dashboard and Contributor Workspace for a content_contributor", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ permissions: ["content_contributor"] }));
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
      { label: "Contributor Workspace", href: "/contribute" },
    ]);
  });

  it("shows Dashboard and Contributor Workspace for a reviewer", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ permissions: ["reviewer"] }));
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
      { label: "Contributor Workspace", href: "/contribute" },
    ]);
  });

  it("shows Dashboard, Contributor Workspace, and Admin for an admin with no content permission", () => {
    // Admins can always reach /contribute (see contribute/layout.tsx), even
    // without holding content_contributor/reviewer themselves.
    const workspaces = buildAccountWorkspaces(baseSession({ isAdmin: true }));
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
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

  it("shows Coaching for a private coach", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isPrivateCoach: true }));
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
      { label: "Coaching", href: "/coaching" },
    ]);
  });

  it("shows 'My Coaching' for a privately-coached athlete who isn't also a coach -- a bare 'Coaching' reads ambiguously as if they coach someone", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isCoachedAthlete: true }));
    expect(workspaces).toEqual([
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: false },
      { label: "My Coaching", href: "/coaching" },
    ]);
  });

  it("keeps the plain 'Coaching' label for a coach, even if they're also a coached athlete themselves", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isPrivateCoach: true, isCoachedAthlete: true }));
    expect(workspaces).toContainEqual({ label: "Coaching", href: "/coaching" });
  });

  it("does not duplicate the coaching workspace for a user who is both a private coach and (separately) a coached athlete", () => {
    const workspaces = buildAccountWorkspaces(baseSession({ isPrivateCoach: true, isCoachedAthlete: true }));
    expect(workspaces.filter((w) => w.href === "/coaching")).toHaveLength(1);
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
      { label: "Dashboard", href: "/dashboard", showTrainingPlanLink: true },
      { label: "Coach Dashboard", href: "/coach" },
      { label: "Contributor Workspace", href: "/contribute" },
      { label: "Admin", href: "/admin" },
    ]);
  });
});
