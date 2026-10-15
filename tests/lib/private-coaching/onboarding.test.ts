import { describe, it, expect } from "vitest";
import {
  CRASH_COURSE_EFFORT_GUIDE,
  CRASH_COURSE_LEVELS,
  MARATHON_READINESS_MILEAGE,
  checkOnboardingPrerequisites,
  crashCourseLevelFor,
  mileageMatchCheck,
  offerCrashCourse,
} from "@/lib/private-coaching/onboarding";

describe("checkOnboardingPrerequisites", () => {
  it("is ready only when both prerequisites are met", () => {
    const result = checkOnboardingPrerequisites({ currentWeeklyMileage: 30, has5kEstimate: true });
    expect(result.mileageReady).toBe(true);
    expect(result.estimateReady).toBe(true);
    expect(result.readyForMarathonPlan).toBe(true);
    expect(result.notes).toEqual(["Both prerequisites are met."]);
  });

  it("flags low mileage and advises building a base first", () => {
    expect(MARATHON_READINESS_MILEAGE).toBe(25);
    const result = checkOnboardingPrerequisites({ currentWeeklyMileage: 15, has5kEstimate: true });
    expect(result.mileageReady).toBe(false);
    expect(result.readyForMarathonPlan).toBe(false);
    expect(result.notes.join(" ")).toMatch(/Build easy mileage first/);
  });

  it("treats no recorded mileage as not ready, with a different message than low mileage", () => {
    const result = checkOnboardingPrerequisites({ currentWeeklyMileage: null, has5kEstimate: true });
    expect(result.mileageReady).toBe(false);
    expect(result.notes.join(" ")).toMatch(/No current weekly mileage on file/);
  });

  it("flags a missing 5K estimate and points at the crash course", () => {
    const result = checkOnboardingPrerequisites({ currentWeeklyMileage: 30, has5kEstimate: false });
    expect(result.estimateReady).toBe(false);
    expect(result.notes.join(" ")).toMatch(/Crash Course is built for exactly this gap/);
  });

  it("reports both gaps independently when both are missing", () => {
    const result = checkOnboardingPrerequisites({ currentWeeklyMileage: 10, has5kEstimate: false });
    expect(result.notes).toHaveLength(2);
    expect(result.readyForMarathonPlan).toBe(false);
  });
});

describe("mileageMatchCheck (Part D item 8, built to unblock Part K)", () => {
  it("is not a stretch when the athlete is already at or above the plan's start", () => {
    const result = mileageMatchCheck({ athleteCurrentWeeklyRunningMileage: 60, planStartingMileage: 55 });
    expect(result.isStretch).toBe(false);
  });

  it("flags more than a 20% gap as a real stretch, with the don't-start-barely-hanging-on wording", () => {
    const result = mileageMatchCheck({ athleteCurrentWeeklyRunningMileage: 40, planStartingMileage: 60 });
    expect(result.isStretch).toBe(true);
    expect(result.detail).toMatch(/Don't start barely hanging on/);
    expect(result.detail).toMatch(/consider a lower-volume plan/);
  });

  it("does not flag a gap inside 20% as a stretch", () => {
    const result = mileageMatchCheck({ athleteCurrentWeeklyRunningMileage: 50, planStartingMileage: 55 });
    expect(result.isStretch).toBe(false);
    expect(result.detail).toMatch(/Close enough to build into/);
  });

  it("handles missing data without throwing", () => {
    expect(mileageMatchCheck({ athleteCurrentWeeklyRunningMileage: null, planStartingMileage: 55 }).isStretch).toBe(false);
    expect(mileageMatchCheck({ athleteCurrentWeeklyRunningMileage: 40, planStartingMileage: null }).isStretch).toBe(false);
  });

  it("appends the recorded training-background anchor as extra context without changing the stretch verdict", () => {
    const withAnchor = mileageMatchCheck({
      athleteCurrentWeeklyRunningMileage: 40,
      planStartingMileage: 60,
      anchorPeak: { peakMileage: 70, reliable: true, note: "Anchored on a recorded peak of 70 mi/week from their self-trained buildup." },
    });
    expect(withAnchor.isStretch).toBe(true);
    expect(withAnchor.detail).toMatch(/Don't start barely hanging on/);
    expect(withAnchor.detail).toMatch(/recorded peak of 70 mi\/week/);
  });

  it("says nothing extra when no anchor peak is given, preserving the original wording exactly", () => {
    const result = mileageMatchCheck({ athleteCurrentWeeklyRunningMileage: 50, planStartingMileage: 55 });
    expect(result.detail).toBe(
      "Currently running 50 mi/week against a plan that starts at 55. Close enough to build into over the first couple of weeks.",
    );
  });
});

describe("crashCourseLevelFor and offerCrashCourse", () => {
  it("matches each framework level's own mileage exactly", () => {
    expect(crashCourseLevelFor(25)).toBe("I");
    expect(crashCourseLevelFor(32)).toBe("II");
    expect(crashCourseLevelFor(40)).toBe("III");
  });

  it("picks the closest level for mileage between two levels", () => {
    expect(crashCourseLevelFor(28)).toBe("I");
    expect(crashCourseLevelFor(29)).toBe("II");
    expect(crashCourseLevelFor(36)).toBe("II");
    expect(crashCourseLevelFor(37)).toBe("III");
  });

  it("defaults to level I when mileage is unknown, as the safest assumption", () => {
    expect(crashCourseLevelFor(null)).toBe("I");
  });

  it("offers the matching framework key and explains how the result becomes a real estimate", () => {
    const offer = offerCrashCourse(32);
    expect(offer.level).toBe("II");
    expect(offer.frameworkKey).toBe("crash-course-ii");
    expect(offer.detail).toMatch(/culminating in a 5K race or time trial/);
    expect(offer.detail).toMatch(/once they record it themselves in settings/);
  });

  it("lists exactly the three seeded levels with their real framework keys", () => {
    expect(CRASH_COURSE_LEVELS).toEqual([
      { level: "I", mileage: 25, frameworkKey: "crash-course-i" },
      { level: "II", mileage: 32, frameworkKey: "crash-course-ii" },
      { level: "III", mileage: 40, frameworkKey: "crash-course-iii" },
    ]);
  });
});

describe("CRASH_COURSE_EFFORT_GUIDE", () => {
  it("transcribes all six effort levels from the source verbatim", () => {
    expect(CRASH_COURSE_EFFORT_GUIDE).toHaveLength(6);
    expect(CRASH_COURSE_EFFORT_GUIDE.map((l) => l.effort)).toEqual([
      "Very easy",
      "Easy",
      "Moderate",
      "Strong",
      "Fast",
      "Very fast",
    ]);
    expect(CRASH_COURSE_EFFORT_GUIDE[3].feelsLike).toMatch(/Marathon to half marathon pace/);
  });
});
