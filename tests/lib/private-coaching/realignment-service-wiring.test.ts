import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness, and no
// Supabase-touching-loader test harness, exists in this repo -- see
// vitest.config.ts's node environment and every other *-actions.ts file's
// own lack of direct tests) verifying the consent-flow contracts the
// pure engine itself can't prove on its own: that nothing on
// scheduled_workouts changes before Accept, that Dismiss never writes to
// scheduled_workouts at all, that Accept always forces a draft (so the
// athlete can't see a realigned workout before the coach separately
// publishes it), and that Edit's inline inputs are local state only.

const REALIGNMENT_SERVICE = readFileSync(join(__dirname, "../../../src/lib/private-coaching/realignment-service.ts"), "utf8");
const COACH_REALIGN_ACTIONS = readFileSync(
  join(
    __dirname,
    "../../../src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/realignment-actions.ts",
  ),
  "utf8",
);
const REALIGN_PANEL = readFileSync(
  join(__dirname, "../../../src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/realign-panel.tsx"),
  "utf8",
);
const PLAN_REALIGNMENT_ACTIONS = readFileSync(join(__dirname, "../../../src/app/(app)/(protected)/plan/realignment-actions.ts"), "utf8");

function createFunctionBody(name: string): string {
  const start = REALIGNMENT_SERVICE.indexOf(`export async function ${name}(`);
  expect(start, `could not find export async function ${name}(`).toBeGreaterThan(-1);
  const nextExport = REALIGNMENT_SERVICE.indexOf("\nexport ", start + 1);
  return REALIGNMENT_SERVICE.slice(start, nextExport === -1 ? undefined : nextExport);
}

describe("createOrFindRealignmentProposal never touches scheduled_workouts -- proposing is read-only", () => {
  const body = createFunctionBody("createOrFindRealignmentProposal");

  it("only reads scheduled_workouts (via fetchHorizonWorkouts), never updates or deletes it", () => {
    expect(body).not.toMatch(/scheduled_workouts[\s\S]{0,60}\.update\(/);
    expect(body).not.toMatch(/scheduled_workouts[\s\S]{0,60}\.delete\(/);
  });

  it("checks for an existing dismissed proposal with the same fingerprint before ever inserting a new one -- the 'don't regenerate identically' requirement", () => {
    expect(body).toContain('.eq("status", "dismissed")');
    expect(body).toMatch(/if \(existingDismissed\) \{\s*return \{ row: existingDismissed, alreadyDismissed: true \};/);
  });

  it("the dismissed-lookup runs before the insert -- the insert is unreachable once an identical dismissed proposal is found", () => {
    const dismissedCheckIndex = body.indexOf("existingDismissed");
    const insertIndex = body.indexOf('.insert({');
    expect(dismissedCheckIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(dismissedCheckIndex);
  });
});

describe("dismissRealignmentProposal never writes to scheduled_workouts -- the plan stays byte-identical", () => {
  const body = createFunctionBody("dismissRealignmentProposal");

  it("only updates realignment_proposals' own status, nothing else", () => {
    expect(body).toContain('.from("realignment_proposals")');
    expect(body).not.toContain('.from("scheduled_workouts")');
  });

  it("only dismisses a proposal that is still pending -- can't dismiss one already decided", () => {
    expect(body).toContain('.eq("status", "pending")');
  });
});

describe("acceptRealignmentProposal always forces a draft -- the athlete can't see a realigned workout before a separate publish", () => {
  const body = createFunctionBody("acceptRealignmentProposal");

  it("every applied update sets published_at to null", () => {
    expect(body).toMatch(/published_at:\s*null/);
  });

  it("never calls createNotification -- the existing publish-time notification path is untouched and is the only way the athlete is told", () => {
    // Checks for an actual call (open paren), not just the word -- this
    // file's own comments name createNotification by way of explaining
    // that it's deliberately NOT called here.
    expect(REALIGNMENT_SERVICE).not.toContain("createNotification(");
    expect(REALIGNMENT_SERVICE).not.toMatch(/import.*createNotification/);
  });

  it("only acts on a proposal that is still pending, and marks it accepted afterward", () => {
    expect(body).toContain('.eq("status", "pending")');
    expect(REALIGNMENT_SERVICE).toMatch(/status: "accepted"/);
  });

  it("accepts an overrides map so a coach's edited values are applied instead of the engine's own proposed ones -- 'Edit' changes what Accept writes, not when or whether it writes", () => {
    expect(body).toContain("overrides");
    expect(body).toContain("override?.proposedDate ?? entry.proposedDate");
  });
});

describe("Edit is local state only -- nothing is written until Accept is clicked", () => {
  it("the inline date/distance inputs only call setOverrides, never a server action, on change", () => {
    const editingBlockStart = REALIGN_PANEL.indexOf("isEditing ? (");
    expect(editingBlockStart).toBeGreaterThan(-1);
    const editingBlock = REALIGN_PANEL.slice(editingBlockStart, editingBlockStart + 1500);
    expect(editingBlock).toContain("setOverrides((prev)");
    expect(editingBlock).not.toContain("acceptRealignment(");
    expect(editingBlock).not.toContain("await ");
  });

  it("Accept is the only call site that sends the override map to the server", () => {
    expect(REALIGN_PANEL).toContain("acceptRealignment(athleteId, proposal.id, overrides)");
  });
});

describe("both triggers funnel through the exact same proposal lifecycle, never two separately-maintained copies", () => {
  it("the coach-initiated action and the athlete-flagged action both call createOrFindRealignmentProposal", () => {
    expect(COACH_REALIGN_ACTIONS).toContain("createOrFindRealignmentProposal(");
    expect(PLAN_REALIGNMENT_ACTIONS).toContain("createOrFindRealignmentProposal(");
  });

  it("the coach trigger is tagged triggeredBy: \"coach\"; the athlete trigger is tagged triggeredBy: \"athlete\"", () => {
    expect(COACH_REALIGN_ACTIONS).toMatch(/triggeredBy:\s*"coach"/);
    expect(PLAN_REALIGNMENT_ACTIONS).toMatch(/triggeredBy:\s*"athlete"/);
  });

  it("the athlete-flagged trigger never returns or renders the proposal itself -- only the coach sees it", () => {
    // Checks the TYPE never appears (as an import or an annotation), not
    // the bare substring -- createOrFindRealignmentProposal's own name
    // legitimately contains "RealignmentProposal".
    expect(PLAN_REALIGNMENT_ACTIONS).not.toMatch(/type\s*\{[^}]*\bRealignmentProposal\b/);
    expect(PLAN_REALIGNMENT_ACTIONS).not.toMatch(/:\s*RealignmentProposal\b/);
    expect(PLAN_REALIGNMENT_ACTIONS).toMatch(/Promise<\{ error\?: string \}>/);
  });
});

describe("missed-workout badges alone never trigger realignment -- only an explicit flag or coach action does", () => {
  it("neither trigger action reads roster-row.ts's attention badges or auto-fires from them", () => {
    for (const source of [COACH_REALIGN_ACTIONS, PLAN_REALIGNMENT_ACTIONS]) {
      expect(source).not.toContain("roster-row");
      expect(source).not.toContain("computeRosterAttentionBadges");
    }
  });
});
