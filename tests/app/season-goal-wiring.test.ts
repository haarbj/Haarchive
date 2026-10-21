import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see today-conditions-wiring.test.ts's own header comment for
// the established pattern). The action's own behavior (set/edit/trim/
// length-cap/view-as refusal) is covered by season-goal-actions.test.ts;
// this file is about where the field appears, where it doesn't, and
// what the migration actually changed.

const ROOT = join(__dirname, "../..");
const HOME_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/page.tsx"), "utf8");
const CARD = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/season-goal-card.tsx"), "utf8");
const ACTIONS = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/season-goal-actions.ts"), "utf8");
const ATHLETE_DETAIL_PAGE = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/page.tsx"),
  "utf8",
);

describe("verbatim rendering", () => {
  it("the athlete's own home renders the SeasonGoalCard with the real stored value, untransformed", () => {
    expect(HOME_PAGE).toContain("<SeasonGoalCard initialValue={athleteProfileRow?.season_goal ?? null} readOnly={readOnly} />");
    expect(HOME_PAGE).toContain('.select("season_goal")');
  });

  it("the card renders the value quoted, with no truncation/transformation beyond the quote marks", () => {
    expect(CARD).toMatch(/&ldquo;\{value\}&rdquo;/);
  });

  it("the coach's athlete-detail page renders the real stored value verbatim, labeled as the athlete's own words", () => {
    expect(ATHLETE_DETAIL_PAGE).toContain("season_goal");
    expect(ATHLETE_DETAIL_PAGE).toContain('In {profile.display_name.split(" ")[0]}&rsquo;s own words');
    expect(ATHLETE_DETAIL_PAGE).toContain("&ldquo;{athleteProfile.season_goal}&rdquo;");
  });

  it("the coach-side block is visually distinct from Active Goals (italic prose, not a structured Card row)", () => {
    const start = ATHLETE_DETAIL_PAGE.indexOf("Season Goal");
    const block = ATHLETE_DETAIL_PAGE.slice(start, start + 600);
    expect(block).toContain("italic");
    expect(block).not.toContain("<Card");
  });
});

describe("empty states", () => {
  it("the athlete's own empty state is an invitation with the one open prompt question, never a template or placeholder answer", () => {
    expect(CARD).toContain('const PROMPT = "What would make this season a success for you?"');
    expect(CARD).toContain("{PROMPT}");
    // The prompt is the only scaffold -- no second suggested phrase anywhere in the file.
    expect(CARD.match(/placeholder=/g)?.length).toBe(1);
  });

  it("the coach's empty state is one neutral line, never a nag or an attention badge", () => {
    expect(ATHLETE_DETAIL_PAGE).toContain("No season goal set yet.");
    const start = ATHLETE_DETAIL_PAGE.indexOf("Season Goal");
    const block = ATHLETE_DETAIL_PAGE.slice(start, start + 600);
    expect(block).not.toContain("Badge");
  });
});

describe("view-as mode: read-only, same rendering as the real athlete view", () => {
  it("AthleteHomeSection passes readOnly through to SeasonGoalCard, and the view-as call site sets it", () => {
    expect(HOME_PAGE).toContain("async function AthleteHomeSection({ userId, readOnly = false }: { userId: string; readOnly?: boolean })");
    expect(HOME_PAGE).toContain("<AthleteHomeSection userId={viewAs.athleteId} readOnly />");
  });

  it("the card hides the edit affordance entirely when readOnly, rather than disabling it", () => {
    expect(CARD).toMatch(/\{!readOnly \? \(/);
  });

  it("even the empty-state prompt text still renders in read-only -- view-as sees exactly what the athlete sees, just without a working control", () => {
    const start = CARD.indexOf("return (", CARD.indexOf("if (editing)") + 1);
    const readModeBlock = CARD.slice(start);
    expect(readModeBlock).toContain("{PROMPT}");
  });
});

describe("no coach write path exists anywhere", () => {
  it("season-goal-actions.ts is the only file in the app tree that writes season_goal", () => {
    const writers: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const source = readFileSync(full, "utf8");
          if (/season_goal/.test(source) && /\.(upsert|update|insert)\(/.test(source)) {
            writers.push(full);
          }
        }
      }
    }
    walk(join(ROOT, "src/app"));
    expect(writers).toEqual([join(ROOT, "src/app/(app)/(protected)/coaching/season-goal-actions.ts")]);
  });

  it("the action always upserts against session.userId -- never a parameter an athleteId route could supply", () => {
    expect(ACTIONS).toContain("user_id: session.userId");
    expect(ACTIONS).not.toMatch(/athleteId/);
  });

  it("the coach-detail page never imports updateSeasonGoal or any season-goal edit form", () => {
    expect(ATHLETE_DETAIL_PAGE).not.toContain("updateSeasonGoal");
    expect(ATHLETE_DETAIL_PAGE).not.toContain("SeasonGoalCard");
  });
});

describe("the migration is additive-only", () => {
  const migrationFile = readdirSync(join(ROOT, "supabase/migrations")).find((f) => f.includes("season_goal"));
  const migrationSource = migrationFile ? readFileSync(join(ROOT, "supabase/migrations", migrationFile), "utf8") : "";

  it("adds exactly one nullable column, no drops, no RLS changes", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toMatch(/add column season_goal text/);
    expect(migrationSource).not.toMatch(/drop column|drop table|not null(?! default)/i);
    expect(migrationSource).not.toContain("create policy");
  });

  it("documents, in its own comment, why no new RLS policy is needed", () => {
    expect(migrationSource.toLowerCase()).toContain("no rls changes");
  });
});
