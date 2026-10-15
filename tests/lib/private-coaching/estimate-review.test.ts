import { describe, it, expect } from "vitest";
import {
  DETERIORATION_REVIEW_COUNT,
  EVIDENCE_BANDS,
  MIN_TOTAL_WEIGHT,
  detectDeterioration,
  hasAdverseConditions,
  impliedReferenceSecondsPerMile,
  isSingleSegmentSession,
  proposeEstimateReview,
  raceEvidenceNote,
  weighSession,
  weightedMedian,
  type PastReview,
  type ReviewSession,
} from "@/lib/private-coaching/estimate-review";
import { MILE_METERS } from "@/lib/race-distances";

function session(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    id: "s1",
    scheduledDate: "2027-03-01",
    dayLabel: null,
    prescription: "13 mi at 100% MP",
    plannedRpe: 8,
    plannedRpeMax: 9,
    phaseKey: "Specific",
    isOptional: false,
    actualDistanceM: null,
    actualDurationS: null,
    rpe: 8,
    effortLevel: null,
    conditionsNotes: null,
    painReported: false,
    ...overrides,
  };
}

describe("isSingleSegmentSession", () => {
  it("accepts a prescription that is one continuous pace clause and nothing else", () => {
    expect(isSingleSegmentSession("13 mi at 100% MP")).toBe(true);
    expect(isSingleSegmentSession("9-10 mi at 98-100% MP")).toBe(true);
    expect(isSingleSegmentSession("10 mi at 95% MP pace")).toBe(true);
    expect(isSingleSegmentSession("6 km at 90% 5k")).toBe(true);
  });

  it("rejects anything whose logged average pace would be a blend", () => {
    // These are the cases a blocklist let through, which is why the test
    // is an allowlist: attributing a whole easy run's average to a 95% 5K
    // target would put a wrong number on the coach's screen.
    expect(isSingleSegmentSession("2 mi warm-up / 10 mi at 100% MP / 1 mi easy")).toBe(false);
    expect(
      isSingleSegmentSession("6-8 mi easy with 28 min of (1 min at ~95% 5k effort, 3 min easy) in the middle"),
    ).toBe(false);
    expect(isSingleSegmentSession("5-6 mi moderate progressing to strong (~80% to 100% MP)")).toBe(false);
    expect(isSingleSegmentSession("5 x (1 km at 105% MP, 1 km at 90% MP)")).toBe(false);
    expect(isSingleSegmentSession("8-10 mi easy")).toBe(false);
    expect(isSingleSegmentSession(null)).toBe(false);
  });
});

describe("impliedReferenceSecondsPerMile", () => {
  it("inverts the percent-of-pace formula exactly", () => {
    // A 100% MP session is by definition run at marathon pace.
    const at100 = impliedReferenceSecondsPerMile(
      session({ prescription: "13 mi at 100% MP", actualDistanceM: 13 * MILE_METERS, actualDurationS: 13 * 420 }),
    );
    expect(at100!.basis).toBe("marathon");
    expect(Math.round(at100!.secondsPerMile)).toBe(420);
  });

  it("agrees with itself across different prescribed percentages", () => {
    // 105% of a 7:00 marathon pace is 6:39; running that should imply the
    // same ~7:00 reference back.
    const at105 = impliedReferenceSecondsPerMile(
      session({ prescription: "6 mi at 105% MP", actualDistanceM: 6 * MILE_METERS, actualDurationS: 6 * 399 }),
    );
    expect(Math.round(at105!.secondsPerMile)).toBe(420);
  });

  it("implies a slower reference when the athlete ran slower than the target", () => {
    const slow = impliedReferenceSecondsPerMile(
      session({ prescription: "13 mi at 100% MP", actualDistanceM: 13 * MILE_METERS, actualDurationS: 13 * 450 }),
    );
    expect(slow!.secondsPerMile).toBeGreaterThan(420);
  });

  it("uses the midpoint of a prescribed range", () => {
    const ranged = impliedReferenceSecondsPerMile(
      session({ prescription: "13 mi at 98-102% MP", actualDistanceM: 13 * MILE_METERS, actualDurationS: 13 * 420 }),
    );
    // Midpoint is 100%, so the implied reference is the pace run.
    expect(Math.round(ranged!.secondsPerMile)).toBe(420);
  });

  it("returns null rather than guessing when the session cannot support a number", () => {
    expect(
      impliedReferenceSecondsPerMile(
        session({ prescription: "2 mi warm-up / 10 mi at 100% MP / 1 mi easy", actualDistanceM: 13 * MILE_METERS, actualDurationS: 13 * 420 }),
      ),
    ).toBeNull();
    // No logged result at all.
    expect(impliedReferenceSecondsPerMile(session({ prescription: "13 mi at 100% MP" }))).toBeNull();
    expect(
      impliedReferenceSecondsPerMile(session({ prescription: "13 mi at 100% MP", actualDistanceM: 0, actualDurationS: 100 })),
    ).toBeNull();
  });
});

describe("hasAdverseConditions", () => {
  it("spots a day the athlete flagged themselves", () => {
    expect(hasAdverseConditions("90F and humid, felt awful")).toBe(true);
    expect(hasAdverseConditions("Slept badly, legs heavy")).toBe(true);
    expect(hasAdverseConditions("Strong headwind on the way back")).toBe(true);
  });

  it("does not fire on a clean note or no note", () => {
    expect(hasAdverseConditions("Perfect morning, felt smooth")).toBe(false);
    expect(hasAdverseConditions(null)).toBe(false);
    expect(hasAdverseConditions("")).toBe(false);
  });
});

describe("weighSession", () => {
  it("weights an in-band session where effort matched the prescription highest", () => {
    const w = weighSession(session({ prescription: "13 mi at 100% MP", rpe: 9 }));
    expect(w.weight).toBe(1);
    expect(w.reasons.join(" ")).toMatch(/squarely in the band/);
    expect(w.reasons.join(" ")).toMatch(/Effort matched/);
  });

  it("excludes sessions that say nothing about the estimate", () => {
    expect(weighSession(session({ prescription: "10 mi easy" })).weight).toBe(0);
    expect(weighSession(session({ isOptional: true })).weight).toBe(0);
    expect(weighSession(session({ rpe: null })).weight).toBe(0);
    expect(weighSession(session({ phaseKey: "Sharpening" })).weight).toBe(0);
  });

  it("reads the general phase against 5K pace and the later phases against marathon pace", () => {
    expect(EVIDENCE_BANDS.general).toEqual({ basis: "5k", min: 90, max: 100 });
    expect(EVIDENCE_BANDS.specific).toEqual({ basis: "marathon", min: 90, max: 105 });
    // A marathon-pace session tells you nothing in the general phase.
    expect(weighSession(session({ phaseKey: "General", prescription: "13 mi at 100% MP" })).weight).toBe(0);
    expect(weighSession(session({ phaseKey: "General", prescription: "6 mi at 95% 5k" })).weight).toBeGreaterThan(0);
  });

  it("keeps a hero effort's full weight for direction but discounts it for a number", () => {
    // Deliberately NOT down-weighted for direction. A session run at the
    // prescribed pace that felt three points harder is the clearest
    // evidence an estimate is optimistic, and discounting it was a real
    // bug: two unambiguous sessions came back as "not enough evidence".
    // It IS discounted for proposing a number, because burying yourself to
    // hold a pace produces an implied reference that flatters you.
    const hero = weighSession(session({ rpe: 10, plannedRpe: 7, plannedRpeMax: 7 }));
    const matched = weighSession(session({ rpe: 7, plannedRpe: 7, plannedRpeMax: 7 }));
    expect(hero.weight).toBe(matched.weight);
    expect(hero.paceWeight).toBeLessThan(matched.paceWeight);
    expect(hero.reasons.join(" ")).toMatch(/weak evidence for a number/);
  });

  it("never lets pace weight exceed direction weight", () => {
    for (const s of [
      session(),
      session({ rpe: 10, plannedRpe: 7, plannedRpeMax: 7 }),
      session({ conditionsNotes: "hot" }),
      session({ painReported: true }),
      session({ plannedRpe: null, plannedRpeMax: null }),
    ]) {
      const w = weighSession(s);
      expect(w.paceWeight).toBeLessThanOrEqual(w.weight);
    }
  });

  it("down-weights flagged conditions and reported pain", () => {
    const clean = weighSession(session());
    const windy = weighSession(session({ conditionsNotes: "very windy" }));
    const hurt = weighSession(session({ painReported: true }));
    expect(windy.weight).toBeLessThan(clean.weight);
    expect(hurt.weight).toBeLessThan(windy.weight);
    expect(hurt.reasons.join(" ")).toMatch(/Pain was reported/);
  });

  it("compares effort against the top of a prescribed range", () => {
    // "7-9/10" is not supposed to feel like a 7, so an RPE of 9 matches.
    const w = weighSession(session({ plannedRpe: 7, plannedRpeMax: 9, rpe: 9 }));
    expect(w.reasons.join(" ")).toMatch(/Effort matched/);
  });
});

describe("weightedMedian", () => {
  it("returns the typical value rather than the mean or the best", () => {
    // One very fast outlier must not drag the answer.
    expect(weightedMedian([
      { value: 420, weight: 1 },
      { value: 425, weight: 1 },
      { value: 360, weight: 1 },
    ])).toBe(420);
  });

  it("respects weights", () => {
    expect(weightedMedian([
      { value: 400, weight: 0.1 },
      { value: 440, weight: 5 },
    ])).toBe(440);
  });

  it("ignores zero-weight and non-finite values, and handles nothing usable", () => {
    expect(weightedMedian([{ value: 400, weight: 0 }])).toBeNull();
    expect(weightedMedian([])).toBeNull();
    expect(weightedMedian([{ value: Number.NaN, weight: 1 }])).toBeNull();
  });
});

describe("proposeEstimateReview", () => {
  const marathonM = 42195;

  it("says so plainly when there is not enough evidence", () => {
    const review = proposeEstimateReview({
      sessions: [session({ prescription: "10 mi easy" })],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    expect(review.verdict).toBe("not-enough-evidence");
    expect(review.proposedTimeS).toBeNull();
    expect(review.notes.join(" ")).toMatch(/Not enough usable sessions/);
    expect(MIN_TOTAL_WEIGHT).toBe(1);
  });

  it("calls an estimate optimistic when the sessions consistently felt harder than prescribed", () => {
    const review = proposeEstimateReview({
      sessions: [
        session({ id: "a", prescription: "13 mi at 100% MP", plannedRpe: 8, plannedRpeMax: 8, rpe: 10 }),
        session({ id: "b", prescription: "10 mi at 98-100% MP", plannedRpe: 8, plannedRpeMax: 8, rpe: 10 }),
      ],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    expect(review.verdict).toBe("looks-optimistic");
    expect(review.notes.join(" ")).toMatch(/felt about 2 points harder/);
  });

  it("calls an estimate conservative when the sessions felt easier than prescribed", () => {
    const review = proposeEstimateReview({
      sessions: [
        session({ id: "a", prescription: "13 mi at 100% MP", plannedRpe: 9, plannedRpeMax: 9, rpe: 7 }),
        session({ id: "b", prescription: "12 mi at 100% MP", plannedRpe: 9, plannedRpeMax: 9, rpe: 7 }),
      ],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    expect(review.verdict).toBe("looks-conservative");
  });

  it("calls a tracking estimate about right", () => {
    const review = proposeEstimateReview({
      sessions: [
        session({ id: "a", prescription: "13 mi at 100% MP", plannedRpe: 9, plannedRpeMax: 9, rpe: 9 }),
        session({ id: "b", prescription: "12 mi at 100% MP", plannedRpe: 8, plannedRpeMax: 9, rpe: 9 }),
      ],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    expect(review.verdict).toBe("about-right");
    expect(review.notes.join(" ")).toMatch(/what a good estimate looks like/);
  });

  it("refuses to invent a number when no session can supply one", () => {
    // Every framework session has a warm-up, so this is the normal case.
    const review = proposeEstimateReview({
      sessions: [
        session({ id: "a", prescription: "2 mi warm-up / 13 mi at 100% MP / 1 mi easy", rpe: 10, plannedRpe: 8, plannedRpeMax: 8, actualDistanceM: 16 * MILE_METERS, actualDurationS: 16 * 430 }),
      ],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    expect(review.proposedTimeS).toBeNull();
    expect(review.verdict).toBe("looks-optimistic");
    expect(review.notes.join(" ")).toMatch(/No number is proposed/);
    expect(review.notes.join(" ")).toMatch(/blended average/);
  });

  it("proposes a real time from a session whose whole prescription is one pace", () => {
    const review = proposeEstimateReview({
      sessions: [
        session({ id: "a", prescription: "13 mi at 100% MP", rpe: 9, actualDistanceM: 13 * MILE_METERS, actualDurationS: 13 * 420 }),
      ],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    // 420 s/mi over 26.2187 miles.
    expect(review.proposedTimeS).toBe(Math.round(420 * (marathonM / MILE_METERS)));
    expect(review.notes.join(" ")).toMatch(/weighted middle of those, not the best of them/);
  });

  it("reads the general phase against the 5K estimate", () => {
    const review = proposeEstimateReview({
      sessions: [session({ phaseKey: "General", prescription: "6 mi at 95% 5k", rpe: 8 })],
      phaseKey: "General",
      currentTimeS: 1000,
      referenceDistanceM: 5000,
    });
    expect(review.basis).toBe("5k");
  });

  it("lists the sessions that counted, heaviest first, with their reasons", () => {
    const review = proposeEstimateReview({
      sessions: [
        session({ id: "weak", prescription: "13 mi at 100% MP", rpe: 9, conditionsNotes: "very hot and humid" }),
        session({ id: "strong", prescription: "13 mi at 100% MP", rpe: 9 }),
      ],
      phaseKey: "Specific",
      currentTimeS: 11000,
      referenceDistanceM: marathonM,
    });
    expect(review.contributions.map((c) => c.session.id)).toEqual(["strong", "weak"]);
    expect(review.contributions[1].reasons.join(" ")).toMatch(/flagged conditions/);
  });
});

describe("detectDeterioration", () => {
  function review(estimateTimeS: number, day: number, workCompleted = true): PastReview {
    return { reviewedAt: `2027-01-${String(day).padStart(2, "0")}T00:00:00Z`, estimateTimeS, workCompleted };
  }

  it("flags three consecutive slower estimates while the work was getting done", () => {
    expect(DETERIORATION_REVIEW_COUNT).toBe(3);
    const flag = detectDeterioration([review(11000, 1), review(11200, 15), review(11500, 29)]);
    expect(flag.flagged).toBe(true);
    expect(flag.detail).toMatch(/over-reaching and under-recovery/);
    expect(flag.actions.join(" ")).toMatch(/until the cause is identified rather than until the numbers improve/);
  });

  it("does not flag when the athlete was not completing the work", () => {
    // A slower estimate through a block that did not happen is just a plan
    // not happening.
    const flag = detectDeterioration([review(11000, 1), review(11200, 15, false), review(11500, 29)]);
    expect(flag.flagged).toBe(false);
  });

  it("does not flag an improving or flat trend", () => {
    expect(detectDeterioration([review(11500, 1), review(11200, 15), review(11000, 29)]).flagged).toBe(false);
    expect(detectDeterioration([review(11000, 1), review(11000, 15), review(11000, 29)]).flagged).toBe(false);
  });

  it("does not flag a single dip inside an otherwise fine trend", () => {
    const flag = detectDeterioration([review(11000, 1), review(11300, 15), review(11100, 29)]);
    expect(flag.flagged).toBe(false);
  });

  it("needs enough history before saying anything", () => {
    expect(detectDeterioration([review(11000, 1), review(11500, 15)]).flagged).toBe(false);
    expect(detectDeterioration([]).flagged).toBe(false);
  });

  it("looks only at the most recent reviews", () => {
    // An old improvement must not cancel a current decline.
    const flag = detectDeterioration([
      review(12000, 1),
      review(11000, 8),
      review(11100, 15),
      review(11300, 22),
      review(11600, 29),
    ]);
    expect(flag.flagged).toBe(true);
  });

  it("never diagnoses, and routes persistent trouble to a professional", () => {
    const flag = detectDeterioration([review(11000, 1), review(11200, 15), review(11500, 29)]);
    expect(flag.actions.join(" ")).toMatch(/medical professional/);
  });
});

describe("raceEvidenceNote (Part F: a race time is a race time whoever coached it)", () => {
  it("returns null when there's no recent race on file", () => {
    expect(raceEvidenceNote(null)).toBeNull();
  });

  it("flags a real race result as the strongest evidence, with no mention of training source", () => {
    const note = raceEvidenceNote({ raceName: "City 5K", raceDate: "2027-02-01", timeS: 957 });
    expect(note).toMatch(/City 5K/);
    expect(note).toMatch(/strongest evidence/);
    expect(note).toMatch(/regardless of who coached the training/);
    // The note itself carries no concept of training source -- it never
    // mentions self-trained, previous coach, or any other source label.
    expect(note).not.toMatch(/self-trained|previous coach|new to structured/i);
  });

  it("is surfaced ahead of the workout-derived notes when proposeEstimateReview is given a recent race", () => {
    const review = proposeEstimateReview({
      sessions: [],
      phaseKey: "General",
      currentTimeS: 1000,
      referenceDistanceM: MILE_METERS * 3.1,
      recentRace: { raceName: "Self-Trained 5K", raceDate: "2027-01-15", timeS: 950 },
    });
    expect(review.notes[0]).toMatch(/Self-Trained 5K/);
    expect(review.notes[0]).toMatch(/strongest evidence/);
  });

  it("omits the race note entirely when no recent race is passed", () => {
    const review = proposeEstimateReview({
      sessions: [],
      phaseKey: "General",
      currentTimeS: 1000,
      referenceDistanceM: MILE_METERS * 3.1,
    });
    expect(review.notes.join(" ")).not.toMatch(/strongest evidence/);
  });
});
