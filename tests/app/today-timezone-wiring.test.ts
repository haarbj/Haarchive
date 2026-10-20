import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see vitest.config.ts's node environment, and the Timeline
// wiring tests under tests/app/coaching-timeline/ for the same
// technique) verifying every schedule/calendar surface that highlights
// "Today," defaults to today, or anchors "this week"/"this month" off
// today resolves it through the one shared helper (todayForViewer on the
// server, todayInTimeZone + the browser's own Intl zone on the client) --
// never a bare `new Date().toISOString().slice(0, 10)` or
// `mostRecentMonday(new Date())`, which resolve in UTC/the server's own
// clock regardless of who's actually looking at the page.

const SCHEDULE_ROOT = join(__dirname, "../../src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule");
const PLAN_ROOT = join(__dirname, "../../src/app/(app)/(protected)/plan");

function read(root: string, file: string): string {
  return readFileSync(join(root, file), "utf8");
}

const PAGE = read(SCHEDULE_ROOT, "page.tsx");
const COACH_TIMELINE_ACTIONS = read(SCHEDULE_ROOT, "timeline-actions.ts");
const PHASE_VIEW = read(SCHEDULE_ROOT, "phase-view.tsx");
const PLAN_HEALTH_PANEL = read(SCHEDULE_ROOT, "plan-health-panel.tsx");
const DATE_RANGE_PICKER = read(SCHEDULE_ROOT, "date-range-picker.tsx");
const ASSIGN_PROGRAM_ACTIONS = read(SCHEDULE_ROOT, "assign-program-actions.ts");
const PLAN_VIEW = read(PLAN_ROOT, "plan-view.tsx");
const ATHLETE_TIMELINE_ACTIONS = read(PLAN_ROOT, "timeline-actions.ts");
const TEAM_SCHEDULE_VIEW = read(PLAN_ROOT, "team-schedule-view.tsx");
const PLAN_ACTIONS = read(PLAN_ROOT, "actions.ts");
const WEEK_LIB = readFileSync(join(__dirname, "../../src/lib/week.ts"), "utf8");
const VIEWER_TZ_LIB = readFileSync(join(__dirname, "../../src/lib/viewer-timezone.ts"), "utf8");
const LAYOUT = readFileSync(join(__dirname, "../../src/app/layout.tsx"), "utf8");

const UTC_TODAY_PATTERN = /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/;
const BARE_MOST_RECENT_MONDAY_PATTERN = /mostRecentMonday\(new Date\(\)\)/;

describe("the shared helper exists and is what every in-scope file imports", () => {
  it("week.ts exports todayInTimeZone and resolveViewerTimeZone", () => {
    expect(WEEK_LIB).toContain("export function todayInTimeZone(");
    expect(WEEK_LIB).toContain("export function resolveViewerTimeZone(");
  });

  it("viewer-timezone.ts reads the viewer's zone from a cookie (server-side) and resolves today through the shared helpers, not its own ad hoc logic", () => {
    expect(VIEWER_TZ_LIB).toContain("cookies()");
    expect(VIEWER_TZ_LIB).toContain("resolveViewerTimeZone(");
    expect(VIEWER_TZ_LIB).toContain("export async function getViewerTimeZone(");
  });

  it("layout.tsx's bootstrap script reports the browser's real Intl timezone into the same cookie viewer-timezone.ts reads", () => {
    expect(LAYOUT).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone");
    expect(LAYOUT).toMatch(/document\.cookie="haarchive-tz="/);
  });
});

describe("coach schedule page.tsx (Week/Day/Month/Phase/Timeline's shared origin)", () => {
  it("computes today via todayForViewer, not the server's UTC clock", () => {
    expect(PAGE).toContain("await todayForViewer()");
    expect(PAGE).not.toMatch(UTC_TODAY_PATTERN);
  });

  it("the Week view's 'back to this week' link derives from that same today, not a second independent new Date()", () => {
    expect(PAGE).not.toMatch(BARE_MOST_RECENT_MONDAY_PATTERN);
    expect(PAGE).toMatch(/mostRecentMonday\(new Date\(`\$\{today\}T00:00:00Z`\)\)/);
  });
});

describe("both Timeline surfaces' own data loaders resolve today the same way", () => {
  it("the coach route's loadTimelineWeeks uses todayForViewer", () => {
    expect(COACH_TIMELINE_ACTIONS).toContain("await todayForViewer()");
    expect(COACH_TIMELINE_ACTIONS).not.toMatch(UTC_TODAY_PATTERN);
  });

  it("the athlete route's loadAthleteTimelineWeeks (/plan) uses todayForViewer", () => {
    expect(ATHLETE_TIMELINE_ACTIONS).toContain("await todayForViewer()");
    expect(ATHLETE_TIMELINE_ACTIONS).not.toMatch(UTC_TODAY_PATTERN);
  });
});

describe("/plan's own Week view and plan generation", () => {
  it("plan-view.tsx's current-week anchor uses todayForViewer", () => {
    expect(PLAN_VIEW).toContain("await todayForViewer()");
    expect(PLAN_VIEW).not.toMatch(UTC_TODAY_PATTERN);
  });

  it("team-schedule-view.tsx's today and its +/- day window both derive from todayForViewer, via addDays rather than three independent new Date() snapshots", () => {
    expect(TEAM_SCHEDULE_VIEW).toContain("await todayForViewer()");
    expect(TEAM_SCHEDULE_VIEW).toMatch(/addDays\(today, -2\)/);
    expect(TEAM_SCHEDULE_VIEW).toMatch(/addDays\(today, 12\)/);
    expect(TEAM_SCHEDULE_VIEW).not.toMatch(UTC_TODAY_PATTERN);
  });

  it("generatePlan (actions.ts) anchors a brand-new plan's start on todayForViewer, not the server's UTC today -- the same 'current week anchoring' bug one level up", () => {
    expect(PLAN_ACTIONS).toContain("today: await todayForViewer()");
  });
});

describe("Phase View's goal-race 'weeks away' label (client component)", () => {
  it("resolves today via the browser's own Intl timezone, not a bare new Date()", () => {
    expect(PHASE_VIEW).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone");
    expect(PHASE_VIEW).not.toMatch(BARE_MOST_RECENT_MONDAY_PATTERN);
  });
});

describe("plan-health-panel.tsx's 'days until' countdown (client component)", () => {
  it("resolves today via the browser's own Intl timezone, not a bare new Date()", () => {
    expect(PLAN_HEALTH_PANEL).toContain("todayInTimeZone(viewerTz)");
    expect(PLAN_HEALTH_PANEL).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone");
    expect(PLAN_HEALTH_PANEL).not.toMatch(UTC_TODAY_PATTERN);
  });
});

describe("date-range-picker.tsx's Today ring highlight and default month (client component)", () => {
  it("both resolve via the browser's own Intl timezone, not a bare new Date()", () => {
    expect(DATE_RANGE_PICKER).toContain("todayInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)");
    expect(DATE_RANGE_PICKER).not.toMatch(UTC_TODAY_PATTERN);
  });

  it("the isToday ring comparison itself is untouched -- only how `today` is computed changed, not the highlight logic", () => {
    expect(DATE_RANGE_PICKER).toContain("const isToday = date === today;");
  });
});

describe("assign-program-actions.ts's start-date default", () => {
  it("defaults to todayForViewer when the coach hasn't picked a start date", () => {
    expect(ASSIGN_PROGRAM_ACTIONS).toContain("await todayForViewer()");
    expect(ASSIGN_PROGRAM_ACTIONS).not.toMatch(UTC_TODAY_PATTERN);
  });
});

describe("scope: business-logic analysis files deliberately left untouched", () => {
  it("plan-health-actions.ts and post-race-actions.ts still resolve 'today' independently -- they classify coaching business state (is this estimate stale, has the goal race passed), not a view's Today highlight/default/week-anchor, so they're out of this fix's stated scope", () => {
    const planHealthActions = read(SCHEDULE_ROOT, "plan-health-actions.ts");
    const postRaceActions = read(SCHEDULE_ROOT, "post-race-actions.ts");
    expect(planHealthActions).toMatch(UTC_TODAY_PATTERN);
    expect(postRaceActions).toMatch(UTC_TODAY_PATTERN);
  });
});
