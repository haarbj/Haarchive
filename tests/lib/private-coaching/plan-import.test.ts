import { describe, expect, it } from "vitest";

import { resolvePlanImport, type AthleteReferenceInputs } from "@/lib/private-coaching/plan-import";
import type { TrainingPlan, RawWorkout } from "@/lib/training-plans/types";
import { MILE_METERS } from "@/lib/race-distances";

// Week 1: Rest, Easy, Intervals (rep-structured + 5k effort), Easy (very
// easy), Tempo, an AM/PM split day, and a plain-prose long run with no
// distinguishing keyword -- the exact shape real Tornado-style weeks take
// (confirmed against the real plan data during planning), not invented
// vocabulary.
const WEEK_1: RawWorkout[] = [
  { description: "Rest", totalDistance: 0 },
  { description: "[[6 * multiplier|number:0]] [[units]] easy", totalDistance: 6 },
  { description: "8 x 400m at 95% 5k with 90 sec jog", totalDistance: 6 },
  { description: "[[6 * multiplier|number:0]] [[units]] very easy", totalDistance: 6 },
  { description: "[[5 * multiplier|number:0]] [[units]] tempo effort", totalDistance: 6 },
  {
    description:
      "AM: [[4 * multiplier|number:0]] [[units]] very easy / PM: [[7 * multiplier|number:0]]-[[9 * multiplier|number:0]] [[units]] easy with strides",
    totalDistance: 11,
  },
  { description: "[[12 * multiplier|number:0]] [[units]] at 85-90% MP through rolling hills", totalDistance: 12 },
];

// Week 2: deliberately simple -- one easy day, one rest day, nothing else
// -- to isolate week-boundary date math and per-week target totals from
// week 1's richer classification cases.
const WEEK_2: RawWorkout[] = [
  { description: "[[4 * multiplier|number:0]] [[units]] easy", totalDistance: 4 },
  { description: "Rest", totalDistance: 0 },
  { description: "[[4 * multiplier|number:0]] [[units]] easy", totalDistance: 4 },
  { description: "Rest", totalDistance: 0 },
  { description: "[[4 * multiplier|number:0]] [[units]] easy", totalDistance: 4 },
  { description: "Rest", totalDistance: 0 },
  { description: "[[10 * multiplier|number:0]] [[units]] at 85-90% MP through rolling hills", totalDistance: 10 },
];

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    slug: "test-2",
    track: "tornado",
    trackLabel: "Tornado",
    durationWeeks: 2 as unknown as TrainingPlan["durationWeeks"],
    raceType: "Marathon",
    raceDistanceMiles: 26.2,
    workouts: [...WEEK_1, ...WEEK_2],
    referencePeakWeeklyMiles: 47, // week 1's own total at scale 1
    referenceAvgWeeklyMiles: 33.5,
    referenceTotalMiles: 67,
    ...overrides,
  };
}

const mi = (m: number) => Math.round(m * MILE_METERS);

describe("resolvePlanImport", () => {
  it("produces no row at all for a literal Rest entry", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const restDate = "2026-09-14"; // week 1, day 1
    expect(result.days.some((d) => d.scheduledDate === restDate)).toBe(false);
  });

  it("maps Day 1 of week 1 onto the given start date, incrementing daily", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const dates = [...new Set(result.days.map((d) => d.scheduledDate))].sort();
    expect(dates[0]).toBe("2026-09-15"); // day 2 (day 1 was Rest)
    expect(dates).toContain("2026-09-20"); // day 7 of week 1
  });

  it("lands week 2 exactly 7 days after week 1", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const week2Dates = result.days.filter((d) => d.scheduledDate >= "2026-09-21").map((d) => d.scheduledDate);
    expect(week2Dates).toContain("2026-09-21"); // week 2 day 1
    expect(week2Dates).toContain("2026-09-27"); // week 2 day 7
  });

  it("reports the correct endDate for a 2-week plan", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    expect(result.endDate).toBe("2026-09-27");
  });

  it("classifies a rep-structured 5k-effort day as Intervals", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const day = result.days.find((d) => d.scheduledDate === "2026-09-16")!; // week1 day3
    expect(day.dayLabel).toBe("Intervals");
  });

  it("classifies plain easy/very-easy days as Easy", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const day = result.days.find((d) => d.scheduledDate === "2026-09-15")!; // week1 day2
    expect(day.dayLabel).toBe("Easy");
  });

  it("classifies a tempo-effort day as Tempo", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const day = result.days.find((d) => d.scheduledDate === "2026-09-18")!; // week1 day5
    expect(day.dayLabel).toBe("Tempo");
  });

  it("promotes the week's single largest unclassified entry to Long Run", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const day = result.days.find((d) => d.scheduledDate === "2026-09-20")!; // week1 day7, 12mi
    expect(day.dayLabel).toBe("Long Run");
  });

  it("splits an AM/PM entry into two rows with their own session slots, labels, and distances that sum to the day's own totalDistance", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const split = result.days.filter((d) => d.scheduledDate === "2026-09-19"); // week1 day6, totalDistance 11
    expect(split).toHaveLength(2);
    const am = split.find((d) => d.sessionSlot === "AM")!;
    const pm = split.find((d) => d.sessionSlot === "PM")!;
    // Apportioned from the day's own totalDistance (11) by each half's
    // parsed-from-text weight (AM "4 mi" vs PM "7-9 mi" -> weight 7), not
    // re-derived independently from prose -- see resolveDay's own comment
    // on why that drifted from the day/week total the public Training
    // Plans page shows for the same scale. Single point values (no
    // range), matching that same page's "always one number" convention.
    expect(am.plannedDistanceM).toBe(mi(4));
    expect(am.plannedDistanceMaxM).toBeNull();
    expect(pm.plannedDistanceM).toBe(mi(7));
    expect(pm.plannedDistanceMaxM).toBeNull();
    // Within a meter of the day's own totalDistance -- each half is
    // independently rounded to the nearest meter, so a 1-meter rounding
    // gap between the two sums is expected, not a real drift.
    expect(Math.abs(am.plannedDistanceM! + pm.plannedDistanceM! - mi(11))).toBeLessThanOrEqual(1);
  });

  it("at scale 1.0 (target peak equals reference peak), leaves distances unchanged from source totalDistance", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const day = result.days.find((d) => d.scheduledDate === "2026-09-15")!; // 6mi easy day
    expect(day.plannedDistanceM).toBe(mi(6));
  });

  it("scales every distance uniformly when the target peak differs from the reference peak", () => {
    const result = resolvePlanImport(plan(), 94, "2026-09-14"); // scale = 2
    const day = result.days.find((d) => d.scheduledDate === "2026-09-15")!; // 6mi -> 12mi
    expect(day.plannedDistanceM).toBe(mi(12));
    const longRun = result.days.find((d) => d.scheduledDate === "2026-09-20")!; // 12mi -> 24mi
    expect(longRun.plannedDistanceM).toBe(mi(24));
  });

  it("computes each week's target as the sum of that week's own resolved distances", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    // week 1: 6 + 6 + 6 + 6 + (4 + 7) + 12 = 47 (Rest contributes 0)
    expect(result.weeks[0]).toEqual({ weekStart: "2026-09-14", targetVolumeMin: 47 });
    // week 2: 4 + 4 + 4 + 10 = 22 (three Rest days contribute 0)
    expect(result.weeks[1]).toEqual({ weekStart: "2026-09-21", targetVolumeMin: 22 });
  });

  it("preserves the full rendered description verbatim in notesFromCoach even when the label guess is generic", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const longRun = result.days.find((d) => d.scheduledDate === "2026-09-20")!;
    expect(longRun.notesFromCoach).toBe("12 mi at 85-90% MP through rolling hills");
  });

  it("leaves pace and HR targets null when no athlete reference inputs are given at all", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14");
    const intervals = result.days.find((d) => d.scheduledDate === "2026-09-16")!;
    const easy = result.days.find((d) => d.scheduledDate === "2026-09-15")!;
    expect(intervals.plannedPaceSPerMi).toBeNull();
    expect(easy.plannedHrBpm).toBeNull();
  });
});

describe("resolvePlanImport -- pace-percent and heart-rate-reserve targets", () => {
  // 5K pace 6:00/mi (360s), marathon pace 7:00/mi (420s) -- round numbers
  // chosen for hand-checkable arithmetic, not real-world paces.
  const inputs: AthleteReferenceInputs = { restingHr: 50, maxHr: 190, fiveKPaceSPerMi: 360, marathonPaceSPerMi: 420 };

  it("computes a real pace range for a %5k quality day, Canova's percent-of-pace convention (higher % is faster)", () => {
    const p = plan({ workouts: [{ description: "8-9 x 3 min at 96-102% 5k with 45 sec jog", totalDistance: 6 }, ...WEEK_1.slice(1), ...WEEK_2] });
    const result = resolvePlanImport(p, 47, "2026-09-14", inputs);
    const day = result.days.find((d) => d.scheduledDate === "2026-09-14")!;
    // 96% -> 360*(2-0.96) = 374.4 -> 374 (slower/larger seconds)
    // 102% -> 360*(2-1.02) = 352.8 -> 353 (faster/smaller seconds)
    expect(day.plannedPaceSPerMi).toBe(353);
    expect(day.plannedPaceMaxSPerMi).toBe(374);
  });

  it("computes a single point pace (no max) for a single-percent %5k day", () => {
    const p = plan({ workouts: [{ description: "1 min at 95% 5k effort, 3 min easy", totalDistance: 6 }, ...WEEK_1.slice(1), ...WEEK_2] });
    const result = resolvePlanImport(p, 47, "2026-09-14", inputs);
    const day = result.days.find((d) => d.scheduledDate === "2026-09-14")!;
    // 95% -> 360*(2-0.95) = 378
    expect(day.plannedPaceSPerMi).toBe(378);
    expect(day.plannedPaceMaxSPerMi).toBeNull();
  });

  it("computes a real pace range for a %MP day using the marathon-pace reference instead of 5K", () => {
    const p = plan({ workouts: [{ description: "2km repeats at 108-110% MP", totalDistance: 6 }, ...WEEK_1.slice(1), ...WEEK_2] });
    const result = resolvePlanImport(p, 47, "2026-09-14", inputs);
    const day = result.days.find((d) => d.scheduledDate === "2026-09-14")!;
    // 108% -> 420*(2-1.08) = 386.4 -> 386 (slower), 110% -> 420*(2-1.10) = 378 (faster)
    expect(day.plannedPaceSPerMi).toBe(378);
    expect(day.plannedPaceMaxSPerMi).toBe(386);
  });

  it("leaves the pace target null when the needed reference (5k or marathon) wasn't provided", () => {
    const p = plan({ workouts: [{ description: "8-9 x 3 min at 96-102% 5k", totalDistance: 6 }, ...WEEK_1.slice(1), ...WEEK_2] });
    const result = resolvePlanImport(p, 47, "2026-09-14", { ...inputs, fiveKPaceSPerMi: null });
    const day = result.days.find((d) => d.scheduledDate === "2026-09-14")!;
    expect(day.plannedPaceSPerMi).toBeNull();
  });

  it("gives an Easy day a 55-65% HRR range", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14", inputs);
    const easy = result.days.find((d) => d.scheduledDate === "2026-09-15")!; // week1 day2, "easy"
    // HRR = 190-50 = 140. 55% -> 50+77=127. 65% -> 50+91=141.
    expect(easy.plannedHrBpm).toBe(127);
    expect(easy.plannedHrMaxBpm).toBe(141);
  });

  it("gives a Very Easy day a lower 45-60% HRR range, distinct from plain Easy", () => {
    const p = plan({ workouts: [{ description: "[[6 * multiplier|number:0]] [[units]] very easy", totalDistance: 6 }, ...WEEK_1.slice(1), ...WEEK_2] });
    const result = resolvePlanImport(p, 47, "2026-09-14", inputs);
    const veryEasy = result.days.find((d) => d.scheduledDate === "2026-09-14")!;
    expect(veryEasy.dayLabel).toBe("Very Easy");
    // 45% -> 50+63=113. 60% -> 50+84=134.
    expect(veryEasy.plannedHrBpm).toBe(113);
    expect(veryEasy.plannedHrMaxBpm).toBe(134);
  });

  it("never assigns an HR target to a quality/long-run day, only Easy/Very Easy", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14", inputs);
    const intervals = result.days.find((d) => d.scheduledDate === "2026-09-16")!;
    const longRun = result.days.find((d) => d.scheduledDate === "2026-09-20")!;
    expect(intervals.plannedHrBpm).toBeNull();
    expect(longRun.plannedHrBpm).toBeNull();
  });

  it("leaves HR targets null when resting/max HR weren't provided", () => {
    const result = resolvePlanImport(plan(), 47, "2026-09-14", { ...inputs, restingHr: null });
    const easy = result.days.find((d) => d.scheduledDate === "2026-09-15")!;
    expect(easy.plannedHrBpm).toBeNull();
  });
});
