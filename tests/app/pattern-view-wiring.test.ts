import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see plan-payoff-view-wiring.test.ts's own header comment for
// the established pattern) verifying both surfaces render the Pattern
// view through the one shared component and the one shared data loader,
// that it never duplicates computeWeeklyLoad or isBigSession, and that
// it carries no color-coded good/bad judgment or adaptation-card links.
// The aggregation math itself is covered by pattern-view.test.ts; this
// file is about wiring.

const ROOT = join(__dirname, "../..");
const PANEL = readFileSync(join(ROOT, "src/components/private-coaching/pattern-view-panel.tsx"), "utf8");
const DATA_LOADER = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/pattern-view-data.ts"), "utf8");
const PATTERN_LIB = readFileSync(join(ROOT, "src/lib/private-coaching/pattern-view.ts"), "utf8");
const PLAN_VIEW = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/plan-view.tsx"), "utf8");
const ATHLETE_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/page.tsx"), "utf8");

describe("one shared component, one shared loader, both surfaces", () => {
  it("the athlete's own /plan renders PatternViewPanel from loadPatternViewData", () => {
    expect(PLAN_VIEW).toContain('import { loadPatternViewData } from "./pattern-view-data"');
    expect(PLAN_VIEW).toContain('import { PatternViewPanel } from "@/components/private-coaching/pattern-view-panel"');
    expect(PLAN_VIEW).toContain("<PatternViewPanel series={patternSeries} />");
  });

  it("the coach's athlete-detail page renders the exact same component from the exact same loader, not a reimplementation", () => {
    expect(ATHLETE_PAGE).toContain('import { loadPatternViewData } from "@/app/(app)/(protected)/plan/pattern-view-data"');
    expect(ATHLETE_PAGE).toContain('import { PatternViewPanel } from "@/components/private-coaching/pattern-view-panel"');
    expect(ATHLETE_PAGE).toContain("<PatternViewPanel series={patternSeries} />");
  });

  it("the window is computed in the viewer's own timezone on the coach surface (todayForViewer), not a stored athlete timezone", () => {
    expect(ATHLETE_PAGE).toContain("await loadPatternViewData(supabase, athleteId, await todayForViewer())");
  });
});

describe("reuses the corrected weekly-load and plan-health modules, never a second implementation", () => {
  it("pattern-view.ts calls computeWeeklyLoad once per week, imported from weekly-load.ts", () => {
    expect(PATTERN_LIB).toContain('from "./weekly-load"');
    expect(PATTERN_LIB).toContain("computeWeeklyLoad(entries, null, input.today)");
  });

  it("key-session classification reuses isBigSession from plan-health.ts, not a reinvented RPE threshold", () => {
    expect(PATTERN_LIB).toContain('from "./plan-health"');
    expect(PATTERN_LIB).toContain("isBigSession(");
    expect(PATTERN_LIB).not.toMatch(/>=\s*8\b/); // isBigSession's own "RPE 8 or above" threshold, not duplicated here
  });

  it("never imports or references the AI layer -- no generated recommendations", () => {
    for (const source of [PATTERN_LIB, DATA_LOADER, PANEL]) {
      expect(source).not.toMatch(/@\/lib\/ai\b/);
    }
  });
});

describe("neutral facts and direction only -- no scores, no verdicts, no recommendations", () => {
  it("the panel never imports an adaptation-card component or action", () => {
    expect(PANEL).not.toMatch(/adaptation-(cards|signals|service)/);
  });

  it("the panel never uses an accent/error/success/warning color class on a trend value", () => {
    expect(PANEL).not.toMatch(/accent-(error|success|warning)/);
    expect(PANEL).not.toMatch(/text-(red|green|emerald)-\d/);
  });

  // "score"/"good/bad" appear once in this file's own explanatory
  // comment, stating what it deliberately isn't (same "the negation
  // itself is the point" exclusion roster-dashboard-wiring.test.ts
  // already establishes) -- stripped here so that one mention doesn't
  // trip the check meant to catch an actual graded label in rendered text.
  it("trend words are plain description, never a graded label like good/bad/on track/at risk", () => {
    const withoutComments = PANEL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(withoutComments.toLowerCase()).not.toMatch(/\bgood\b|\bbad\b|on track|at risk|\bscore\b|\bgrade\b/);
  });

  it("the explainer line states the Wetmore principle in plain language, no em dash in the sentence itself", () => {
    const explainer = "Six weeks of patterns. Single workouts are weather; this is the climate.";
    expect(PANEL).toContain(explainer);
    expect(explainer).not.toContain("—");
  });
});

describe("read-only: no new storage, no second aggregation path", () => {
  it("the data loader only ever selects, never writes", () => {
    expect(DATA_LOADER).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it("the current (in-progress) week is visibly labeled, never silently blended into history", () => {
    expect(PANEL).toContain("in progress");
    expect(PATTERN_LIB).toContain("isCurrent");
  });

  it("a pre-program gap is visually distinct from a zero-completion programmed week ('no program' vs real numbers)", () => {
    expect(PANEL).toContain("no program");
  });
});
