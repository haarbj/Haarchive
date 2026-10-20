import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see vitest.config.ts's node environment) verifying the roster
// dashboard's own batching discipline and that it reuses the shared
// planned-vs-completed/RPE modules rather than reimplementing them. The
// actual aggregation/attention/sort math is covered by
// tests/lib/private-coaching/roster-row.test.ts; this file is about
// wiring and the "no N+1" performance requirement specifically.

const ROSTER_ROOT = join(__dirname, "../../src/app/(app)/(protected)/coaching/roster");
const ROSTER_DATA = readFileSync(join(ROSTER_ROOT, "roster-data.ts"), "utf8");
const ROSTER_TABLE = readFileSync(join(ROSTER_ROOT, "roster-table.tsx"), "utf8");
const ROSTER_PAGE = readFileSync(join(ROSTER_ROOT, "page.tsx"), "utf8");
const ROSTER_ROW = readFileSync(join(__dirname, "../../src/lib/private-coaching/roster-row.ts"), "utf8");

describe("batched queries, not one per athlete", () => {
  it("every per-athlete table is fetched with a single .in(...) call, not a loop", () => {
    expect(ROSTER_DATA).toMatch(/\.from\("profiles"\)[\s\S]{0,60}\.in\("id", athleteIds\)/);
    expect(ROSTER_DATA).toMatch(/\.from\("training_phases"\)[\s\S]{0,300}\.in\("athlete_id", athleteIds\)/);
    expect(ROSTER_DATA).toMatch(/\.from\("scheduled_workouts"\)[\s\S]{0,300}\.in\("athlete_id", athleteIds\)/);
    expect(ROSTER_DATA).toMatch(/\.from\("completed_workouts"\)[\s\S]{0,300}\.in\("athlete_id", athleteIds\)/);
    expect(ROSTER_DATA).toMatch(/\.from\("weekly_checkins"\)[\s\S]{0,120}\.in\("user_id", athleteIds\)/);
    expect(ROSTER_DATA).toMatch(/\.from\("goals"\)[\s\S]{0,300}\.in\("user_id", athleteIds\)/);
  });

  it("all six roster-wide queries are fired together in one Promise.all, not sequentially awaited one by one", () => {
    expect(ROSTER_DATA).toMatch(/await Promise\.all\(/);
  });

  it("training_programs (the second-wave lookup) is also a single batched .in(...), keyed off every distinct program id found across the whole roster's phases", () => {
    expect(ROSTER_DATA).toMatch(/\.from\("training_programs"\)[\s\S]{0,40}\.in\("id", programIds\)/);
    expect(ROSTER_DATA).toContain("new Set((phaseRows ?? []).map((p) => p.source_program_id)");
  });

  it("the final per-relationship reduction is a synchronous .map() over already-fetched data -- no `await supabase` call appears inside it, which would be the N+1 this task explicitly rules out", () => {
    const mapStart = ROSTER_DATA.indexOf("return relationships.map((rel)");
    expect(mapStart).toBeGreaterThan(-1);
    const mapBody = ROSTER_DATA.slice(mapStart);
    expect(mapBody).not.toContain("await supabase");
    expect(mapBody).not.toContain("await createClient");
  });
});

describe("reuses the shared modules, doesn't duplicate their math", () => {
  it("roster-row.ts calls isRpeNoteworthy, not a reimplemented RPE threshold", () => {
    expect(ROSTER_ROW).toContain('from "./completion-comparison"');
    expect(ROSTER_ROW).toContain("isRpeNoteworthy(");
  });

  it("roster-data.ts calls computeWeeklyLoad for the this-week distance figures, not a hand-rolled sum", () => {
    expect(ROSTER_DATA).toContain('from "@/lib/private-coaching/weekly-load"');
    expect(ROSTER_DATA).toContain("computeWeeklyLoad(");
  });

  it("roster-data.ts reuses pickClosestActiveGoal (extracted from goal-race.ts) rather than re-deriving the 'closest active goal' tie-break", () => {
    expect(ROSTER_DATA).toContain('from "@/lib/private-coaching/goal-race"');
    expect(ROSTER_DATA).toContain("pickClosestActiveGoal(");
  });

  it("roster-row.ts reuses getPhaseForWeek/weekPositionInPhase for program/phase/week, not new date-range logic", () => {
    expect(ROSTER_ROW).toContain('from "./training-phases"');
    expect(ROSTER_ROW).toContain("getPhaseForWeek(");
    expect(ROSTER_ROW).toContain("weekPositionInPhase(");
  });
});

describe("the page renders the new table in place, no separate dashboard route", () => {
  it("page.tsx calls loadRosterRows and renders RosterTable", () => {
    expect(ROSTER_PAGE).toContain("loadRosterRows(session.userId)");
    expect(ROSTER_PAGE).toContain("<RosterTable rows={rosterRows} />");
  });

  it("the empty-roster state still renders a plain invite prompt, not an error", () => {
    expect(ROSTER_PAGE).toContain("No athletes yet -- invite one above.");
  });
});

describe("view + navigate only -- no messaging/contact action added to the roster row", () => {
  it("the row links to the athlete's schedule and keeps the existing remove-athlete action, nothing new added", () => {
    expect(ROSTER_TABLE).toContain('href={`/coaching/athletes/${row.athleteId}/schedule`}');
    expect(ROSTER_TABLE).toContain("RemoveAthleteButton");
    expect(ROSTER_TABLE.toLowerCase()).not.toMatch(/message|email button|contact/);
  });

  it("sorting is client-side over the already-loaded rows -- no router/fetch call on sort change", () => {
    expect(ROSTER_TABLE).toContain('"use client"');
    expect(ROSTER_TABLE).toContain("sortRosterRows(rows, sortKey)");
    expect(ROSTER_TABLE).not.toMatch(/router\.push|router\.refresh|fetch\(/);
  });
});

describe("no compliance scores or athlete rankings", () => {
  // "grade"/"score" appear once in roster-row.ts's own explanatory
  // comment ("none of them grade, score, ... language") -- the negation
  // itself is the point, not a violation of it, so that one mention is
  // excluded rather than this check being dropped entirely.
  it("neither the table nor the data loader mentions a score, grade, rank, or compliance percentage", () => {
    for (const source of [ROSTER_TABLE, ROSTER_DATA]) {
      expect(source.toLowerCase()).not.toMatch(/compliance|\bscore\b|\brank(ing)?\b|\bgrade\b/);
    }
  });

  it("roster-row.ts itself has no scoring/ranking logic -- only the one explanatory comment naming what this deliberately isn't", () => {
    const withoutComments = ROSTER_ROW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(withoutComments.toLowerCase()).not.toMatch(/compliance|\bscore\b|\brank(ing)?\b|\bgrade\b/);
  });
});
