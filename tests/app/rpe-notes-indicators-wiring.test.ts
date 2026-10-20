import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see vitest.config.ts's node environment, and the existing
// Timeline/planned-vs-completed wiring tests for the same technique)
// verifying every tile surface wires in the shared RPE/notes feedback
// (completion-comparison.ts's describeRpe/isRpeNoteworthy/
// formatRpeDisplay) rather than reimplementing it, and -- the one thing
// this feature explicitly must never do -- that a note's own TEXT never
// reaches a tile's markup, only a boolean has-notes indicator. The
// comparison math itself is covered by completion-comparison.test.ts and
// the Timeline-specific branch by timeline-helpers.test.ts; this file is
// about wiring and the notes-text-stays-off-tiles guarantee.

const SCHEDULE_ROOT = join(__dirname, "../../src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule");
const PLAN_ROOT = join(__dirname, "../../src/app/(app)/(protected)/plan");

function read(root: string, file: string): string {
  return readFileSync(join(root, file), "utf8");
}

const WORKOUT_CARD = read(SCHEDULE_ROOT, "workout-card.tsx");
const MONTH_VIEW = read(SCHEDULE_ROOT, "month-view.tsx");
const TIMELINE_VIEW = read(SCHEDULE_ROOT, "timeline-view.tsx");
const TIMELINE_HELPERS = read(SCHEDULE_ROOT, "timeline-helpers.ts");
const COACH_TIMELINE_VIEW = read(SCHEDULE_ROOT, "coach-timeline-view.tsx");
const CALENDAR_DATA = read(SCHEDULE_ROOT, "calendar-data.ts");
const CALENDAR_TYPES = read(SCHEDULE_ROOT, "calendar-types.ts");
const PLAN_WORKOUT_CARD = read(PLAN_ROOT, "workout-card.tsx");
const PLAN_TIMELINE_VIEW = read(PLAN_ROOT, "plan-timeline-view.tsx");
const WORKOUT_DETAIL = readFileSync(
  join(__dirname, "../../src/app/(app)/(protected)/coaching/workouts/[workoutId]/page.tsx"),
  "utf8",
);
const COMPLETION_COMPARISON = readFileSync(join(__dirname, "../../src/lib/private-coaching/completion-comparison.ts"), "utf8");

describe("every tile surface imports the shared RPE/notes helpers, not a reimplementation", () => {
  it("Timeline's shared buildTimelineTileFigures (covers both coach and athlete Timeline)", () => {
    expect(TIMELINE_HELPERS).toContain("describeRpe");
    expect(TIMELINE_HELPERS).toContain("isRpeNoteworthy");
  });
  it("coach WorkoutCard (Week/Day)", () => {
    expect(WORKOUT_CARD).toContain("describeRpe");
    expect(WORKOUT_CARD).toContain("isRpeNoteworthy");
  });
  it("Month View", () => {
    expect(MONTH_VIEW).toContain("describeRpe");
    expect(MONTH_VIEW).toContain("isRpeNoteworthy");
  });
  it("the self-serve /plan WorkoutCard (emphasis ring only -- CompletionSummary already shows RPE/notes text plainly there)", () => {
    expect(PLAN_WORKOUT_CARD).toContain("isRpeNoteworthy");
  });
  it("the self-serve Timeline tile (plan-timeline-view.tsx's collapsed 'self' entry, before expand)", () => {
    expect(PLAN_TIMELINE_VIEW).toContain("describeRpe");
    expect(PLAN_TIMELINE_VIEW).toContain("isRpeNoteworthy");
  });
  it("the workout detail page's RPE pairing line", () => {
    expect(WORKOUT_DETAIL).toContain("describeRpe");
  });
});

describe("a note's own text never reaches a tile -- indicator only, exactly per the data-honesty rule", () => {
  it("calendar-types.ts's completion type carries hasNotes (a boolean), never the note text itself", () => {
    expect(CALENDAR_TYPES).toContain("hasNotes: boolean;");
    expect(CALENDAR_TYPES).not.toMatch(/notes:\s*string \| null;/);
  });

  it("calendar-data.ts computes hasNotes as a boolean at the server boundary, never passing athlete_notes' raw text into the CalendarWorkout view-model", () => {
    expect(CALENDAR_DATA).toMatch(/hasNotes:\s*!!completion\.athlete_notes\?\.trim\(\)/);
    // The raw column is read (to compute the boolean) but never assigned
    // directly onto the completion object the UI receives.
    expect(CALENDAR_DATA).not.toMatch(/athleteNotes:\s*completion\.athlete_notes/);
  });

  it("none of the coach-side tile-rendering files ever reference a completion's note text at all -- the raw text never even reaches their view-model (see calendar-data.ts's server-side hasNotes computation)", () => {
    for (const source of [WORKOUT_CARD, MONTH_VIEW, TIMELINE_VIEW, TIMELINE_HELPERS, COACH_TIMELINE_VIEW]) {
      expect(source).not.toMatch(/completion\.notes\b/);
      expect(source).not.toMatch(/completion\?\.notes\b/);
      expect(source).not.toMatch(/athlete_notes/);
      expect(source).not.toMatch(/athleteNotes/);
    }
  });

  it("the self-serve Timeline adapter's own hasNotes is a boolean coercion of the note, never the text itself rendered as a tile's children", () => {
    // Unlike the coach side, self-serve's CompletionDetail (already
    // fetched for WorkoutCard's own full CompletionSummary once expanded)
    // genuinely contains the note text in this client component -- there
    // is no separate server-side boolean to read instead. The invariant
    // that matters is that this expression only ever produces a boolean,
    // and is never itself handed to JSX as rendered text.
    expect(PLAN_TIMELINE_VIEW).toMatch(/hasNotes: !!completion\?\.notes\?\.trim\(\)/);
    expect(PLAN_TIMELINE_VIEW).not.toMatch(/\{completion\?\.notes\}/);
    expect(PLAN_TIMELINE_VIEW).not.toMatch(/\{completion\.notes\}/);
  });

  it("every tile that shows the notes indicator uses the MessageSquare icon, not rendered text", () => {
    for (const source of [WORKOUT_CARD, MONTH_VIEW, TIMELINE_VIEW]) {
      expect(source).toContain("MessageSquare");
      expect(source).toContain('aria-label="Has a note"');
    }
  });
});

describe("Missed/emphasis and the RPE indicator stay neutral -- no grading, scoring, or compliance language", () => {
  it("completion-comparison.ts's RPE functions carry no pass/fail or scoring language", () => {
    // "grade" is deliberately excluded: every mention in this file is its
    // own explanatory comment that a delta is "never a grade" -- the
    // negation itself is the point, not a violation of it.
    expect(COMPLETION_COMPARISON.toLowerCase()).not.toMatch(/compliance|score|streak/);
  });

  it("the emphasis ring reuses the neutral accent-tip token, not a red/warning/error one, on every surface that renders it", () => {
    for (const source of [WORKOUT_CARD, MONTH_VIEW, TIMELINE_VIEW, PLAN_WORKOUT_CARD]) {
      expect(source).toMatch(/ring-accent-tip\/40/);
      expect(source).not.toMatch(/ring-accent-error|ring-red/);
    }
  });
});

describe("the workout detail page shows the pairing only when prescribed and logged differ meaningfully", () => {
  it("renders the RPE line only for rpeDisplay.kind === 'pair', same rule as every tile (CompletionSummary already shows a lone logged value)", () => {
    expect(WORKOUT_DETAIL).toMatch(/rpeDisplay && rpeDisplay\.kind === "pair"/);
  });

  it("formats it with the exact same shared formatRpeDisplay helper tiles use, so the numbers can't drift from what a tile showed", () => {
    expect(WORKOUT_DETAIL).toContain("formatRpeDisplay(rpeDisplay)");
  });
});

describe("Strava-matched completions never show feedback indicators -- Strava has no RPE/notes to supply", () => {
  it("calendar-data.ts's completed_workouts select includes rpe/athlete_notes/effort_level alongside the existing actuals -- so a Strava-only row (those columns genuinely null) honestly produces no indicators, not a fabricated gap", () => {
    expect(CALENDAR_DATA).toMatch(/select\("scheduled_workout_id, actual_distance_m, actual_duration_s, strava_activity_id, rpe, athlete_notes, effort_level"\)/);
  });
});
