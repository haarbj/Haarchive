import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see today-conditions-wiring.test.ts's own header comment for
// the established pattern) verifying: the v1 surfaces (home, /plan,
// your-plan) resolve and render the VIEW-AS TARGET's id, never the
// coach's own, whenever the mode is active; the entry buttons/banner are
// wired correctly; and rendering those surfaces performs no implicit
// write. Authorization and the real data-identity behavior of
// resolveViewAsState itself are covered by view-as.test.ts; server
// refusal by view-as-mutation-refusal.test.ts.

const ROOT = join(__dirname, "../..");
const HOME_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/page.tsx"), "utf8");
const YOUR_PLAN_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/your-plan/page.tsx"), "utf8");
const PLAN_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/page.tsx"), "utf8");
const ATHLETE_DETAIL_PAGE = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/page.tsx"),
  "utf8",
);
const ROSTER_TABLE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/roster/roster-table.tsx"), "utf8");
const ROSTER_PAGE = readFileSync(join(ROOT, "src/app/(app)/(protected)/coaching/roster/page.tsx"), "utf8");
const BANNER = readFileSync(join(ROOT, "src/components/private-coaching/view-as-banner.tsx"), "utf8");
const BUTTON = readFileSync(join(ROOT, "src/components/private-coaching/view-as-button.tsx"), "utf8");
const COACH_SCHEDULE_PAGE = readFileSync(
  join(ROOT, "src/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/page.tsx"),
  "utf8",
);

describe("data identity: v1 surfaces render the view-as TARGET's id, never the coach's own", () => {
  it("home renders AthleteHomeSection with viewAs.athleteId when active, session.userId only otherwise", () => {
    expect(HOME_PAGE).toContain("<AthleteHomeSection userId={viewAs.athleteId} />");
    expect(HOME_PAGE).toContain("<AthleteHomeSection userId={session.userId} />");
  });

  it("your-plan resolves effectiveAthleteId from viewAs first, and loads payoff/race-result data scoped to it, not session.userId", () => {
    expect(YOUR_PLAN_PAGE).toContain("const effectiveAthleteId = viewAs?.athleteId ?? session.userId;");
    expect(YOUR_PLAN_PAGE).toContain("loadPlanPayoffData(supabase, effectiveAthleteId, relationship.coachId, today)");
    expect(YOUR_PLAN_PAGE).toContain('.eq("user_id", effectiveAthleteId)');
  });

  it("/plan resolves effectiveUserId from viewAs first, and PlanView is called with it, not session.userId", () => {
    expect(PLAN_PAGE).toContain("const effectiveUserId = viewAs?.athleteId ?? session.userId;");
    expect(PLAN_PAGE).toContain("<PlanView userId={effectiveUserId}");
  });

  it("every v1 surface resolves view-as the same way: resolveViewAsState gated on session.isPrivateCoach, never trusted without re-validation", () => {
    for (const source of [HOME_PAGE, YOUR_PLAN_PAGE, PLAN_PAGE]) {
      expect(source).toMatch(/session\.isPrivateCoach \? await resolveViewAsState\(supabase, session\.userId\) : null/);
    }
  });
});

describe("entry points", () => {
  it("the roster row renders View as for every athlete except the coach's own self-coach row", () => {
    expect(ROSTER_TABLE).toContain("{!isSelf ? <ViewAsButton");
    expect(ROSTER_TABLE).toContain('isSelf={row.athleteId === coachUserId}');
    expect(ROSTER_PAGE).toContain("coachUserId={session.userId}");
  });

  it("the athlete-detail header renders View as only for a real, active, non-self relationship", () => {
    expect(ATHLETE_DETAIL_PAGE).toContain("{coachAthleteRow && athleteId !== session.userId ? (");
    expect(ATHLETE_DETAIL_PAGE).toContain("<ViewAsButton athleteId={athleteId}");
  });

  it("the button labels itself with the athlete's first name, never a generic label", () => {
    expect(BUTTON).toMatch(/View as \{athleteFirstName\}/);
  });
});

describe("the banner", () => {
  it("renders the athlete's full name, the read-only label, and an exit control on every view-as page", () => {
    expect(BANNER).toMatch(/Viewing as \{athleteName\}/);
    expect(BANNER).toContain("Read-only");
    expect(BANNER).toContain("Back to coach view");
    expect(BANNER).toContain("exitViewAsAthlete");
  });

  it("is rendered on all three v1 surfaces, conditioned on viewAs being active", () => {
    expect(HOME_PAGE).toContain("<ViewAsBanner athleteName={athleteProfile?.display_name ?? \"this athlete\"} />");
    expect(YOUR_PLAN_PAGE).toContain("{viewAs ? <ViewAsBanner athleteName={athleteProfile?.display_name ?? \"this athlete\"} /> : null}");
    expect(PLAN_PAGE).toContain("{viewAs ? <ViewAsBanner athleteName={athleteName!} /> : null}");
  });
});

describe("no implicit writes while rendering home or Your Plan in view-as", () => {
  it("the payoff-redirect check in AthleteHomeSection only SELECTs plan_payoff_dismissed_at -- never updates it on render", () => {
    const start = HOME_PAGE.indexOf("async function AthleteHomeSection");
    const body = HOME_PAGE.slice(start, HOME_PAGE.indexOf("\nasync function ", start + 1));
    expect(body).toContain('.select("plan_payoff_dismissed_at")');
    expect(body).not.toMatch(/\.update\(/);
  });

  it("your-plan/page.tsx itself never calls an update/insert -- dismissal is only ever a separate, explicit button click", () => {
    expect(YOUR_PLAN_PAGE).not.toMatch(/\.update\(|\.insert\(/);
  });

  it("the dismiss button is never rendered while view-as is active -- onDismiss is omitted outright, not just disabled", () => {
    expect(YOUR_PLAN_PAGE).toContain("onDismiss={viewAs ? undefined : <DismissPayoffButton />}");
  });

  it("neither home nor your-plan imports a notification-marking function (markThreadRead, notifications read-state)", () => {
    for (const source of [HOME_PAGE, YOUR_PLAN_PAGE]) {
      expect(source).not.toMatch(/markThreadRead|mark.*[Nn]otification.*[Rr]ead/);
    }
  });
});

describe("read-only enforcement in the UI (server refusal is the real guarantee, see view-as-mutation-refusal.test.ts)", () => {
  it("the self-serve completion form and undo control are hidden on WorkoutCard when readOnly", () => {
    const cardSource = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/workout-card.tsx"), "utf8");
    expect(cardSource).toContain("{completion && !readOnly && (");
    expect(cardSource).toContain("{!completion && !readOnly && (");
  });

  it("the disruption-flag trigger is hidden in view-as", () => {
    expect(PLAN_PAGE).toContain("readOnly={!!viewAs}");
    const planView = readFileSync(join(ROOT, "src/app/(app)/(protected)/plan/plan-view.tsx"), "utf8");
    expect(planView).toContain("{!coachView && !readOnly && (");
  });
});

describe("Timeline is deferred, not silently wrong", () => {
  it("Timeline is never offered while view-as is active -- its own loader always reads the caller's own session, which view-as can't safely redirect without changing that action's signature", () => {
    expect(PLAN_PAGE).toContain('sp.view === "timeline" && !viewAs ? "timeline" : "week"');
  });
});

describe("mode governs athlete surfaces only -- coach surfaces are unaffected", () => {
  it("the coach's own schedule page never resolves or renders view-as", () => {
    expect(COACH_SCHEDULE_PAGE).not.toContain("resolveViewAsState");
    expect(COACH_SCHEDULE_PAGE).not.toContain("ViewAsBanner");
  });

  it("the roster page itself (as opposed to the row's own button) never branches on view-as", () => {
    expect(ROSTER_PAGE).not.toContain("resolveViewAsState");
  });
});
