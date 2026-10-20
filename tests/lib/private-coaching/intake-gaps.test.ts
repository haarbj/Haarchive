import { describe, expect, it } from "vitest";

import { evaluateIntakeGaps, type IntakeGapInput } from "@/lib/private-coaching/intake-gaps";

function complete(overrides: Partial<IntakeGapInput> = {}): IntakeGapInput {
  return {
    hasGoalRace: true,
    hasFitnessAnchor: true,
    trainingFacilities: ["track", "trails"],
    homeAltitudeM: 150,
    recentTrainingDetail: "Typical week is 40 miles with a 14 mile long run Saturday and a tempo Wednesday at 6:30 pace.",
    injuryLimitations: "None",
    runningDaysPerWeek: 5,
    longRunDay: "Saturday",
    ...overrides,
  };
}

describe("evaluateIntakeGaps -- a fully answered intake", () => {
  it("every item is complete and nothing is missing", () => {
    const result = evaluateIntakeGaps(complete());
    expect(result.isComplete).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.items).toHaveLength(7);
  });
});

describe("goal_race / fitness_anchor -- already-covered items read from their real sources", () => {
  it("missing when the caller reports neither source present", () => {
    const result = evaluateIntakeGaps(complete({ hasGoalRace: false, hasFitnessAnchor: false }));
    expect(result.missing.map((m) => m.key)).toEqual(expect.arrayContaining(["goal_race", "fitness_anchor"]));
  });

  it("complete when the caller reports a goal race or fitness anchor exists, regardless of this module's own storage -- it never re-derives either", () => {
    const result = evaluateIntakeGaps(complete());
    expect(result.items.find((i) => i.key === "goal_race")!.complete).toBe(true);
    expect(result.items.find((i) => i.key === "fitness_anchor")!.complete).toBe(true);
  });
});

describe("training_facilities", () => {
  it("null is missing", () => {
    const result = evaluateIntakeGaps(complete({ trainingFacilities: null }));
    expect(result.items.find((i) => i.key === "training_facilities")!.complete).toBe(false);
  });

  it("an empty array is missing -- never asked, not 'no facilities'", () => {
    const result = evaluateIntakeGaps(complete({ trainingFacilities: [] }));
    expect(result.items.find((i) => i.key === "training_facilities")!.complete).toBe(false);
  });

  it("at least one selected facility is complete", () => {
    const result = evaluateIntakeGaps(complete({ trainingFacilities: ["treadmill"] }));
    expect(result.items.find((i) => i.key === "training_facilities")!.complete).toBe(true);
  });
});

describe("home_altitude", () => {
  it("null is missing", () => {
    const result = evaluateIntakeGaps(complete({ homeAltitudeM: null }));
    expect(result.items.find((i) => i.key === "home_altitude")!.complete).toBe(false);
  });

  it("boundary: sea level (0) is a real, complete answer -- never treated as falsy-missing", () => {
    const result = evaluateIntakeGaps(complete({ homeAltitudeM: 0 }));
    expect(result.items.find((i) => i.key === "home_altitude")!.complete).toBe(true);
  });
});

describe("recent_training -- not just weekly mileage, a real baseline", () => {
  it("null is missing", () => {
    const result = evaluateIntakeGaps(complete({ recentTrainingDetail: null }));
    expect(result.items.find((i) => i.key === "recent_training")!.complete).toBe(false);
  });

  it("empty string is missing", () => {
    const result = evaluateIntakeGaps(complete({ recentTrainingDetail: "" }));
    expect(result.items.find((i) => i.key === "recent_training")!.complete).toBe(false);
  });

  it("boundary: exactly one word is missing", () => {
    const result = evaluateIntakeGaps(complete({ recentTrainingDetail: "Fine" }));
    expect(result.items.find((i) => i.key === "recent_training")!.complete).toBe(false);
  });

  it("boundary: two words is complete -- the stated threshold is 'more than one word,' not a length minimum", () => {
    const result = evaluateIntakeGaps(complete({ recentTrainingDetail: "Pretty good" }));
    expect(result.items.find((i) => i.key === "recent_training")!.complete).toBe(true);
  });

  it("extra whitespace alone never manufactures a second word", () => {
    const result = evaluateIntakeGaps(complete({ recentTrainingDetail: "  Fine   " }));
    expect(result.items.find((i) => i.key === "recent_training")!.complete).toBe(false);
  });
});

describe("injury_limitations -- an explicit 'none' counts as complete; unasked does not", () => {
  it("null is missing (unasked)", () => {
    const result = evaluateIntakeGaps(complete({ injuryLimitations: null }));
    expect(result.items.find((i) => i.key === "injury_limitations")!.complete).toBe(false);
  });

  it("empty string is missing", () => {
    const result = evaluateIntakeGaps(complete({ injuryLimitations: "" }));
    expect(result.items.find((i) => i.key === "injury_limitations")!.complete).toBe(false);
  });

  it("an explicit 'None' is complete -- a real answer, not a gap", () => {
    const result = evaluateIntakeGaps(complete({ injuryLimitations: "None" }));
    expect(result.items.find((i) => i.key === "injury_limitations")!.complete).toBe(true);
  });

  it("a one-word real answer is still complete here -- unlike recent_training, no word-count threshold applies to injuries", () => {
    const result = evaluateIntakeGaps(complete({ injuryLimitations: "none" }));
    expect(result.items.find((i) => i.key === "injury_limitations")!.complete).toBe(true);
  });
});

describe("schedule_constraints -- days available and a long-run day", () => {
  it("missing without a days-per-week answer", () => {
    const result = evaluateIntakeGaps(complete({ runningDaysPerWeek: null }));
    expect(result.items.find((i) => i.key === "schedule_constraints")!.complete).toBe(false);
  });

  it("missing without a long-run day", () => {
    const result = evaluateIntakeGaps(complete({ longRunDay: null }));
    expect(result.items.find((i) => i.key === "schedule_constraints")!.complete).toBe(false);
  });

  it("complete once both are answered", () => {
    const result = evaluateIntakeGaps(complete({ runningDaysPerWeek: 4, longRunDay: "Sunday" }));
    expect(result.items.find((i) => i.key === "schedule_constraints")!.complete).toBe(true);
  });
});

describe("every missing item carries real athlete-facing and coach-facing copy", () => {
  it("nothing is blank, and every athleteHref is a real path", () => {
    const result = evaluateIntakeGaps({
      hasGoalRace: false,
      hasFitnessAnchor: false,
      trainingFacilities: null,
      homeAltitudeM: null,
      recentTrainingDetail: null,
      injuryLimitations: null,
      runningDaysPerWeek: null,
      longRunDay: null,
    });
    expect(result.missing).toHaveLength(7);
    for (const item of result.missing) {
      expect(item.athletePrompt.length).toBeGreaterThan(10);
      expect(item.coachLabel.length).toBeGreaterThan(3);
      expect(item.athleteHref.startsWith("/")).toBe(true);
    }
  });
});
