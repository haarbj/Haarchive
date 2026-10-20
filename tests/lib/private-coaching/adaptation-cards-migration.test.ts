import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// No migration-inspection test exists yet for realignment_proposals (the
// table this one mirrors) -- this is the first of its kind in this repo,
// written because the task asks for one. Confirms by static inspection
// (no live database needed) that the new migration is purely additive
// and that cards really are coach-only, with no athlete-facing policy at
// all -- the one way this table's RLS deliberately differs from
// realignment_proposals'.

const MIGRATION = readFileSync(
  join(__dirname, "../../../supabase/migrations/20261020020000_private_coaching_adaptation_cards.sql"),
  "utf8",
);

describe("adaptation_cards migration is additive-only", () => {
  it("creates exactly one new table and touches no existing table", () => {
    expect(MIGRATION).toMatch(/create table public\.adaptation_cards/);
    expect(MIGRATION.match(/create table/g)?.length).toBe(1);
    expect(MIGRATION).not.toContain("alter table public.scheduled_workouts");
    expect(MIGRATION).not.toContain("alter table public.realignment_proposals");
  });

  it("contains no drop/truncate/delete statement anywhere", () => {
    expect(MIGRATION.toLowerCase()).not.toMatch(/\bdrop\s|\btruncate\b|\bdelete\s+from\b/);
  });

  it("enables row level security on the new table", () => {
    expect(MIGRATION).toContain("alter table public.adaptation_cards enable row level security");
  });
});

describe("adaptation_cards RLS is coach-only -- no athlete-facing policy exists", () => {
  it("defines exactly one policy, granted to the coach", () => {
    const policies = MIGRATION.match(/create policy/g) ?? [];
    expect(policies.length).toBe(1);
    expect(MIGRATION).toMatch(/create policy "adaptation_cards_all_as_coach" on public\.adaptation_cards/);
  });

  it("the coach policy checks both coach_id = auth.uid() and coaches_this_athlete, the same ownership shape realignment_proposals uses", () => {
    expect(MIGRATION).toMatch(/coach_id = \(select auth\.uid\(\)\) and public\.coaches_this_athlete\(athlete_id\)/);
  });

  it("no policy references an athlete-facing condition (athlete_id = auth.uid())", () => {
    expect(MIGRATION).not.toMatch(/athlete_id = \(select auth\.uid\(\)\)/);
  });
});

describe("the database itself enforces 'one pending card per (athlete, signal)'", () => {
  it("a partial unique index exists on (athlete_id, signal) where status = 'pending'", () => {
    expect(MIGRATION).toMatch(/create unique index idx_adaptation_cards_one_pending_per_signal[\s\S]*where \(status = 'pending'\)/);
  });
});
