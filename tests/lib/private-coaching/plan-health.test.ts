import { describe, it, expect } from "vitest";
import {
  ADAPTATION_WINDOW_DAYS,
  classifyUpcomingSessions,
  extractPacePercents,
  isBigSession,
  isInsideAdaptationWindow,
  runPlanHealthChecks,
  targetsMarathonPaceBand,
  workoutPacePercents,
  type PlanHealthPhase,
  type PlanHealthWorkout,
} from "@/lib/private-coaching/plan-health";

function workout(overrides: Partial<PlanHealthWorkout> & { scheduledDate: string }): PlanHealthWorkout {
  return {
    id: overrides.scheduledDate,
    dayLabel: null,
    prescription: null,
    plannedRpe: null,
    plannedRpeMax: null,
    pacePercentBasis: null,
    pacePercentMin: null,
    pacePercentMax: null,
    isOptional: false,
    phaseKey: null,
    ...overrides,
  };
}

describe("extractPacePercents", () => {
  it("reads single values and ranges, in both bases", () => {
    expect(extractPacePercents("13-14 mi at 98-100% MP")).toEqual([{ basis: "marathon", min: 98, max: 100 }]);
    expect(extractPacePercents("5 x 1 mi at 95% 5k with 3 min jog")).toEqual([{ basis: "5k", min: 95, max: 95 }]);
  });

  it("reads every target in a multi-segment prescription, in order", () => {
    const prose = "1.5 mi warm-up / 5 x (1 km at 105% MP, 1 km at 96% MP) / 1 mi easy";
    expect(extractPacePercents(prose)).toEqual([
      { basis: "marathon", min: 105, max: 105 },
      { basis: "marathon", min: 96, max: 96 },
    ]);
  });

  it("handles the en dash that Peak and Summit use", () => {
    expect(extractPacePercents("6 mi at 90–92% MP")).toEqual([{ basis: "marathon", min: 90, max: 92 }]);
  });

  it("normalises a backwards range rather than returning nonsense", () => {
    expect(extractPacePercents("4 mi at 100-98% MP")).toEqual([{ basis: "marathon", min: 98, max: 100 }]);
  });

  it("finds nothing in prose that states no pace", () => {
    expect(extractPacePercents("8-10 mi easy with 5 x 25 sec strides")).toEqual([]);
    expect(extractPacePercents(null)).toEqual([]);
    expect(extractPacePercents("")).toEqual([]);
  });

  it("ignores percentages that are not a pace basis it knows", () => {
    expect(extractPacePercents("drop volume by 60% this week")).toEqual([]);
    expect(extractPacePercents("90% of heart-rate reserve")).toEqual([]);
  });
});

describe("workoutPacePercents", () => {
  it("combines a structured target with whatever the prose says", () => {
    const w = workout({
      scheduledDate: "2027-01-04",
      pacePercentBasis: "marathon",
      pacePercentMin: 100,
      pacePercentMax: null,
      prescription: "2 mi warm-up / 8 x 500m at 108-110% MP / 1 mi easy",
    });
    expect(workoutPacePercents(w)).toEqual([
      { basis: "marathon", min: 100, max: 100 },
      { basis: "marathon", min: 108, max: 110 },
    ]);
  });
});

describe("targetsMarathonPaceBand", () => {
  it("matches a range that overlaps the band at either edge", () => {
    const w = (p: string) => workout({ scheduledDate: "2027-01-04", prescription: p });
    expect(targetsMarathonPaceBand(w("13 mi at 98-100% MP"), 98, 102)).toBe(true);
    expect(targetsMarathonPaceBand(w("6 mi at 102% MP"), 98, 102)).toBe(true);
    expect(targetsMarathonPaceBand(w("18 mi at 95% MP"), 98, 102)).toBe(false);
    expect(targetsMarathonPaceBand(w("8 x 500m at 108-110% MP"), 98, 102)).toBe(false);
  });

  it("never matches a 5k-based target", () => {
    expect(targetsMarathonPaceBand(workout({ scheduledDate: "2027-01-04", prescription: "7 mi at 100% 5k" }), 98, 102)).toBe(false);
  });
});

describe("isBigSession", () => {
  it("uses the top of the difficulty range", () => {
    expect(isBigSession(workout({ scheduledDate: "2027-01-04", plannedRpe: 7, plannedRpeMax: 8 }))).toBe(true);
    expect(isBigSession(workout({ scheduledDate: "2027-01-04", plannedRpe: 7, plannedRpeMax: null }))).toBe(false);
  });

  it("never counts an optional session as big", () => {
    expect(isBigSession(workout({ scheduledDate: "2027-01-04", plannedRpe: 9, isOptional: true }))).toBe(false);
  });

  it("says nothing about a session with no difficulty set", () => {
    expect(isBigSession(workout({ scheduledDate: "2027-01-04" }))).toBe(false);
  });
});

describe("runPlanHealthChecks", () => {
  const phases: PlanHealthPhase[] = [
    { phaseKey: "Specific", startDate: "2027-03-01", endDate: "2027-04-11", weeks: 6 },
  ];

  it("stays completely silent on a sound plan", () => {
    const findings = runPlanHealthChecks({
      workouts: [
        workout({ scheduledDate: "2027-03-20", prescription: "18 mi at 98-100% MP", plannedRpe: 9, phaseKey: "Specific" }),
        workout({ scheduledDate: "2027-03-27", prescription: "6 x (3 km at 100% MP, 1 km at 90% MP)", plannedRpe: 8, phaseKey: "Specific" }),
      ],
      phases,
      raceDate: "2027-04-11",
      peakMileage: 90,
      experienceYears: 5,
    });
    expect(findings).toEqual([]);
  });

  it("flags a missing marathon-pace rehearsal two to four weeks out", () => {
    const findings = runPlanHealthChecks({
      workouts: [
        workout({ scheduledDate: "2027-03-20", prescription: "20 mi easy through rolling hills" }),
        workout({ scheduledDate: "2027-03-24", prescription: "10 x 500m at 108-110% MP" }),
      ],
      phases,
      raceDate: "2027-04-11",
      peakMileage: 90,
      experienceYears: 5,
    });
    expect(findings.map((f) => f.key)).toContain("mp-rehearsal-missing");
    const finding = findings.find((f) => f.key === "mp-rehearsal-missing")!;
    // Advisory, with an explicit "this might be fine" escape.
    expect(finding.detail).toMatch(/nothing to act on/);
  });

  it("does not flag a missing rehearsal when the plan has not reached that window yet", () => {
    // A half-built schedule is not an unhealthy one.
    const findings = runPlanHealthChecks({
      workouts: [workout({ scheduledDate: "2027-01-04", prescription: "8 mi easy" })],
      phases,
      raceDate: "2027-04-11",
      peakMileage: 90,
      experienceYears: 5,
    });
    expect(findings.map((f) => f.key)).not.toContain("mp-rehearsal-missing");
  });

  it("does not flag a missing rehearsal when there is no race date", () => {
    const findings = runPlanHealthChecks({
      workouts: [workout({ scheduledDate: "2027-03-20", prescription: "20 mi easy" })],
      phases,
      raceDate: null,
      peakMileage: 90,
      experienceYears: 5,
    });
    expect(findings.map((f) => f.key)).not.toContain("mp-rehearsal-missing");
  });

  it("flags two demanding sessions closer than five days, once per pair", () => {
    const findings = runPlanHealthChecks({
      workouts: [
        workout({ scheduledDate: "2027-03-20", dayLabel: "Long fast run", plannedRpe: 9, prescription: "22 mi at 95% MP" }),
        workout({ scheduledDate: "2027-03-22", dayLabel: "Alternating km", plannedRpe: 8, prescription: "5 x (1 km at 105% MP, 1 km at 96% MP)" }),
      ],
      phases,
      raceDate: null,
      peakMileage: null,
      experienceYears: null,
    });
    const spacing = findings.filter((f) => f.key.startsWith("big-session-spacing:"));
    expect(spacing).toHaveLength(1);
    expect(spacing[0].title).toMatch(/2 days apart/);
    expect(spacing[0].detail).toMatch(/two to three genuinely easy days/);
    // Keyed by both dates so dismissing one pair leaves others alone.
    expect(spacing[0].key).toBe("big-session-spacing:2027-03-20:2027-03-22");
    expect(spacing[0].dates).toEqual(["2027-03-20", "2027-03-22"]);
  });

  it("accepts well-spaced big sessions", () => {
    const findings = runPlanHealthChecks({
      workouts: [
        workout({ scheduledDate: "2027-03-20", plannedRpe: 9 }),
        workout({ scheduledDate: "2027-03-27", plannedRpe: 9 }),
      ],
      phases,
      raceDate: null,
      peakMileage: null,
      experienceYears: null,
    });
    expect(findings.filter((f) => f.key.startsWith("big-session-spacing:"))).toHaveLength(0);
  });

  it("does not treat an optional double as a big session clash", () => {
    const findings = runPlanHealthChecks({
      workouts: [
        workout({ scheduledDate: "2027-03-20", plannedRpe: 9 }),
        workout({ scheduledDate: "2027-03-21", plannedRpe: 9, isOptional: true }),
      ],
      phases,
      raceDate: null,
      peakMileage: null,
      experienceYears: null,
    });
    expect(findings.filter((f) => f.key.startsWith("big-session-spacing:"))).toHaveLength(0);
  });

  it("flags a specific phase that is long for the athlete's volume", () => {
    const findings = runPlanHealthChecks({
      workouts: [],
      phases: [{ phaseKey: "Specific", startDate: "2027-01-04", endDate: "2027-04-11", weeks: 14 }],
      raceDate: null,
      peakMileage: 45,
      experienceYears: 1,
    });
    const finding = findings.find((f) => f.key.startsWith("specific-phase-length:"))!;
    expect(finding.title).toMatch(/14 weeks/);
    expect(finding.detail).toMatch(/leans on the general fitness built underneath it/);
  });

  it("never flags a specific-phase length that is normal somewhere in the methodology", () => {
    // Summit authors 7 specific weeks. A 7-week block must not be flagged
    // even for a low-mileage athlete, or the check contradicts the seeds.
    const findings = runPlanHealthChecks({
      workouts: [],
      phases: [{ phaseKey: "Specific", startDate: "2027-01-04", endDate: "2027-02-21", weeks: 7 }],
      raceDate: null,
      peakMileage: 45,
      experienceYears: 1,
    });
    expect(findings.filter((f) => f.key.startsWith("specific-phase-length:"))).toHaveLength(0);
  });

  it("says nothing about phase length when peak mileage is unknown", () => {
    const findings = runPlanHealthChecks({
      workouts: [],
      phases: [{ phaseKey: "Specific", startDate: "2027-01-04", endDate: "2027-04-11", weeks: 14 }],
      raceDate: null,
      peakMileage: null,
      experienceYears: null,
    });
    expect(findings).toEqual([]);
  });
});

describe("classifyUpcomingSessions", () => {
  it("marks specific-phase marathon-pace work load-bearing", () => {
    const [classified] = classifyUpcomingSessions({
      workouts: [
        workout({ scheduledDate: "2027-04-03", phaseKey: "Specific", prescription: "5 x (5 km at 100% MP, 1 km at 90% MP)" }),
      ],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.loadClass).toBe("load-bearing");
    expect(classified.reason).toMatch(/the race is rehearsed in/);
  });

  it("treats the same session outside the specific phase as supporting, not load-bearing", () => {
    const [classified] = classifyUpcomingSessions({
      workouts: [workout({ scheduledDate: "2027-04-03", phaseKey: "Supportive", prescription: "10 mi at 100% MP" })],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.loadClass).toBe("supporting");
  });

  it("marks an optional session droppable whatever else it says", () => {
    const [classified] = classifyUpcomingSessions({
      workouts: [
        workout({ scheduledDate: "2027-04-03", phaseKey: "Specific", prescription: "10 mi at 100% MP", isOptional: true }),
      ],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.loadClass).toBe("droppable");
    expect(classified.reason).toMatch(/already marks this session optional/);
  });

  it("marks easy running droppable and says it is the cheapest change", () => {
    const [classified] = classifyUpcomingSessions({
      workouts: [workout({ scheduledDate: "2027-04-03", phaseKey: "Specific", prescription: "8 mi easy" })],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.loadClass).toBe("droppable");
    expect(classified.reason).toMatch(/cheapest adjustment/);
  });

  it("marks a hard non-specific session supporting", () => {
    const [classified] = classifyUpcomingSessions({
      workouts: [workout({ scheduledDate: "2027-04-03", phaseKey: "Specific", plannedRpe: 9, prescription: "10 x 400m at 112% MP" })],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.loadClass).toBe("supporting");
  });

  it("only looks forward, and not past the race", () => {
    const classified = classifyUpcomingSessions({
      workouts: [
        workout({ scheduledDate: "2027-03-30" }),
        workout({ scheduledDate: "2027-04-03" }),
        workout({ scheduledDate: "2027-04-20" }),
      ],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.map((c) => c.workout.scheduledDate)).toEqual(["2027-04-03"]);
  });

  it("returns sessions oldest first", () => {
    const classified = classifyUpcomingSessions({
      workouts: [workout({ scheduledDate: "2027-04-08" }), workout({ scheduledDate: "2027-04-03" })],
      fromDate: "2027-04-01",
      raceDate: "2027-04-11",
    });
    expect(classified.map((c) => c.workout.scheduledDate)).toEqual(["2027-04-03", "2027-04-08"]);
  });
});

describe("isInsideAdaptationWindow", () => {
  it("covers the four weeks before the race, inclusive", () => {
    expect(ADAPTATION_WINDOW_DAYS).toBe(28);
    expect(isInsideAdaptationWindow("2027-04-11", "2027-04-11")).toBe(true);
    expect(isInsideAdaptationWindow("2027-03-14", "2027-04-11")).toBe(true);
    expect(isInsideAdaptationWindow("2027-03-13", "2027-04-11")).toBe(false);
  });

  it("is false after the race, and with no race set", () => {
    expect(isInsideAdaptationWindow("2027-04-12", "2027-04-11")).toBe(false);
    expect(isInsideAdaptationWindow("2027-04-01", null)).toBe(false);
  });
});
