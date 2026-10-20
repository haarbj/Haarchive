import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see realignment-service-wiring.test.ts's own header comment for
// the established pattern) verifying every surface consumes the exact
// same evaluateIntakeGaps function, never a fork of it, and that nothing
// in the assignment/publish flows reads intake state at all -- the
// non-blocking requirement proven by construction, not by a runtime
// check.

const ROOT = join(__dirname, "../../..");
const SETTINGS_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/settings/page.tsx"), "utf8");
const YOUR_PLAN_DATA = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/data.ts"), "utf8");
const PLAN_PAYOFF_VIEW = readFileSync(join(ROOT, "src/components/private-coaching/plan-payoff-view.tsx"), "utf8");
const ATHLETE_DETAIL_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/page.tsx"), "utf8");
const ROSTER_DATA = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/roster/roster-data.ts"), "utf8");
const ROSTER_ROW = readFileSync(join(ROOT, "src/lib/private-coaching/roster-row.ts"), "utf8");
const ASSIGN_PROGRAM_ACTIONS = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/assign-program-actions.ts"),
  "utf8",
);
const SCHEDULE_ACTIONS = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions.ts"),
  "utf8",
);

describe("every surface imports and calls the one evaluateIntakeGaps function -- never a fork", () => {
  it.each([
    ["Settings (athlete prompt card)", SETTINGS_PAGE],
    ["Your Plan payoff loader", YOUR_PLAN_DATA],
    ["coach athlete detail page (Intake section)", ATHLETE_DETAIL_PAGE],
    ["roster loader (Intake incomplete badge)", ROSTER_DATA],
  ])("%s imports evaluateIntakeGaps from intake-gaps.ts and calls it", (_label, source) => {
    expect(source).toContain('from "@/lib/private-coaching/intake-gaps"');
    expect(source).toContain("evaluateIntakeGaps(");
  });
});

describe("the Your Plan payoff view's own intake prompts", () => {
  it("renders nothing when every gap item is complete", () => {
    const start = PLAN_PAYOFF_VIEW.indexOf("function IntakeGapsSection");
    const body = PLAN_PAYOFF_VIEW.slice(start, PLAN_PAYOFF_VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toMatch(/if \(remaining\.length === 0\) return null;/);
  });

  it("filters out goal_race/fitness_anchor -- those already have dedicated remedies elsewhere on the same page", () => {
    const start = PLAN_PAYOFF_VIEW.indexOf("function IntakeGapsSection");
    const body = PLAN_PAYOFF_VIEW.slice(start, PLAN_PAYOFF_VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("PAYOFF_HANDLED_GAP_KEYS");
  });

  it("each remaining missing item deep-links to its own real field, in athlete mode", () => {
    const start = PLAN_PAYOFF_VIEW.indexOf("function IntakeGapsSection");
    const body = PLAN_PAYOFF_VIEW.slice(start, PLAN_PAYOFF_VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("href={item.athleteHref}");
  });
});

describe("the roster badge is driven by the same evaluation, not a second rule", () => {
  it("computeRosterAttentionBadges takes hasIncompleteIntake as a plain boolean input, computed by the caller, not by importing/calling evaluateIntakeGaps itself", () => {
    expect(ROSTER_ROW).toContain("hasIncompleteIntake: boolean");
    expect(ROSTER_ROW).not.toMatch(/import.*evaluateIntakeGaps/);
    expect(ROSTER_ROW).not.toContain("evaluateIntakeGaps(");
  });

  it("roster-data.ts is the one place that calls evaluateIntakeGaps and passes its result in", () => {
    expect(ROSTER_DATA).toMatch(/hasIncompleteIntake:\s*intakeGaps\.missing\.length > 0/);
  });
});

describe("assignment and publish flows never read intake state -- non-blocking by construction", () => {
  it("assign-program-actions.ts has no reference to intake gaps at all", () => {
    expect(ASSIGN_PROGRAM_ACTIONS).not.toMatch(/intake/i);
  });

  it("the schedule's own publish/save action has no reference to intake gaps at all", () => {
    expect(SCHEDULE_ACTIONS).not.toMatch(/intake/i);
  });
});
