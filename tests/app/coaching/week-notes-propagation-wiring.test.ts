import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for week notes failing to reach the athlete on
// most surfaces, and framework (program_phase_weeks.notes) edits never
// reaching an athlete already assigned before the edit. No React render
// harness exists in this repo -- these are source-scan assertions, same
// convention as privately-coached-gate-wiring.test.ts.

const ROOT = join(__dirname, "../../..");
const SCHEDULE_DIR = join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule");
const PROGRAMS_ACTIONS = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/programs/actions.ts"), "utf8");
const SCHEDULE_ACTIONS = readFileSync(join(SCHEDULE_DIR, "actions.ts"), "utf8");
const MONTH_VIEW = readFileSync(join(SCHEDULE_DIR, "month-view.tsx"), "utf8");
const COACH_TIMELINE_VIEW = readFileSync(join(SCHEDULE_DIR, "coach-timeline-view.tsx"), "utf8");
const SCHEDULE_PAGE = readFileSync(join(SCHEDULE_DIR, "page.tsx"), "utf8");
const PLAN_PAYOFF_DATA = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/data.ts"), "utf8");
const PLAN_PAYOFF_VIEW = readFileSync(join(ROOT, "src/components/private-coaching/plan-payoff-view.tsx"), "utf8");
const MIGRATION = readFileSync(
  join(ROOT, "supabase/migrations/20261027010000_private_coaching_training_week_plans_notes_custom.sql"),
  "utf8",
);

describe("Your Plan week section renders the schedule-level week note", () => {
  it("loadPlanPayoffData fetches training_week_plans.notes for weekStart", () => {
    expect(PLAN_PAYOFF_DATA).toMatch(/from\("training_week_plans"\)\s*\.select\("notes"\)/);
    expect(PLAN_PAYOFF_DATA).toContain("weekNotes: weekPlanRow?.notes ?? null");
  });

  it("FirstWeekSection renders data.weekNotes", () => {
    const sectionStart = PLAN_PAYOFF_VIEW.indexOf("function FirstWeekSection");
    expect(sectionStart).toBeGreaterThan(-1);
    const sectionEnd = PLAN_PAYOFF_VIEW.indexOf("\n}", sectionStart);
    expect(PLAN_PAYOFF_VIEW.slice(sectionStart, sectionEnd)).toContain("data.weekNotes");
  });
});

describe("Timeline week headers render the schedule-level week note", () => {
  it("CoachTimelineView's weekMeta renders a per-week note, not just phase/position text", () => {
    expect(COACH_TIMELINE_VIEW).toContain("notesByWeek: Record<string, string>");
    const weekMetaStart = COACH_TIMELINE_VIEW.indexOf("function weekMeta");
    expect(weekMetaStart).toBeGreaterThan(-1);
    const weekMetaEnd = COACH_TIMELINE_VIEW.indexOf("\n  }", weekMetaStart);
    expect(COACH_TIMELINE_VIEW.slice(weekMetaStart, weekMetaEnd)).toContain("notesByWeek[weekStart]");
  });

  it("the schedule page fetches notesByWeek and passes it to CoachTimelineView", () => {
    expect(SCHEDULE_PAGE).toContain('from("training_week_plans")');
    expect(SCHEDULE_PAGE).toContain("notesByWeek={notesByWeek}");
  });
});

describe("Month view WEEK column never contradicts a week that has a note", () => {
  it("shows 'No target set' only when there is also no note", () => {
    const noTargetIdx = MONTH_VIEW.indexOf('"No target set"');
    expect(noTargetIdx).toBeGreaterThan(-1);
    const nearby = MONTH_VIEW.slice(Math.max(0, noTargetIdx - 300), noTargetIdx + 900);
    expect(nearby).toContain("summary.rawNotes");
  });

  it("renders summary.rawNotes directly in the WEEK column", () => {
    expect(MONTH_VIEW).toMatch(/\{summary\.rawNotes\s*\?[\s\S]*?\{summary\.rawNotes\}/);
  });
});

describe("Week View's own existing note rendering is preserved", () => {
  it("WeekPlanEditor still renders initial.notes under the week heading", () => {
    const editor = readFileSync(join(SCHEDULE_DIR, "week-plan-editor.tsx"), "utf8");
    expect(editor).toContain("{initial.notes ? ");
  });
});

describe("Framework week notes propagate to already-assigned athletes", () => {
  it("adds a notes_is_custom column so a direct per-athlete edit can be distinguished from a framework-sourced one", () => {
    expect(MIGRATION).toContain("add column notes_is_custom boolean not null default false");
  });

  it("saveWeekPlan (the direct per-athlete editor) marks the note as custom", () => {
    const fnStart = SCHEDULE_ACTIONS.indexOf("export async function saveWeekPlan");
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = SCHEDULE_ACTIONS.indexOf("\n}", fnStart);
    expect(SCHEDULE_ACTIONS.slice(fnStart, fnEnd)).toContain("notes_is_custom: true");
  });

  it("saveProgramPhaseWeekLabel backfills already-assigned athletes' training_week_plans.notes, skipping custom ones", () => {
    expect(PROGRAMS_ACTIONS).toContain("async function propagateWeekNotesToAssignedAthletes");
    expect(PROGRAMS_ACTIONS).toContain("if (existing.notes_is_custom) continue;");
    // Called from both the delete-the-week-row branch (notes cleared) and
    // the upsert branch (notes set/changed) -- a framework edit must
    // propagate either way, not just when notes go from empty to set.
    const callSites = PROGRAMS_ACTIONS.split("await propagateWeekNotesToAssignedAthletes(").length - 1;
    expect(callSites).toBe(2);
  });

  it("the propagation matches a phase to the program it was generated from via source_program_phase_definition_id", () => {
    const fnStart = PROGRAMS_ACTIONS.indexOf("async function propagateWeekNotesToAssignedAthletes");
    const fnEnd = PROGRAMS_ACTIONS.indexOf("\n}", fnStart);
    const body = PROGRAMS_ACTIONS.slice(fnStart, fnEnd);
    expect(body).toContain('.eq("source_program_phase_definition_id", phaseDefinitionId)');
    expect(body).toContain("addDays(phase.start_date, (weekNumber - 1) * 7)");
  });
});
