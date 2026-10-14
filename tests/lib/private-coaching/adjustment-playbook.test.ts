import { describe, it, expect } from "vitest";
import {
  BAD_WORKOUT_STREAK_THRESHOLD,
  COMPLETION_NORM_NOTE,
  PROTECTED_FINAL_DAYS,
  RACE_REPLACEMENT_WINDOW_DAYS,
  badWorkoutGuidance,
  isGeneralPhaseKeySession,
  missedWorkoutGuidance,
  phaseFamily,
  planLengthChangeGuidance,
  raceReplacementTarget,
  rearrangeGuidance,
  suggestRaceReplacement,
} from "@/lib/private-coaching/adjustment-playbook";
import type { PlanHealthWorkout } from "@/lib/private-coaching/plan-health";

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

describe("phaseFamily", () => {
  it("matches the same tolerant way phase explainers do", () => {
    expect(phaseFamily("General")).toBe("general");
    expect(phaseFamily("general phase")).toBe("general");
    expect(phaseFamily("Supportive")).toBe("supportive");
    expect(phaseFamily("Phase: Specific")).toBe("specific");
  });

  it("returns unknown rather than guessing at a phase it doesn't recognise", () => {
    expect(phaseFamily("Sharpening")).toBe("unknown");
    expect(phaseFamily("Base")).toBe("unknown");
    expect(phaseFamily(null)).toBe("unknown");
    expect(phaseFamily(undefined)).toBe("unknown");
  });
});

describe("isGeneralPhaseKeySession", () => {
  it("recognises the long moderate and strong runs by what they prescribe", () => {
    expect(isGeneralPhaseKeySession(workout({ scheduledDate: "2027-01-04", prescription: "7 mi at 85% 5k" }))).toBe(true);
    expect(isGeneralPhaseKeySession(workout({ scheduledDate: "2027-01-04", prescription: "13-14 mi at 80% 5k" }))).toBe(true);
  });

  it("does not treat interval work as the protected progression", () => {
    // 95-100% 5k interval sessions genuinely are skippable in general work.
    expect(isGeneralPhaseKeySession(workout({ scheduledDate: "2027-01-04", prescription: "8 x 1 km at 95% 5k" }))).toBe(false);
    expect(isGeneralPhaseKeySession(workout({ scheduledDate: "2027-01-04", prescription: "10 x 2 min at 100% 5k" }))).toBe(false);
  });

  it("does not treat easy running or an optional session as protected", () => {
    expect(isGeneralPhaseKeySession(workout({ scheduledDate: "2027-01-04", prescription: "10 mi easy" }))).toBe(false);
    expect(
      isGeneralPhaseKeySession(workout({ scheduledDate: "2027-01-04", prescription: "7 mi at 85% 5k", isOptional: true })),
    ).toBe(false);
  });
});

describe("missedWorkoutGuidance", () => {
  it("says a plain general-phase session is safe to skip", () => {
    const guidance = missedWorkoutGuidance({
      phaseKey: "General",
      workout: workout({ scheduledDate: "2027-01-04", prescription: "8 x 1 km at 95% 5k" }),
    });
    expect(guidance.key).toBe("missed:general:ordinary");
    expect(guidance.title).toMatch(/Safe to skip/);
    expect(guidance.actions.join(" ")).toMatch(/carry on with the week/);
  });

  it("protects the general-phase long moderate and strong runs", () => {
    const guidance = missedWorkoutGuidance({
      phaseKey: "General",
      workout: workout({ scheduledDate: "2027-01-04", prescription: "1 mi warm-up / 7 mi at 85% 5k / 1 mi easy" }),
    });
    expect(guidance.key).toBe("missed:general:key-session");
    expect(guidance.actions.join(" ")).toMatch(/step the progression back/i);
  });

  it("never allows jumping ahead in the supportive or specific phases", () => {
    for (const phase of ["Supportive", "Specific"]) {
      const guidance = missedWorkoutGuidance({
        phaseKey: phase,
        workout: workout({ scheduledDate: "2027-03-01", prescription: "13 mi at 100% MP" }),
      });
      expect(guidance.detail).toMatch(/never to jump ahead/);
      // The standard recovery move from the chapter.
      expect(guidance.actions.join(" ")).toMatch(/three weeks of long fast work into two/);
    }
  });

  it("gives a generic rule for a phase it doesn't recognise", () => {
    const guidance = missedWorkoutGuidance({ phaseKey: "Sharpening", workout: workout({ scheduledDate: "2027-01-04" }) });
    expect(guidance.key).toBe("missed:unknown");
    expect(guidance.detail).toMatch(/no standard rule to apply/);
  });
});

describe("rearrangeGuidance", () => {
  it("tells the coach to move a key session together with its recovery days", () => {
    for (const phase of ["Supportive", "Specific"]) {
      const guidance = rearrangeGuidance(phase);
      expect(guidance.title).toMatch(/recovery days together/);
      expect(guidance.actions.join(" ")).toMatch(/as one block/);
    }
  });

  it("is more relaxed about the general phase", () => {
    const guidance = rearrangeGuidance("General");
    expect(guidance.title).toMatch(/free to move things around/);
  });
});

describe("raceReplacementTarget", () => {
  it("maps each race distance onto the session it stands in for", () => {
    expect(raceReplacementTarget(5000)).toMatchObject({ basis: "5k", bandMin: 98, bandMax: 102 });
    expect(raceReplacementTarget(8000)).toMatchObject({ basis: "5k", bandMin: 93, bandMax: 97 });
    expect(raceReplacementTarget(10000)).toMatchObject({ basis: "5k", bandMin: 93, bandMax: 97 });
    expect(raceReplacementTarget(15000)).toMatchObject({ basis: "5k", bandMin: 80, bandMax: 90 });
    expect(raceReplacementTarget(21097)).toMatchObject({ basis: "5k", bandMin: 80, bandMax: 90 });
  });

  it("is generous at the edges, because real courses are", () => {
    expect(raceReplacementTarget(9900)).toMatchObject({ bandMin: 93 });
    expect(raceReplacementTarget(10100)).toMatchObject({ bandMin: 93 });
    // A 10 miler should not fall through a gap.
    expect(raceReplacementTarget(16093)).toMatchObject({ bandMin: 80 });
  });

  it("refuses to treat anything past a half marathon as a substitution", () => {
    expect(raceReplacementTarget(30000)).toBeNull();
    expect(raceReplacementTarget(42195)).toBeNull();
    expect(raceReplacementTarget(0)).toBeNull();
  });
});

describe("suggestRaceReplacement", () => {
  const workouts = [
    workout({ scheduledDate: "2027-02-10", dayLabel: "Cruise intervals", prescription: "8 x 3 min at 90-92% 5k" }),
    workout({ scheduledDate: "2027-02-13", dayLabel: "Intervals", prescription: "10 x 2 min at 100% 5k" }),
    workout({ scheduledDate: "2027-02-27", dayLabel: "Far away", prescription: "10 x 2 min at 100% 5k" }),
  ];

  it("finds the nearby session a 5K would replace", () => {
    const result = suggestRaceReplacement({ raceDistanceM: 5000, raceDate: "2027-02-14", workouts });
    expect(result.candidates.map((c) => c.dayLabel)).toEqual(["Intervals"]);
    expect(result.guidance.detail).toMatch(/Replace that session rather than adding the race on top/);
    expect(result.guidance.actions.join(" ")).toMatch(/extra easy day in before the race/);
  });

  it("ignores matching sessions outside the window", () => {
    expect(RACE_REPLACEMENT_WINDOW_DAYS).toBe(5);
    const result = suggestRaceReplacement({ raceDistanceM: 5000, raceDate: "2027-02-14", workouts });
    expect(result.candidates.map((c) => c.dayLabel)).not.toContain("Far away");
  });

  it("matches a half marathon against the long strong-run band", () => {
    const result = suggestRaceReplacement({ raceDistanceM: 21097, raceDate: "2027-02-11", workouts });
    expect(result.candidates.map((c) => c.dayLabel)).toEqual(["Cruise intervals"]);
  });

  it("still gives guidance when nothing nearby matches", () => {
    const result = suggestRaceReplacement({
      raceDistanceM: 5000,
      raceDate: "2027-06-01",
      workouts: [workout({ scheduledDate: "2027-06-02", prescription: "8 mi easy" })],
    });
    expect(result.candidates).toEqual([]);
    expect(result.guidance.detail).toMatch(/check the week by hand/);
    // Still insists it comes out of the week rather than being added.
    expect(result.guidance.detail).toMatch(/rather than being added to it/);
  });

  it("treats anything past a half marathon as a plan rebuild, not a swap", () => {
    const result = suggestRaceReplacement({ raceDistanceM: 42195, raceDate: "2027-02-14", workouts });
    expect(result.target).toBeNull();
    expect(result.guidance.key).toBe("race-replacement:too-long");
    expect(result.guidance.detail).toMatch(/second goal race/);
  });

  it("never suggests replacing an optional session", () => {
    const result = suggestRaceReplacement({
      raceDistanceM: 5000,
      raceDate: "2027-02-14",
      workouts: [workout({ scheduledDate: "2027-02-14", prescription: "10 x 2 min at 100% 5k", isOptional: true })],
    });
    expect(result.candidates).toEqual([]);
  });
});

describe("badWorkoutGuidance", () => {
  it("tells the coach to stop a specific-phase marathon-pace session that is going badly", () => {
    const guidance = badWorkoutGuidance({
      phaseKey: "Specific",
      workout: workout({ scheduledDate: "2027-03-20", prescription: "5 x (5 km at 100% MP, 1 km at 90% MP)" }),
      consecutiveBad: 1,
    });
    expect(guidance.key).toBe("bad-workout:specific");
    expect(guidance.actions.join(" ")).toMatch(/Stop the session/);
    // Similar, not identical -- explicitly not a rematch.
    expect(guidance.actions.join(" ")).toMatch(/not the identical one/);
  });

  it("tells the coach to let the pace slide in general training", () => {
    const guidance = badWorkoutGuidance({
      phaseKey: "General",
      workout: workout({ scheduledDate: "2027-01-20", prescription: "8 x 3 min at 90% 5k" }),
      consecutiveBad: 1,
    });
    expect(guidance.key).toBe("bad-workout:general");
    expect(guidance.title).toMatch(/pace slide/);
  });

  it("hands a streak off to the fitness-estimate review", () => {
    expect(BAD_WORKOUT_STREAK_THRESHOLD).toBe(3);
    const guidance = badWorkoutGuidance({
      phaseKey: "Specific",
      workout: workout({ scheduledDate: "2027-03-20", prescription: "5 km at 100% MP" }),
      consecutiveBad: 3,
    });
    expect(guidance.key).toBe("bad-workout:streak");
    expect(guidance.actions.join(" ")).toMatch(/estimate review/);
    // Under-recovery and under-fuelling are named as co-equal candidates.
    expect(guidance.detail).toMatch(/Under-recovery and under-fuelling/);
    // And the one move that makes both worse is called out.
    expect(guidance.actions.join(" ")).toMatch(/Do not respond by pushing harder/);
  });

  it("prefers the streak rule over the phase rule once the streak is reached", () => {
    const guidance = badWorkoutGuidance({
      phaseKey: "General",
      workout: workout({ scheduledDate: "2027-01-20", prescription: "8 mi easy" }),
      consecutiveBad: 4,
    });
    expect(guidance.key).toBe("bad-workout:streak");
  });
});

describe("planLengthChangeGuidance", () => {
  const phases = [
    { phaseKey: "General", weeks: 8 },
    { phaseKey: "Supportive", weeks: 5 },
    { phaseKey: "Specific", weeks: 4 },
  ];

  it("shortens from the middle and protects the final days", () => {
    expect(PROTECTED_FINAL_DAYS).toEqual({ min: 8, max: 10 });
    const guidance = planLengthChangeGuidance({ direction: "shorten", phases, weeks: 2 });
    expect(guidance.title).toMatch(/keeping the last 8 to 10 days/);
    expect(guidance.detail).toMatch(/not the end of it/);
    expect(guidance.actions.join(" ")).toMatch(/three weeks of it into two/);
  });

  it("extends the shortest phase, and names it", () => {
    const guidance = planLengthChangeGuidance({ direction: "extend", phases, weeks: 3 });
    expect(guidance.title).toMatch(/Add 3 weeks to the shortest phase/);
    expect(guidance.detail).toMatch(/Specific is currently the shortest phase at 4 weeks/);
    expect(guidance.actions[0]).toBe("Extend Specific first.");
  });

  it("insists added weeks are variations rather than repeats", () => {
    const guidance = planLengthChangeGuidance({ direction: "extend", phases, weeks: 1 });
    expect(guidance.detail).toMatch(/identical session run twice is a test rather than a progression/);
    expect(guidance.actions.join(" ")).toMatch(/variations, not copies/);
  });

  it("handles a plan with no phases without throwing", () => {
    const guidance = planLengthChangeGuidance({ direction: "extend", phases: [], weeks: 1 });
    expect(guidance.detail).toMatch(/Add the time to the shortest phase/);
  });

  it("uses singular wording for one week", () => {
    expect(planLengthChangeGuidance({ direction: "extend", phases, weeks: 1 }).title).toMatch(/Add 1 week to/);
    expect(planLengthChangeGuidance({ direction: "shorten", phases, weeks: 1 }).detail).toMatch(/1 week out of/);
  });
});

describe("COMPLETION_NORM_NOTE", () => {
  it("normalises adjustment without framing it as a target", () => {
    expect(COMPLETION_NORM_NOTE).toMatch(/around 80%/);
    expect(COMPLETION_NORM_NOTE).toMatch(/not a sign it is going wrong/);
  });
});
