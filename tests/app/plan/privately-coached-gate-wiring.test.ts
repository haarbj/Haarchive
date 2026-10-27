import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for a real bug: /plan (and /plan/new) were gated on
// session.isAthlete alone -- a team-membership concept that predates
// private coaching (coach_athletes) as a product. A privately-coached,
// non-team athlete was unconditionally redirected to /dashboard on every
// visit to /plan, and even once that gate opened, plan-view.tsx's own
// !plan branch unconditionally redirected to /plan/new (self-serve
// generation) for anyone with no self-generated training_plans row --
// which is the NORMAL state for a privately-coached athlete, whose
// schedule lives in scheduled_workouts instead. Together these meant the
// Oct 19 fix's own coach-assigned-workout rendering and Weekly Load logic
// in plan-view.tsx could never actually execute for the exact audience it
// was built for: the route itself was unreachable before either piece of
// logic got a chance to run. No React render harness exists in this repo
// (see today-conditions-wiring.test.ts's own header comment for the
// established pattern) -- these are source-scan assertions.

const ROOT = join(__dirname, "../../..");
const LAYOUT = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/layout.tsx"), "utf8");
const NEW_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/new/page.tsx"), "utf8");
const PLAN_VIEW = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/plan-view.tsx"), "utf8");

describe("plan/layout.tsx admits a privately-coached athlete, not just a team-based one", () => {
  it("checks isCoachedAthlete alongside isAthlete before redirecting to /dashboard", () => {
    expect(LAYOUT).toMatch(/!session\?\.isAthlete\s*&&\s*!session\?\.isCoachedAthlete/);
  });
});

describe("plan/new/page.tsx blocks a privately-coached athlete from self-serve generation, not just a team one", () => {
  it("redirects to /plan for isCoachedAthlete, alongside the existing athleteTeamId check", () => {
    expect(NEW_PAGE).toMatch(/session\?\.athleteTeamId\s*\|\|\s*session\?\.isCoachedAthlete/);
    expect(NEW_PAGE).toContain('redirect("/plan")');
  });
});

describe("plan-view.tsx's !plan branch resolves a coach relationship before ever redirecting to /plan/new", () => {
  it("calls getActiveCoachRelationship inside the !plan branch, not just redirecting unconditionally", () => {
    const noPlanBranchStart = PLAN_VIEW.indexOf("if (!plan) {");
    expect(noPlanBranchStart).toBeGreaterThan(-1);
    // The branch that previously was just `redirect("/plan/new")` for
    // every non-coachView case now has real logic before any redirect --
    // slice a generous window and check the relationship lookup appears
    // inside it, before the fallback redirect.
    const branchBody = PLAN_VIEW.slice(noPlanBranchStart, noPlanBranchStart + 3000);
    const relationshipCallIdx = branchBody.indexOf("await getActiveCoachRelationship(supabase, userId)");
    const fallbackRedirectIdx = branchBody.indexOf('if (!relationship) redirect("/plan/new")');
    expect(relationshipCallIdx).toBeGreaterThan(-1);
    expect(fallbackRedirectIdx).toBeGreaterThan(relationshipCallIdx);
  });

  it("renders the assigned-workout list and Weekly Load inside the !plan branch when a relationship exists", () => {
    const noPlanBranchStart = PLAN_VIEW.indexOf("if (!plan) {");
    const nextBranchStart = PLAN_VIEW.indexOf("const { data: mesocycles }");
    const branchBody = PLAN_VIEW.slice(noPlanBranchStart, nextBranchStart);
    expect(branchBody).toContain("fetchCalendarWorkouts(supabase, userId, relationship.coachId");
    expect(branchBody).toContain("publishedAssignedWorkoutsThisWeek(workoutsByDate)");
    expect(branchBody).toContain("weeklyLoadEntriesFromAssignedWorkouts(assignedWorkouts)");
    expect(branchBody).toContain("<AssignedWorkoutRow key={workout.id} workout={workout} />");
  });

  it("the coachView no-plan message is unchanged -- this fix is scoped to the self-view path only", () => {
    expect(PLAN_VIEW).toContain("This athlete doesn&rsquo;t have a training plan yet.");
  });
});
