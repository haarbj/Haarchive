import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Mirrors adaptation-cards-migration.test.ts's own pattern: confirms by
// static inspection that this migration is purely additive -- a single
// new nullable column on profiles, no RLS change needed (profiles'
// existing self-update policy already covers it, per coach_trains_self's
// own precedent).

const MIGRATION = readFileSync(
  join(__dirname, "../../../supabase/migrations/20261020030000_private_coaching_plan_payoff_dismissal.sql"),
  "utf8",
);

describe("plan_payoff_dismissed_at migration is additive-only", () => {
  it("adds exactly one new nullable column, nothing else", () => {
    expect(MIGRATION).toMatch(/alter table public\.profiles add column plan_payoff_dismissed_at timestamptz;/);
    expect(MIGRATION).not.toMatch(/not null/i);
    expect(MIGRATION).not.toMatch(/\bdrop\s|\btruncate\b|\bdelete\s+from\b/i);
    expect(MIGRATION.match(/alter table/gi)?.length).toBe(1);
  });

  it("creates no new table and no new RLS policy", () => {
    expect(MIGRATION).not.toContain("create table");
    expect(MIGRATION).not.toContain("create policy");
  });
});
