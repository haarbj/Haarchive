import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/coaching-engine/date-utils";
import { buildHeatAcclimationPlan, TAPER_DAYS, TARGET_SESSION_MAX_MINUTES } from "@/lib/heat-acclimation-planner-math";

const TODAY = "2026-10-19";

function raceInDays(days: number): string {
  return addDays(TODAY, days);
}

describe("buildHeatAcclimationPlan -- protocol start-date math", () => {
  it("when the race is far enough away, starts the protocol so it ends its taper right before race day", () => {
    const raceDate = raceInDays(30); // comfortably more than needed (14 + 2 for "none")
    const plan = buildHeatAcclimationPlan(raceDate, "none", 90, TODAY);

    expect(plan.isCompressed).toBe(false);
    expect(plan.maintainUntilDate).not.toBeNull();
    // Protocol should start exactly neededProtocolDays + TAPER_DAYS before race day.
    const firstHeatDay = plan.days.find((d) => d.kind === "heat-session")!;
    expect(firstHeatDay.date).toBe(addDays(raceDate, -(14 + TAPER_DAYS)));
  });

  it("maintainUntilDate is null when the protocol starts today (no gap to fill)", () => {
    const raceDate = raceInDays(14 + TAPER_DAYS); // exactly enough runway, no slack
    const plan = buildHeatAcclimationPlan(raceDate, "none", 90, TODAY);
    expect(plan.maintainUntilDate).toBeNull();
    expect(plan.days[0].date).toBe(TODAY);
  });

  it("the plan's days run from the protocol start through race day inclusive, with race day last", () => {
    const raceDate = raceInDays(30);
    const plan = buildHeatAcclimationPlan(raceDate, "none", 90, TODAY);
    expect(plan.days[plan.days.length - 1].date).toBe(raceDate);
    expect(plan.days[plan.days.length - 1].kind).toBe("race-day");
  });
});

describe("buildHeatAcclimationPlan -- session progression", () => {
  it("builds from a low starting duration up to the target, then holds", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(30), "none", 90, TODAY);
    const heatDays = plan.days.filter((d) => d.kind === "heat-session");

    expect(heatDays[0].durationMinutes).toBeLessThan(heatDays[heatDays.length - 1].durationMinutes);
    // Monotonically non-decreasing throughout the build.
    for (let i = 1; i < heatDays.length; i++) {
      expect(heatDays[i].durationMinutes).toBeGreaterThanOrEqual(heatDays[i - 1].durationMinutes);
    }
    // Holds at the target for the back half.
    expect(heatDays[heatDays.length - 1].durationMinutes).toBe(TARGET_SESSION_MAX_MINUTES);
  });

  it("caps session duration at the runner's own available time, never forcing more", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(30), "none", 40, TODAY);
    for (const day of plan.days.filter((d) => d.kind === "heat-session")) {
      expect(day.durationMinutes).toBeLessThanOrEqual(40);
    }
  });

  it("'already training in heat' starts from a higher duration and needs a shorter protocol than 'none'", () => {
    const already = buildHeatAcclimationPlan(raceInDays(30), "already", 90, TODAY);
    const none = buildHeatAcclimationPlan(raceInDays(30), "none", 90, TODAY);
    expect(already.neededProtocolDays).toBeLessThan(none.neededProtocolDays);
    const alreadyFirst = already.days.find((d) => d.kind === "heat-session")!;
    const noneFirst = none.days.find((d) => d.kind === "heat-session")!;
    expect(alreadyFirst.durationMinutes).toBeGreaterThan(noneFirst.durationMinutes);
  });

  it("every heat-session day carries an effort note and a hydration note (woven in, not a footnote)", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(30), "some", 60, TODAY);
    for (const day of plan.days.filter((d) => d.kind === "heat-session")) {
      expect(day.effortNote.length).toBeGreaterThan(0);
      expect(day.hydrationNote.length).toBeGreaterThan(0);
    }
  });

  it("taper days carry zero heat-exposure minutes", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(30), "none", 90, TODAY);
    for (const day of plan.days.filter((d) => d.kind === "taper")) {
      expect(day.durationMinutes).toBe(0);
    }
  });
});

describe("buildHeatAcclimationPlan -- the <10-days-away edge case", () => {
  it("flags the plan as compressed when there isn't enough runway for full acclimation", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(6), "none", 60, TODAY);
    expect(plan.isCompressed).toBe(true);
    expect(plan.daysUntilRace).toBe(6);
  });

  it("a compressed plan still uses every available day (heat days + taper = days until race)", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(6), "none", 60, TODAY);
    const heatDays = plan.days.filter((d) => d.kind === "heat-session").length;
    const taperDays = plan.days.filter((d) => d.kind === "taper").length;
    expect(heatDays + taperDays).toBe(6);
  });

  it("never reserves so much taper that zero protocol days remain", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(1), "none", 60, TODAY);
    const heatDays = plan.days.filter((d) => d.kind === "heat-session").length;
    expect(heatDays).toBeGreaterThanOrEqual(1);
  });

  it("a race today or in the past gets no prep days at all, just race day", () => {
    const todayRace = buildHeatAcclimationPlan(TODAY, "none", 60, TODAY);
    expect(todayRace.days).toHaveLength(1);
    expect(todayRace.days[0].kind).toBe("race-day");
  });

  it("someone already training in heat can still fit a full protocol in a window that's too tight for 'none'", () => {
    const raceDate = raceInDays(9); // 7 needed + 2 taper = 9 for "already"; 14+2=16 needed for "none"
    const already = buildHeatAcclimationPlan(raceDate, "already", 90, TODAY);
    const none = buildHeatAcclimationPlan(raceDate, "none", 90, TODAY);
    expect(already.isCompressed).toBe(false);
    expect(none.isCompressed).toBe(true);
  });
});

describe("buildHeatAcclimationPlan -- the >21-days-away edge case", () => {
  it("a race well over 3 weeks out produces a 'maintain normal training' gap before the protocol starts", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(25), "none", 90, TODAY);
    expect(plan.isCompressed).toBe(false);
    expect(plan.maintainUntilDate).not.toBeNull();
    expect(plan.maintainUntilDate! > TODAY).toBe(true);
  });

  it("the protocol's own first day matches exactly where the maintain gap ends", () => {
    const plan = buildHeatAcclimationPlan(raceInDays(25), "none", 90, TODAY);
    const firstHeatDay = plan.days.find((d) => d.kind === "heat-session")!;
    expect(firstHeatDay.date).toBe(plan.maintainUntilDate);
  });
});
