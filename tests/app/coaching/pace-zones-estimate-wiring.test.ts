import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for "Open the pace zones table to athletes coached by
// brodyhaar@gmail.com" (Oct 29, 2026). Diagnosis found three of the four
// requested fixes already shipped as-is:
//   - Gate: isAthleteCoachedByAdmin/ADMIN_EMAILS already resolves true for
//     any athlete coached by brodyhaar@gmail.com, since ADMIN_EMAILS
//     currently holds exactly that one address -- no gate code change.
//   - Discoverability: coaching/page.tsx's AthleteHomeSection already shows
//     a "Pace zone table" button, gated on the same isAdminEmail(coachEmail)
//     check, so it's never a dead link.
//   - Estimate editing: scope 4's "Your current fitness estimate" block on
//     Your Paces (/coaching/your-plan#your-paces) already lets the athlete
//     change/recompute it.
// The one real gap: the table itself never read the fitness estimate at
// all -- it only ever offered a race-derived suggestion (or a blank input)
// for the athlete to type into. This is what this change actually fixes.
//
// No React render harness exists in this repo -- source-scan assertions,
// same convention as fitness-estimate-home-wiring.test.ts.

const ROOT = join(__dirname, "../../..");
const PACE_ZONES_PAGE = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/pace-zones/page.tsx"),
  "utf8",
);
const COACHING_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/page.tsx"), "utf8");
const ZONE_TABLE = readFileSync(join(ROOT, "src/components/private-coaching/athlete-pace-zone-table.tsx"), "utf8");

describe("the pace zones table reads the athlete's fitness estimate", () => {
  it("fetches the real estimate via the shared getAthleteFitnessEstimates, not a second lookup", () => {
    expect(PACE_ZONES_PAGE).toContain("getAthleteFitnessEstimates(supabase, session.userId)");
  });

  it("prefers the estimate over the race-derived suggestion for the same basis, but keeps the race fallback", () => {
    const fnBody = PACE_ZONES_PAGE.slice(
      PACE_ZONES_PAGE.indexOf('for (const basis of ["5k", "marathon"] as const) {'),
      PACE_ZONES_PAGE.indexOf("const hasAnyEstimate"),
    );
    const estimateIdx = fnBody.indexOf("fitnessEstimates[basis]");
    const continueIdx = fnBody.indexOf("continue;");
    const raceIdx = fnBody.indexOf("resolvePaceReference(basis, race)");
    expect(estimateIdx).toBeGreaterThanOrEqual(0);
    expect(continueIdx).toBeGreaterThan(estimateIdx);
    expect(raceIdx).toBeGreaterThan(continueIdx);
  });

  it("never fabricates a number: no estimate and no race means no suggestion, just the honest empty-state link", () => {
    expect(PACE_ZONES_PAGE).toContain("You haven&rsquo;t set a fitness estimate yet.");
    expect(PACE_ZONES_PAGE).toContain('href="/coaching/your-plan#your-paces"');
  });

  it("deep-links to the one real edit home (Your Paces) rather than building a second editor", () => {
    const linkCount = PACE_ZONES_PAGE.split('href="/coaching/your-plan#your-paces"').length - 1;
    expect(linkCount).toBe(2); // the empty-state link and the "update your estimate" link
  });

  it("the suggestion button never calls a self-reported estimate 'predicted'", () => {
    expect(ZONE_TABLE).toContain('kind === "estimate" ? "" : "your predicted "');
  });
});

describe("the gate and the dashboard link already existed and are left unchanged", () => {
  it("coaching/pace-zones/page.tsx's gate is untouched: isCoachedAthlete + isAthleteCoachedByAdmin", () => {
    expect(PACE_ZONES_PAGE).toContain("if (!session?.isCoachedAthlete) redirect(\"/coaching\");");
    expect(PACE_ZONES_PAGE).toContain("if (!(await isAthleteCoachedByAdmin(supabase, session.userId))) redirect(\"/coaching\");");
  });

  it("the dashboard already links to the table only for admin-coached athletes, never a dead redirect", () => {
    expect(COACHING_PAGE).toContain("const showPaceZoneTool = isAdminEmail(coachEmail);");
    expect(COACHING_PAGE).toContain('{showPaceZoneTool ? (\n          <Button href="/coaching/pace-zones" variant="outline">');
  });
});
