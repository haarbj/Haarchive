import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests for PlanPayoffView's own missing-data states -- no
// render harness exists in this repo (vitest.config.ts's node
// environment), so "every missing-data state renders an inline remedy,
// never a blank section or an error" is verified by confirming each
// branch really exists and really renders something, rather than by
// rendering the component.

const VIEW = readFileSync(join(__dirname, "../../../src/components/private-coaching/plan-payoff-view.tsx"), "utf8");

describe("every missing-data state has an inline remedy, never a dead end", () => {
  it("no goal race: shows an inline add-goal form in athlete mode, a plain note in preview", () => {
    const start = VIEW.indexOf("function GoalRaceHeader");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("!data.goalRace");
    expect(body).toContain("<AddGoalRaceForm");
    expect(body).not.toContain("return null");
  });

  it("no fitness anchor: shows the reused race-result entry form in athlete mode, a plain note in preview", () => {
    const start = VIEW.indexOf("function PaceSection");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("!data.hasFitnessAnchor");
    expect(body).toContain("<RaceResultsSection");
    expect(body).not.toContain("return null");
  });

  it("program assigned but not yet published: shows a plain explanation, not an empty schedule", () => {
    const start = VIEW.indexOf("function ProgramSection");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("!data.programPublished");
    expect(body).toMatch(/hasn.+t published this week/);
  });

  it("no phases scheduled at all: shows a plain explanation, not a blank section -- and the empty state is keyed off phaseStrip, not the Program-only `program` field, so a freehand (non-Program) phase doesn't trip it", () => {
    const start = VIEW.indexOf("function ProgramSection");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("data.phaseStrip.length === 0");
    expect(body).not.toContain("if (!data.program)");
    expect(body).not.toMatch(/if \(data\.phaseStrip\.length === 0\) \{\s*return null/);
  });

  it("a scheduled-but-not-yet-started phase renders an Upcoming tag with its start date, not the Current tag", () => {
    const start = VIEW.indexOf("function ProgramSection");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("phase.isUpcoming");
    expect(body).toMatch(/Upcoming/);
    expect(body).toContain("formatDate(phase.startDate)");
  });

  it("no published workouts this week: shows a plain explanation, never an empty grid with nothing said", () => {
    const start = VIEW.indexOf("function FirstWeekSection");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toContain("data.weekWorkouts.length === 0");
    expect(body).toMatch(/Nothing.+published/);
  });

  it("no pace rows resolved this week even with an anchor: shows a plain explanation, not an empty table", () => {
    const start = VIEW.indexOf("function PaceSection");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    expect(body).toMatch(/don.+t prescribe a named pace/);
  });
});

describe("the single component renders every required section, in order", () => {
  it("PlanPayoffView composes all six sections plus the first-action button", () => {
    const start = VIEW.indexOf("export function PlanPayoffView");
    const body = VIEW.slice(start, VIEW.indexOf("\nfunction ", start + 1));
    const order = ["GoalRaceHeader", "ProgramSection", "PaceSection", "FirstWeekSection", "HowThisWorksSection", "FirstActionSection"];
    let lastIndex = -1;
    for (const name of order) {
      const index = body.indexOf(`<${name}`);
      expect(index, `expected <${name} to appear`).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });
});
