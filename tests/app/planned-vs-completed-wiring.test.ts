import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see vitest.config.ts's node environment, and the Timeline
// wiring tests under tests/app/coaching-timeline/ for the same
// technique) verifying that every tile surface actually wires in the
// shared planned-vs-completed comparison (completion-comparison.ts)
// rather than reimplementing it, and that "missed" reads as muted/
// de-emphasized, never alarm-colored, everywhere it appears. The
// comparison math itself is covered by completion-comparison.test.ts
// and the Timeline-specific branch by timeline-helpers.test.ts; this
// file is about wiring, not math.

const SCHEDULE_ROOT = join(__dirname, "../../src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule");
const PLAN_ROOT = join(__dirname, "../../src/app/(app)/(protected)/plan");

function read(root: string, file: string): string {
  return readFileSync(join(root, file), "utf8");
}

const WORKOUT_CARD = read(SCHEDULE_ROOT, "workout-card.tsx");
const MONTH_VIEW = read(SCHEDULE_ROOT, "month-view.tsx");
const TIMELINE_VIEW = read(SCHEDULE_ROOT, "timeline-view.tsx");
const TIMELINE_HELPERS = read(SCHEDULE_ROOT, "timeline-helpers.ts");
const PLAN_WORKOUT_CARD = read(PLAN_ROOT, "workout-card.tsx");
const WEEKLY_LOAD = readFileSync(join(__dirname, "../../src/lib/private-coaching/weekly-load.ts"), "utf8");
const WEEK_CALENDAR = read(SCHEDULE_ROOT, "week-calendar.tsx");
const PLAN_VIEW = read(PLAN_ROOT, "plan-view.tsx");
const WORKOUT_DETAIL = readFileSync(
  join(__dirname, "../../src/app/(app)/(protected)/coaching/workouts/[workoutId]/page.tsx"),
  "utf8",
);

describe("every tile surface imports the shared comparison module, not a reimplementation", () => {
  it("coach WorkoutCard (Week/Day)", () => {
    expect(WORKOUT_CARD).toContain('from "@/lib/private-coaching/completion-comparison"');
  });
  it("Month View", () => {
    expect(MONTH_VIEW).toContain('from "@/lib/private-coaching/completion-comparison"');
  });
  it("Timeline's shared buildTimelineTileFigures (covers both Timeline surfaces)", () => {
    expect(TIMELINE_HELPERS).toContain('from "@/lib/private-coaching/completion-comparison"');
  });
  it("the self-serve /plan WorkoutCard", () => {
    expect(PLAN_WORKOUT_CARD).toContain('from "@/lib/private-coaching/completion-comparison"');
  });
  it("the coach-assigned workout detail page", () => {
    expect(WORKOUT_DETAIL).toContain('from "@/lib/private-coaching/completion-comparison"');
  });
});

describe("Missed reads as muted/de-emphasized, never alarm-colored, on every surface", () => {
  it("coach WorkoutCard: badge tone is neutral, not error/red, and the whole card dims via opacity", () => {
    expect(WORKOUT_CARD).toContain('missed: { label: "Missed", tone: "neutral" }');
    expect(WORKOUT_CARD).not.toContain('missed: { label: "Missed", tone: "error" }');
    expect(WORKOUT_CARD).toMatch(/workout\.status === "missed" \? "opacity-60" : ""/);
  });

  it("Month View's status dot is a hollow ring, not a filled red dot, for missed", () => {
    expect(MONTH_VIEW).toContain('missed: "border border-zinc-400 dark:border-zinc-500"');
    expect(MONTH_VIEW).not.toMatch(/missed: "bg-accent-error"/);
    expect(MONTH_VIEW).toMatch(/w\.status === "missed" \? "opacity-60" : ""/);
  });

  it("Timeline's status dot (shared by both coach and athlete Timeline) is the same hollow ring, and a missed tile dims via opacity", () => {
    expect(TIMELINE_VIEW).toContain('missed: "border border-zinc-400 dark:border-zinc-500"');
    expect(TIMELINE_VIEW).not.toMatch(/missed: "bg-accent-error"/);
    expect(TIMELINE_VIEW).toMatch(/entry\.statusTone === "missed" \? "opacity-60" : ""/);
  });

  it("the self-serve /plan WorkoutCard also dims a missed, never-completed workout", () => {
    // The literal className expression changed shape (joined with the
    // RPE-emphasis ring class by a later task) but still applies
    // opacity-60 whenever isMissed is true -- check the ingredient, not
    // the exact assembled string.
    expect(PLAN_WORKOUT_CARD).toMatch(/isMissed \? "opacity-60" : ""/);
  });

  it("no tile component ever labels a missed workout as 'Failed' -- the badge/label text itself stays plainly descriptive", () => {
    for (const source of [WORKOUT_CARD, MONTH_VIEW, PLAN_WORKOUT_CARD]) {
      expect(source).not.toMatch(/>Failed</);
      expect(source).not.toMatch(/"Failed"/);
    }
  });
});

describe("Week rollups show planned vs completed for distance AND duration, one shared calculation", () => {
  it("weekly-load.ts's WeeklyLoadResult carries real duration totals, not just XT duration", () => {
    expect(WEEKLY_LOAD).toContain("scheduledDurationS: number;");
    expect(WEEKLY_LOAD).toContain("completedDurationS: number;");
  });

  it("formatWeeklyLoadText returns formatted duration text alongside the existing distance text", () => {
    expect(WEEKLY_LOAD).toContain("scheduledDurationText: string | null;");
    expect(WEEKLY_LOAD).toContain("completedDurationText: string | null;");
  });

  it("the coach schedule's week-calendar.tsx footer renders the duration figure next to Scheduled/Completed", () => {
    expect(WEEK_CALENDAR).toContain("scheduledDurationText");
    expect(WEEK_CALENDAR).toContain("completedDurationText");
  });

  it("the athlete /plan week header renders the same duration figure -- one calculation, both surfaces", () => {
    expect(PLAN_VIEW).toContain("scheduledDurationText");
    expect(PLAN_VIEW).toContain("completedDurationText");
  });

  it("/plan combines self-created and assigned entries before the one computeWeeklyLoad call (not two separate rollups)", () => {
    expect(PLAN_VIEW).toMatch(/weeklyLoadEntriesFromSelfServeWorkouts\(workouts/);
    expect(PLAN_VIEW).toMatch(/weeklyLoadEntriesFromAssignedWorkouts\(assignedWorkouts\)/);
    expect(PLAN_VIEW).toMatch(/computeWeeklyLoad\(weeklyLoadEntries, null, today\)/);
  });
});

describe("the workout detail page's planned-vs-actual presentation matches the tile language", () => {
  it("computes the same comparison (compareCompletionToPlan) the tiles use, from the same effective planned volume", () => {
    expect(WORKOUT_DETAIL).toContain("compareCompletionToPlan({");
    expect(WORKOUT_DETAIL).toMatch(/plannedDistanceM: effectiveVolume\.distanceM/);
  });

  it("formats the delta with the exact same shared formatters tiles use (formatDistanceDelta/formatDurationDelta), so the numbers can't drift from what a tile showed", () => {
    expect(WORKOUT_DETAIL).toContain("formatDistanceDelta(completionComparison.distanceDelta");
    expect(WORKOUT_DETAIL).toContain("formatDurationDelta(completionComparison.durationDelta");
  });

  it("only shows the delta line when off-plan -- on-plan stays exactly one clean line (CompletionSummary alone), same rule as every tile", () => {
    expect(WORKOUT_DETAIL).toMatch(/completionComparison && !completionComparison\.onPlan/);
  });
});

describe("no compliance scoring or streak/shame mechanics were introduced", () => {
  // "grade" is deliberately excluded from this check: every mention of it
  // in these files is this task's own explanatory comment explaining that
  // a delta is information, "never a grade" -- the negation itself is the
  // point, not a violation of it.
  it("none of the touched tile files mention a compliance score or a streak mechanic", () => {
    for (const source of [WORKOUT_CARD, MONTH_VIEW, TIMELINE_VIEW, TIMELINE_HELPERS, PLAN_WORKOUT_CARD]) {
      expect(source.toLowerCase()).not.toMatch(/compliance|streak/);
    }
  });
});
