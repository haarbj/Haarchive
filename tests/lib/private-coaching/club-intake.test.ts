import { describe, expect, it } from "vitest";

import { checkClubIntakeReadiness, recommendClubFramework, MARATHON_READINESS_MILEAGE } from "@/lib/private-coaching/club-intake";

describe("checkClubIntakeReadiness", () => {
  it("is ready at or above the readiness mileage", () => {
    expect(checkClubIntakeReadiness(MARATHON_READINESS_MILEAGE).ready).toBe(true);
    expect(checkClubIntakeReadiness(40).ready).toBe(true);
  });

  it("is not ready below the readiness mileage, with a kind redirect message", () => {
    const result = checkClubIntakeReadiness(15);
    expect(result.ready).toBe(false);
    expect(result.detail).toContain("25 mi/week");
    expect(result.detail).not.toContain("—");
  });
});

describe("recommendClubFramework", () => {
  it("recommends Canyon for a beginner-heavy club profile (most of the club)", () => {
    const rec = recommendClubFramework({ currentWeeklyMileage: 30, yearsRunning: 1, goalType: "finish" });
    expect(rec.frameworkKey).toBe("canyon");
    expect(rec.peakMileageMin).toBeLessThanOrEqual(30);
  });

  it("recommends a higher-volume framework for an experienced, higher-mileage athlete", () => {
    const rec = recommendClubFramework({ currentWeeklyMileage: 70, yearsRunning: 5, goalType: "time" });
    expect(["ridge", "peak", "summit"]).toContain(rec.frameworkKey);
  });

  it("never lets experience alone pull the recommendation above what current mileage supports", () => {
    // Very experienced, but currently running modest mileage -- the
    // limiter is volume, not background (selectPhaseProfile's own rule).
    const rec = recommendClubFramework({ currentWeeklyMileage: 30, yearsRunning: 10, goalType: "finish" });
    expect(rec.frameworkKey).toBe("canyon");
  });

  it("goal type (finish vs time) does not change which framework is recommended", () => {
    const finish = recommendClubFramework({ currentWeeklyMileage: 45, yearsRunning: 2, goalType: "finish" });
    const time = recommendClubFramework({ currentWeeklyMileage: 45, yearsRunning: 2, goalType: "time" });
    expect(finish.frameworkKey).toBe(time.frameworkKey);
  });

  it("detail copy contains no em dashes", () => {
    const rec = recommendClubFramework({ currentWeeklyMileage: 35, yearsRunning: 1, goalType: "finish" });
    expect(rec.detail).not.toContain("—");
  });
});
