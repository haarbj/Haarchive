import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see vitest.config.ts's node environment and the coach route's
// own timeline-wiring.test.ts, which uses the same technique) covering
// the athlete-facing /plan route's Timeline wiring: that it genuinely
// reuses the coach route's shared TimelineView/timeline-helpers rather
// than forking them, that it surfaces both self-created and
// coach-assigned workouts (the regression this guards against is the
// bd0fc8b bug, where /plan's own Week view only ever queried self-created
// ones), and that Week stays the unchanged default.

const PLAN_ROOT = join(__dirname, "../../../src/app/(app)/(protected)/plan");
const SCHEDULE_ROOT = join(__dirname, "../../../src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule");

const PLAN_VIEW_SOURCE = readFileSync(join(PLAN_ROOT, "plan-view.tsx"), "utf8");
const PLAN_PAGE_SOURCE = readFileSync(join(PLAN_ROOT, "page.tsx"), "utf8");
const PLAN_TIMELINE_VIEW_SOURCE = readFileSync(join(PLAN_ROOT, "plan-timeline-view.tsx"), "utf8");
const PLAN_TIMELINE_ACTIONS_SOURCE = readFileSync(join(PLAN_ROOT, "timeline-actions.ts"), "utf8");
const SHARED_TIMELINE_VIEW_SOURCE = readFileSync(join(SCHEDULE_ROOT, "timeline-view.tsx"), "utf8");
const COACH_TIMELINE_VIEW_SOURCE = readFileSync(join(SCHEDULE_ROOT, "coach-timeline-view.tsx"), "utf8");

describe("1. the athlete route reuses the shared Timeline component, not a fork", () => {
  it("plan-timeline-view.tsx imports TimelineView from the coach route's shared file", () => {
    expect(PLAN_TIMELINE_VIEW_SOURCE).toMatch(
      /from "@\/app\/\(app\)\/\(protected\)\/coaching\/athletes\/\[athleteId\]\/schedule\/timeline-view"/,
    );
  });

  it("the coach route's own adapter imports the exact same shared file (same path), confirming one source, not two parallel copies", () => {
    expect(COACH_TIMELINE_VIEW_SOURCE).toContain('from "./timeline-view"');
  });

  it("there is exactly one `export function TimelineView` definition anywhere under src/app -- the shared component, never duplicated per route", () => {
    const appRoot = join(__dirname, "../../../src/app");
    let matches = 0;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "timeline-view.tsx") {
          const src = readFileSync(full, "utf8");
          if (/export function TimelineView</.test(src)) matches += 1;
        }
      }
    };
    walk(appRoot);
    expect(matches).toBe(1);
  });

  it("plan-timeline-view.tsx does not reimplement sticky headers, the IntersectionObserver scroll machinery, or the date-input picker itself -- those come from the shared component it delegates to, which is what guarantees identical behavior rather than a separately-maintained lookalike", () => {
    expect(PLAN_TIMELINE_VIEW_SOURCE).not.toContain("IntersectionObserver");
    expect(PLAN_TIMELINE_VIEW_SOURCE).not.toMatch(/sticky top-0/);
    expect(PLAN_TIMELINE_VIEW_SOURCE).not.toMatch(/type="date"/);
  });

  it("the shared TimelineView's own sticky header, date picker, and IntersectionObserver scroll-loading are still present and untouched by this change", () => {
    expect(SHARED_TIMELINE_VIEW_SOURCE).toMatch(/sticky top-0[^"]*"/);
    expect(SHARED_TIMELINE_VIEW_SOURCE).toContain("IntersectionObserver");
    expect(SHARED_TIMELINE_VIEW_SOURCE).toMatch(/type="date"/);
  });

  it("the shared component's dense tile shows distance, duration, and effort text -- the same three figures on both routes, since both routes feed the same TimelineEntryView shape", () => {
    expect(SHARED_TIMELINE_VIEW_SOURCE).toContain("entry.distanceText");
    expect(SHARED_TIMELINE_VIEW_SOURCE).toContain("entry.durationText");
    expect(SHARED_TIMELINE_VIEW_SOURCE).toContain("entry.effortText");
  });
});

describe("2. the athlete Timeline surfaces both assigned and self-created workouts (regression guard for bd0fc8b)", () => {
  it("plan-timeline-view.tsx's normalizeEntry branches on both entry.source values -- 'assigned' and the self-created case -- not just one", () => {
    expect(PLAN_TIMELINE_VIEW_SOURCE).toContain('entry.source === "assigned"');
    // The else branch (no further `if`) is the self-created case -- see
    // timeline-actions.ts's own AthleteTimelineEntry union, which has
    // exactly these two members.
    expect(PLAN_TIMELINE_VIEW_SOURCE).toMatch(/const \{ workout, completion, phase \} = entry;/);
  });

  it("an assigned entry's tile links straight to /coaching/workouts/[id] -- the same destination a workout_assigned notification and plan-view.tsx's own Week-view AssignedWorkoutRow already use, not a Timeline-only reimplementation of completing it", () => {
    expect(PLAN_TIMELINE_VIEW_SOURCE).toMatch(/href: `\/coaching\/workouts\/\$\{workout\.id\}`/);
    expect(PLAN_VIEW_SOURCE).toMatch(/href=\{`\/coaching\/workouts\/\$\{workout\.id\}`\}/);
  });

  it("a self-created entry's tile expands into the existing WorkoutCard -- the same complete-workout form Week View already renders, reused rather than rebuilt", () => {
    expect(PLAN_TIMELINE_VIEW_SOURCE).toContain('import { WorkoutCard } from "./workout-card"');
    expect(PLAN_TIMELINE_VIEW_SOURCE).toMatch(/kind: "expand"/);
    expect(PLAN_TIMELINE_VIEW_SOURCE).toMatch(/<WorkoutCard/);
  });

  it("timeline-actions.ts (the athlete route's own loader) queries both the self-serve workouts table and coach-assigned workouts via fetchCalendarWorkouts/getActiveCoachRelationship -- the exact two sources plan-view.tsx's own Week view reads, not a narrower one", () => {
    expect(PLAN_TIMELINE_ACTIONS_SOURCE).toContain('.from("workouts")');
    expect(PLAN_TIMELINE_ACTIONS_SOURCE).toContain("fetchCalendarWorkouts");
    expect(PLAN_TIMELINE_ACTIONS_SOURCE).toContain("getActiveCoachRelationship");
  });

  it("an unpublished coach draft is filtered out before it reaches the athlete, same rule plan-view.tsx's own publishedAssignedWorkoutsThisWeek enforces for Week View", () => {
    expect(PLAN_TIMELINE_ACTIONS_SOURCE).toMatch(/status !== "draft"/);
  });
});

describe("3. Week stays the default view; Timeline is additive, never offered to a coach viewing someone else's plan", () => {
  it("plan/page.tsx reads ?view= and defaults to week when absent or unrecognized", () => {
    expect(PLAN_PAGE_SOURCE).toMatch(/view = sp\.view === "timeline" \? "timeline" : "week"/);
  });

  it("plan-view.tsx forces Week for coachView regardless of the view prop -- Timeline is athlete-only", () => {
    expect(PLAN_VIEW_SOURCE).toMatch(/!coachView && view === "timeline"/);
  });

  it("the Week/Timeline switcher nav is only rendered for the athlete's own view, not coachView", () => {
    expect(PLAN_VIEW_SOURCE).toMatch(/\{!coachView && \(\s*<nav/);
  });

  it("the switcher offers exactly week and timeline, not a reproduction of the coach route's five-view list", () => {
    expect(PLAN_VIEW_SOURCE).toMatch(/\(\["week", "timeline"\] as const\)/);
  });
});

describe("4. Weekly Load reflects assigned + self-created totals (see self-serve-weekly-load.test.ts for the actual computation correctness)", () => {
  it("plan-view.tsx combines weeklyLoadEntriesFromSelfServeWorkouts with weeklyLoadEntriesFromAssignedWorkouts into one computeWeeklyLoad call", () => {
    expect(PLAN_VIEW_SOURCE).toContain("weeklyLoadEntriesFromSelfServeWorkouts(workouts");
    expect(PLAN_VIEW_SOURCE).toContain("weeklyLoadEntriesFromAssignedWorkouts(assignedWorkouts)");
    expect(PLAN_VIEW_SOURCE).toMatch(/computeWeeklyLoad\(weeklyLoadEntries, null, today\)/);
  });
});
