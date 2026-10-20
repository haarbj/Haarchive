import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see realignment-service-wiring.test.ts's own header comment for
// the established pattern) verifying every required display state is a
// real branch in ConditionsSection, and that it's absent entirely for a
// manually-logged completion (no Strava activity).

const ROOT = join(__dirname, "../..");
const SECTION = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/workouts/[workoutId]/conditions-section.tsx"),
  "utf8",
);
const PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/workouts/[workoutId]/page.tsx"), "utf8");
const COMPLETION_ACTIONS = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/workouts/[workoutId]/completion-actions.ts"),
  "utf8",
);

describe("ConditionsSection renders every required state", () => {
  it("is absent entirely for a manually-logged completion -- no Strava activity, no nag", () => {
    expect(SECTION).toContain("if (!hasStravaActivity) return null;");
  });

  it("not analyzed: shows the action, no auto-fetch", () => {
    expect(SECTION).toMatch(/status === "not_analyzed"/);
    expect(SECTION).toContain("Analyze conditions");
  });

  it("analyzing: a plain status line, both for the live isPending transition and a stored 'pending' status", () => {
    expect(SECTION).toMatch(/status === "analyzing" \|\| status === "pending"/);
    expect(SECTION).toContain("Analyzing…");
  });

  it("failed: shows the real error and a retry action", () => {
    expect(SECTION).toMatch(/status === "failed"/);
    expect(SECTION).toContain("Retry");
  });

  it("ready: renders the actual-vs-ideal headline, per-factor breakdown, and the raw conditions used", () => {
    expect(SECTION).toContain("<ReadyConditions");
    const readyBody = SECTION.slice(SECTION.indexOf("function ReadyConditions"));
    expect(readyBody).toContain("actualPaceSPerMi");
    expect(readyBody).toContain("idealPaceSPerMi");
    expect(readyBody).toContain("topFactors");
    expect(readyBody).toContain("Conditions used");
  });

  it("never fetches on its own -- there is no useEffect, only the explicit action handler", () => {
    expect(SECTION).not.toContain("useEffect");
  });
});

describe("the workout detail page wires ConditionsSection with the real Strava/analysis columns", () => {
  it("passes hasStravaActivity from strava_activity_id and the stored analysis from conditions_analysis", () => {
    expect(PAGE).toContain("hasStravaActivity={completion.strava_activity_id != null}");
    expect(PAGE).toContain("analysis={completion.conditions_analysis}");
  });

  it("fetches conditions_analysis and strava_activity_ids in the same completed_workouts select everything else reads from", () => {
    const selectIndex = PAGE.indexOf('"actual_distance_m,');
    expect(selectIndex).toBeGreaterThan(-1);
    const selectLine = PAGE.slice(selectIndex, PAGE.indexOf('"', selectIndex + 1) + 1);
    expect(selectLine).toContain("conditions_analysis");
    expect(selectLine).toContain("strava_activity_ids");
  });
});

describe("triggerConditionsAnalysis leans on completed_workouts' own RLS for authorization, not a re-implemented check", () => {
  it("never queries coach_athletes or re-derives who the coach is -- the session-scoped select itself is the authorization", () => {
    const start = COMPLETION_ACTIONS.indexOf("export async function triggerConditionsAnalysis");
    const body = COMPLETION_ACTIONS.slice(start);
    expect(body).not.toContain("coach_athletes");
    expect(body).not.toContain("coaches_this_athlete");
    expect(body).toContain('.from("completed_workouts")');
  });

  it("refuses a completion with no Strava data at all", () => {
    const start = COMPLETION_ACTIONS.indexOf("export async function triggerConditionsAnalysis");
    const body = COMPLETION_ACTIONS.slice(start);
    expect(body).toMatch(/strava_activity_id == null/);
  });
});
