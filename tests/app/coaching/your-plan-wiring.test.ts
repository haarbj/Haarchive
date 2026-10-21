import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see realignment-service-wiring.test.ts's own header comment for
// the established pattern) verifying the contracts the pure
// functions/unit tests elsewhere can't prove on their own: the payoff
// auto-shows exactly once, dismissal persists without blocking later
// direct access, and the coach's preview renders the exact same component
// the athlete's real route does.

const ROOT = join(__dirname, "../../..");
const COACHING_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/page.tsx"), "utf8");
const YOUR_PLAN_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/page.tsx"), "utf8");
const PREVIEW_PAGE = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/your-plan-preview/page.tsx"),
  "utf8",
);
const DISMISS_ACTIONS = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/actions.ts"), "utf8");
const NOTIFICATION_HREF = readFileSync(join(ROOT, "src/lib/notifications/notification-href.ts"), "utf8");

describe("the payoff auto-shows exactly once, from coaching home", () => {
  it("checks plan_payoff_dismissed_at before ever redirecting", () => {
    const dismissedCheckIndex = COACHING_PAGE.indexOf("plan_payoff_dismissed_at");
    const redirectIndex = COACHING_PAGE.indexOf('redirect("/coaching/your-plan")');
    expect(dismissedCheckIndex).toBeGreaterThan(-1);
    expect(redirectIndex).toBeGreaterThan(-1);
    expect(redirectIndex).toBeGreaterThan(dismissedCheckIndex);
  });

  it("only looks for an assigned program (training_phases) when dismissed_at is still null -- a returning athlete who already saw it costs nothing extra", () => {
    const guardIndex = COACHING_PAGE.indexOf("if (!profileRow?.plan_payoff_dismissed_at) {");
    const phasesCheckIndex = COACHING_PAGE.indexOf('.from("training_phases")', guardIndex);
    const redirectIndex = COACHING_PAGE.indexOf('redirect("/coaching/your-plan")');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(phasesCheckIndex).toBeGreaterThan(guardIndex);
    expect(redirectIndex).toBeGreaterThan(phasesCheckIndex);
  });

  it("stays reachable afterward via a plain, always-rendered link -- never gated on the dismissal flag", () => {
    expect(COACHING_PAGE).toContain('href="/coaching/your-plan"');
    expect(COACHING_PAGE).toContain("Your plan overview");
  });
});

describe("dismissal persists and never blocks later direct access", () => {
  it("dismissPlanPayoff only ever updates the caller's own profile row", () => {
    const start = DISMISS_ACTIONS.indexOf("export async function dismissPlanPayoff");
    const body = DISMISS_ACTIONS.slice(start, DISMISS_ACTIONS.indexOf("\nexport ", start + 1));
    expect(body).toContain('.from("profiles")');
    expect(body).toContain(".update({ plan_payoff_dismissed_at:");
    expect(body).toContain('.eq("id", session.userId)');
  });

  it("the real /coaching/your-plan route never checks plan_payoff_dismissed_at itself -- only the auto-redirect does, so a direct/profile-menu visit always works", () => {
    expect(YOUR_PLAN_PAGE).not.toContain("plan_payoff_dismissed_at");
  });
});

describe("coach preview renders the exact same component as the athlete's real view", () => {
  it("both routes import PlanPayoffView from the same module, and neither defines its own copy", () => {
    expect(YOUR_PLAN_PAGE).toContain('import { PlanPayoffView } from "@/components/private-coaching/plan-payoff-view"');
    expect(PREVIEW_PAGE).toContain('import { PlanPayoffView } from "@/components/private-coaching/plan-payoff-view"');
  });

  it("both routes load data through the exact same loadPlanPayoffData function", () => {
    expect(YOUR_PLAN_PAGE).toContain("loadPlanPayoffData(");
    expect(PREVIEW_PAGE).toContain("loadPlanPayoffData(");
  });

  it("the preview is read-only -- it never imports a mutating action (dismiss/goal/race-result)", () => {
    expect(PREVIEW_PAGE).not.toContain("dismissPlanPayoff");
    expect(PREVIEW_PAGE).not.toContain("createGoalRace");
    expect(PREVIEW_PAGE).not.toContain("addRaceResult");
  });

  it("the preview is labeled mode=\"coach-preview\", distinguishing it from the real athlete view at the one place behavior can differ", () => {
    expect(PREVIEW_PAGE).toContain('mode="coach-preview"');
    // your-plan/page.tsx now also reaches "coach-preview" mode, but only
    // while a coach's view-as mode is active against this exact route --
    // its own default, for a real coached athlete, is still "athlete".
    expect(YOUR_PLAN_PAGE).toMatch(/mode=\{viewAs \? "coach-preview" : "athlete"\}/);
  });
});

describe("the program_assigned notification points at the real payoff route", () => {
  it("notification-href.ts routes program_assigned to /coaching/your-plan", () => {
    const start = NOTIFICATION_HREF.indexOf('if (type === "program_assigned")');
    const nextIf = NOTIFICATION_HREF.indexOf("\n  if (", start + 1);
    const block = NOTIFICATION_HREF.slice(start, nextIf === -1 ? undefined : nextIf);
    expect(block).toContain('return "/coaching/your-plan"');
  });
});
