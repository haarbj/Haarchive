import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for two real bugs found while diagnosing the
// athlete-side schedule on-ramps (deep-dive Findings 4/5, scope 2):
//
// 1. The "Take me to my schedule" button (Your Plan) navigated to
//    /coaching (the coaching home), not to any schedule view at all --
//    a real destination mismatch against its own label, confirmed via
//    real interactive sessions (see this task's report for evidence),
//    distinct from the SPA navigation latency the original deep-dive
//    also noted (which does NOT explain this one: the button always
//    reached /coaching, it just took a few seconds to get there).
// 2. plan/layout.tsx's gate only ever checked the signed-in session's
//    own isAthlete/isCoachedAthlete, with zero view-as awareness -- a
//    coach actively viewing as one of their athletes is neither of
//    those things themselves, so every /plan visit redirected to
//    /dashboard and silently dropped view-as, even though plan/page.tsx
//    below this layout was already fully view-as aware and never got a
//    chance to run.
//
// No React render harness exists in this repo -- source-scan assertions,
// same convention as privately-coached-gate-wiring.test.ts.

const ROOT = join(__dirname, "../../..");
const LAYOUT = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/layout.tsx"), "utf8");
const DISMISS_BUTTON = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/dismiss-payoff-button.tsx"), "utf8");
const COACHING_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/page.tsx"), "utf8");

describe("plan/layout.tsx admits a coach actively viewing as one of their athletes", () => {
  it("calls resolveViewAsState for a private coach before the final redirect", () => {
    expect(LAYOUT).toContain("resolveViewAsState(supabase, session.userId)");
    const guardIdx = LAYOUT.indexOf("if (session?.isPrivateCoach)");
    const viewAsCallIdx = LAYOUT.indexOf("resolveViewAsState(supabase, session.userId)");
    const redirectIdx = LAYOUT.lastIndexOf('redirect("/dashboard")');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(viewAsCallIdx).toBeGreaterThan(guardIdx);
    expect(redirectIdx).toBeGreaterThan(viewAsCallIdx);
  });

  it("still admits isAthlete/isCoachedAthlete directly, unchanged from the Oct 19 fix", () => {
    expect(LAYOUT).toContain("if (session?.isAthlete || session?.isCoachedAthlete) return children;");
  });
});

describe("DismissPayoffButton (\"Take me to my schedule\") navigates to the athlete's own schedule, not the coaching home", () => {
  it("pushes to /plan after a successful dismiss, not /coaching", () => {
    expect(DISMISS_BUTTON).toContain('router.push("/plan")');
    expect(DISMISS_BUTTON).not.toContain('router.push("/coaching")');
  });
});

describe("AthleteHomeSection (Coaching page, athlete view) has a direct schedule-week-view on-ramp", () => {
  it("has a 'My schedule' link to /plan, not just the payoff/roadmap links", () => {
    const sectionStart = COACHING_PAGE.indexOf("async function AthleteHomeSection");
    expect(sectionStart).toBeGreaterThan(-1);
    const sectionEnd = COACHING_PAGE.indexOf("\nfunction ChecklistRow", sectionStart);
    const sectionBody = COACHING_PAGE.slice(sectionStart, sectionEnd);
    expect(sectionBody).toMatch(/<Button href="\/plan" variant="outline">\s*My schedule/);
  });
});
