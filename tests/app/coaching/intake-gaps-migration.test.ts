import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Mirrors plan-payoff-migration.test.ts's own pattern: confirms by
// static inspection that this migration is purely additive -- four new
// nullable columns on an existing table, nothing else. No RLS change
// needed (athlete_profiles' existing self-update policy already covers
// the new columns the same way it covers every existing one).

const MIGRATION = readFileSync(
  join(__dirname, "../../../supabase/migrations/20261020040000_private_coaching_intake_gap_fields.sql"),
  "utf8",
);

describe("intake gap-check migration is additive-only", () => {
  it("adds exactly four new nullable columns to athlete_profiles, nothing else", () => {
    expect(MIGRATION).toContain("alter table public.athlete_profiles");
    expect(MIGRATION).toContain("add column training_facilities text[]");
    expect(MIGRATION).toContain("add column recent_training_detail text");
    expect(MIGRATION).toContain("add column long_run_day text");
    expect(MIGRATION).toContain("add column blackout_days text[]");
    expect(MIGRATION.match(/alter table/gi)?.length).toBe(1);
  });

  it("no column is declared not null, and nothing is dropped or truncated", () => {
    expect(MIGRATION).not.toMatch(/not null/i);
    expect(MIGRATION).not.toMatch(/\bdrop\s|\btruncate\b|\bdelete\s+from\b/i);
  });

  it("creates no new table and no new RLS policy", () => {
    expect(MIGRATION).not.toContain("create table");
    expect(MIGRATION).not.toContain("create policy");
  });
});
