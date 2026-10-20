import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Mirrors plan-payoff-migration.test.ts's / intake-gaps-migration.test.ts's
// own pattern: confirms by static inspection that this migration is purely
// additive -- a single new nullable jsonb column on an existing table.
//
// No new RLS policy is expected or needed: this column lives on the same
// completed_workouts row the table's existing policies already govern --
// completed_workouts_all_own (athlete, full CRUD on their own row) and
// completed_workouts_select_coach (their active coach, read-only) -- both
// defined in 20260825020000_private_coaching_workouts.sql and untouched
// by this migration. A new column on an existing row is visible under
// exactly whatever that row's own policies already allow; there's nothing
// column-specific to add.

const MIGRATION = readFileSync(
  join(__dirname, "../../supabase/migrations/20261020050000_private_coaching_conditions_analysis.sql"),
  "utf8",
);
const WORKOUTS_MIGRATION = readFileSync(
  join(__dirname, "../../supabase/migrations/20260825020000_private_coaching_workouts.sql"),
  "utf8",
);

describe("conditions_analysis migration is additive-only", () => {
  it("adds exactly one new nullable jsonb column to completed_workouts, nothing else", () => {
    expect(MIGRATION).toContain("alter table public.completed_workouts add column conditions_analysis jsonb;");
    expect(MIGRATION.match(/alter table/gi)?.length).toBe(1);
    expect(MIGRATION).not.toMatch(/not null/i);
  });

  it("contains no drop/truncate/delete, no new table, no new policy", () => {
    expect(MIGRATION.toLowerCase()).not.toMatch(/\bdrop\s|\btruncate\b|\bdelete\s+from\b/);
    expect(MIGRATION).not.toContain("create table");
    expect(MIGRATION).not.toContain("create policy");
  });
});

describe("the existing completed_workouts RLS already covers the new column -- athlete + their coach, nothing else", () => {
  it("completed_workouts_all_own grants the athlete full CRUD on their own row", () => {
    expect(WORKOUTS_MIGRATION).toMatch(/create policy "completed_workouts_all_own" on public\.completed_workouts/);
    expect(WORKOUTS_MIGRATION).toMatch(/using \(\(select auth\.uid\(\)\) = athlete_id\)/);
  });

  it("completed_workouts_select_coach grants only their active coach read access", () => {
    expect(WORKOUTS_MIGRATION).toMatch(/create policy "completed_workouts_select_coach" on public\.completed_workouts\s*\n\s*for select to authenticated using \(public\.coaches_this_athlete\(athlete_id\)\)/);
  });

  it("no other role has any policy on completed_workouts", () => {
    const policyNames = [...WORKOUTS_MIGRATION.matchAll(/create policy "([^"]+)" on public\.completed_workouts/g)].map((m) => m[1]);
    expect(policyNames.sort()).toEqual(["completed_workouts_all_own", "completed_workouts_select_coach"]);
  });
});
