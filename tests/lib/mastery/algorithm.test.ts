import { describe, expect, it } from "vitest";

import { computeMastery, type MasteryEvent } from "@/lib/mastery/algorithm";

const EPOCH = new Date("2026-01-01T12:00:00Z");

function day(n: number): string {
  return new Date(EPOCH.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}

describe("computeMastery", () => {
  it("returns Exploring with a zero score for no events", () => {
    const result = computeMastery([]);
    expect(result.score).toBe(0);
    expect(result.level).toBe("exploring");
  });

  it("reaches Exploring on a single first view", () => {
    const events: MasteryEvent[] = [{ eventType: "content_viewed", createdAt: day(0) }];
    const result = computeMastery(events);
    expect(result.level).toBe("exploring");
    expect(result.score).toBeGreaterThan(0);
  });

  it("caps passive reading alone (a view plus many deep-scroll days) at Familiar", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      ...Array.from({ length: 30 }, (_, i): MasteryEvent => ({ eventType: "content_engaged", createdAt: day(i) })),
    ];
    const result = computeMastery(events);
    expect(["exploring", "familiar"]).toContain(result.level);
  });

  it("never reaches Proficient from passive signals alone, no matter how large the score", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      ...Array.from({ length: 50 }, (_, i): MasteryEvent => ({ eventType: "content_engaged", createdAt: day(i) })),
    ];
    const result = computeMastery(events);
    expect(result.level).not.toBe("proficient");
    expect(result.level).not.toBe("advanced");
    expect(result.level).not.toBe("mastered");
  });

  it("reaches Proficient once a real active signal joins a familiar reading history", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(1) },
      { eventType: "note_taken", createdAt: day(1) },
      { eventType: "note_taken", createdAt: day(2) },
      { eventType: "note_taken", createdAt: day(3) },
    ];
    const result = computeMastery(events);
    expect(result.level).toBe("proficient");
  });

  it("never returns Mastered in Phase 1, regardless of how many strong active signals accumulate", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      ...Array.from({ length: 20 }, (_, i): MasteryEvent => ({ eventType: "note_taken", createdAt: day(i) })),
      ...Array.from({ length: 20 }, (_, i): MasteryEvent => ({ eventType: "topic_revisited", createdAt: day(i) })),
      { eventType: "tool_used", createdAt: day(0) },
      { eventType: "concept_engaged", conceptId: "c1", createdAt: day(0) },
      { eventType: "concept_engaged", conceptId: "c2", createdAt: day(1) },
      { eventType: "concept_engaged", conceptId: "c3", createdAt: day(2) },
    ];
    const result = computeMastery(events);
    expect(result.level).not.toBe("mastered");
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("reaches Advanced with strong active engagement spanning multiple concepts", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(0) },
      { eventType: "note_taken", createdAt: day(0) },
      { eventType: "note_taken", createdAt: day(1) },
      { eventType: "note_taken", createdAt: day(2) },
      { eventType: "topic_revisited", createdAt: day(1) },
      { eventType: "topic_revisited", createdAt: day(2) },
      { eventType: "concept_engaged", conceptId: "c1", createdAt: day(0) },
      { eventType: "concept_engaged", conceptId: "c2", createdAt: day(1) },
      { eventType: "concept_engaged", conceptId: "c3", createdAt: day(2) },
      { eventType: "tool_used", createdAt: day(2) },
    ];
    const result = computeMastery(events);
    expect(result.level).toBe("advanced");
  });

  it("does not inflate score from repeated same-day content_engaged duplicates", () => {
    const singleDayScore = computeMastery([
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(0) },
    ]).score;

    const zero = new Date(day(0));
    const duplicatedScore = computeMastery([
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: new Date(zero.getTime() + 60 * 60 * 1000).toISOString() },
      { eventType: "content_engaged", createdAt: new Date(zero.getTime() + 2 * 60 * 60 * 1000).toISOString() },
    ]).score;

    expect(duplicatedScore).toBe(singleDayScore);
  });

  // Phase 3.1 audit fix: note_taken previously had no day-scoping at all
  // (unlike content_engaged/topic_revisited above), so N same-day notes
  // each contributed separately -- diminishing per occurrence, but never
  // to zero, so trivial repeated 15-character notes in one sitting could
  // buy real score and activeSignalCount without ever coming back on a
  // different day. distinctDays() now collapses same-day notes exactly
  // like it already did for topic_revisited; a matching DB index backs
  // this going forward (see the note_taken_daily_cap migration).
  it("does not inflate score or activeSignalCount from repeated same-day note_taken duplicates", () => {
    const singleNoteResult = computeMastery([{ eventType: "note_taken", createdAt: day(0) }]);

    const zero = new Date(day(0));
    const spammedResult = computeMastery(
      Array.from({ length: 10 }, (_, i): MasteryEvent => ({
        eventType: "note_taken",
        createdAt: new Date(zero.getTime() + i * 10 * 60 * 1000).toISOString(),
      })),
    );

    expect(spammedResult.score).toBe(singleNoteResult.score);
    expect(spammedResult.activeSignalCount).toBe(singleNoteResult.activeSignalCount);
  });

  it("still rewards genuine notes spread across distinct days (regression: not an overcorrection)", () => {
    const oneDayResult = computeMastery([{ eventType: "note_taken", createdAt: day(0) }]);
    const fourDaysResult = computeMastery(
      Array.from({ length: 4 }, (_, i): MasteryEvent => ({ eventType: "note_taken", createdAt: day(i) })),
    );
    expect(fourDaysResult.activeSignalCount).toBe(4);
    expect(fourDaysResult.score).toBeGreaterThan(oneDayResult.score);
  });

  it("applies diminishing returns to repeated notes rather than linear accumulation", () => {
    const oneNoteScore = computeMastery([{ eventType: "note_taken", createdAt: day(0) }]).score;
    const twoNotesScore = computeMastery([
      { eventType: "note_taken", createdAt: day(0) },
      { eventType: "note_taken", createdAt: day(1) },
    ]).score;
    const secondNoteGain = twoNotesScore - oneNoteScore;
    expect(secondNoteGain).toBeGreaterThan(0);
    expect(secondNoteGain).toBeLessThan(oneNoteScore);
  });

  it("gives diminishing returns to spaced returns after several occurrences", () => {
    const events: MasteryEvent[] = Array.from({ length: 8 }, (_, i): MasteryEvent => ({
      eventType: "topic_revisited",
      createdAt: day(i),
    }));
    const firstFourScore = computeMastery(events.slice(0, 4)).score;
    const allEightScore = computeMastery(events).score;
    const nextFourGain = allEightScore - firstFourScore;
    // The 5th-8th spaced returns should add markedly less than the first 4 did.
    expect(nextFourGain).toBeLessThan(firstFourScore);
  });

  it("rewards concept breadth: distinct concepts score higher than repeating one concept", () => {
    const oneConceptRepeated = computeMastery([
      { eventType: "concept_engaged", conceptId: "c1", createdAt: day(0) },
      { eventType: "concept_engaged", conceptId: "c1", createdAt: day(1) },
      { eventType: "concept_engaged", conceptId: "c1", createdAt: day(2) },
    ]).score;
    const threeDistinctConcepts = computeMastery([
      { eventType: "concept_engaged", conceptId: "c1", createdAt: day(0) },
      { eventType: "concept_engaged", conceptId: "c2", createdAt: day(1) },
      { eventType: "concept_engaged", conceptId: "c3", createdAt: day(2) },
    ]).score;
    expect(threeDistinctConcepts).toBeGreaterThan(oneConceptRepeated);
  });

  it("is deterministic -- recomputing from the same events always yields the same result", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(0) },
      { eventType: "note_taken", createdAt: day(1) },
    ];
    const first = computeMastery(events);
    const second = computeMastery([...events]);
    expect(second).toEqual(first);
  });

  it("ignores a knowledge_check_answered event with no metadata safely (malformed/legacy data)", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "knowledge_check_answered", createdAt: day(1) },
    ];
    const result = computeMastery(events);
    expect(result.level).not.toBe("proficient");
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("ignores a genuinely unrecognized/future event type safely", () => {
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "some_future_event_type", createdAt: day(1) },
    ];
    const result = computeMastery(events);
    expect(result.level).toBe("exploring");
    expect(Number.isFinite(result.score)).toBe(true);
  });
});

// Helper: one knowledge_check_answered event with real metadata.
function kcEvent(
  questionId: string,
  correct: boolean,
  attemptNumber: number,
  dayIndex: number,
  conceptId?: string,
): MasteryEvent {
  return {
    eventType: "knowledge_check_answered",
    conceptId: conceptId ?? null,
    createdAt: day(dayIndex),
    metadata: { questionId, correct, attemptNumber },
  };
}

// A reading + active-engagement history that alone reaches Advanced --
// used as the base for every Mastered-gate test below, so each test only
// has to vary the knowledge-check portion.
function advancedBaseEvents(): MasteryEvent[] {
  return [
    { eventType: "content_viewed", createdAt: day(0) },
    { eventType: "content_engaged", createdAt: day(0) },
    { eventType: "note_taken", createdAt: day(0) },
    { eventType: "note_taken", createdAt: day(1) },
    { eventType: "note_taken", createdAt: day(2) },
    { eventType: "topic_revisited", createdAt: day(1) },
    { eventType: "topic_revisited", createdAt: day(2) },
    { eventType: "concept_engaged", conceptId: "c1", createdAt: day(0) },
    { eventType: "concept_engaged", conceptId: "c2", createdAt: day(1) },
    { eventType: "concept_engaged", conceptId: "c3", createdAt: day(2) },
    { eventType: "tool_used", createdAt: day(2) },
  ];
}

describe("computeMastery -- knowledge checks", () => {
  it("gives full credit for a first-try correct answer to a distinct question", () => {
    const zeroCorrect = computeMastery([]).score;
    const oneCorrect = computeMastery([kcEvent("q1", true, 1, 0)]).score;
    expect(oneCorrect).toBeGreaterThan(zeroCorrect);
  });

  it("gives reduced credit for a correct answer that took a retry, versus a first-try correct", () => {
    const firstTry = computeMastery([kcEvent("q1", true, 1, 0)]).score;
    const afterRetry = computeMastery([
      kcEvent("q1", false, 1, 0),
      kcEvent("q1", true, 2, 0),
    ]).score;
    expect(afterRetry).toBeGreaterThan(0);
    expect(afterRetry).toBeLessThan(firstTry);
  });

  it("gives zero additional score for re-answering a question already answered correctly", () => {
    const onceCorrect = computeMastery([kcEvent("q1", true, 1, 0)]).score;
    const answeredAgain = computeMastery([
      kcEvent("q1", true, 1, 0),
      kcEvent("q1", true, 2, 1),
      kcEvent("q1", true, 3, 2),
      kcEvent("q1", true, 4, 3),
    ]).score;
    expect(answeredAgain).toBe(onceCorrect);
  });

  it("an incorrect answer alone contributes no score and is not a negative", () => {
    const result = computeMastery([kcEvent("q1", false, 1, 0)]);
    expect(result.score).toBe(0);
    expect(result.level).toBe("exploring");
  });

  it("counts distinct correctly-answered questions, not raw attempts", () => {
    const twoWrongThenRightOnQ1 = computeMastery([
      kcEvent("q1", false, 1, 0),
      kcEvent("q1", false, 2, 0),
      kcEvent("q1", true, 3, 0),
    ]).score;
    // Same eventual outcome (1 distinct correct question, reached on
    // attempt 3) regardless of how many wrong attempts preceded it --
    // repeated incorrect guessing before the eventual correct answer
    // doesn't add extra score beyond the single retry-weighted credit.
    const oneWrongThenRightOnQ1 = computeMastery([
      kcEvent("q1", false, 1, 0),
      kcEvent("q1", true, 2, 0),
    ]).score;
    expect(twoWrongThenRightOnQ1).toBe(oneWrongThenRightOnQ1);
  });

  it("Mastered is blocked when a topic has zero knowledge-check events, no matter how advanced the rest is", () => {
    const result = computeMastery(advancedBaseEvents());
    expect(result.level).toBe("advanced");
    expect(result.level).not.toBe("mastered");
  });

  it("Mastered is blocked by insufficient score even with 2 correct questions at perfect accuracy", () => {
    // Deliberately thin active history -- score never reaches the
    // Advanced/Mastered floor, even though the knowledge-check gates
    // (breadth, accuracy) alone would pass.
    const events: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      kcEvent("q1", true, 1, 0),
      kcEvent("q2", true, 1, 1),
    ];
    const result = computeMastery(events);
    expect(result.level).not.toBe("mastered");
  });

  it("Mastered is blocked by fewer than 2 distinct correct questions, even at 100% accuracy and high score", () => {
    const events: MasteryEvent[] = [...advancedBaseEvents(), kcEvent("q1", true, 1, 3)];
    const result = computeMastery(events);
    expect(result.level).toBe("advanced");
    expect(result.level).not.toBe("mastered");
  });

  it("Mastered is blocked below 80% distinct-question accuracy (the exact 2/3 example from spec)", () => {
    // Question A: incorrect, incorrect, correct. Question B: correct.
    // Question C: incorrect. Distinct attempted = 3, distinct correct = 2,
    // rate = 2/3 (~0.667) -- below the 0.8 gate.
    const events: MasteryEvent[] = [
      ...advancedBaseEvents(),
      kcEvent("qa", false, 1, 3),
      kcEvent("qa", false, 2, 3),
      kcEvent("qa", true, 3, 3),
      kcEvent("qb", true, 1, 4),
      kcEvent("qc", false, 1, 5),
    ];
    const result = computeMastery(events);
    expect(result.level).not.toBe("mastered");
  });

  it("Mastered is blocked at exactly 75% accuracy (the spec's A/B/C-correct, D-incorrect example)", () => {
    const events: MasteryEvent[] = [
      ...advancedBaseEvents(),
      kcEvent("qa", true, 1, 3),
      kcEvent("qb", true, 1, 4),
      kcEvent("qc", true, 1, 5),
      kcEvent("qd", false, 1, 6),
    ];
    const result = computeMastery(events);
    // 3/4 = 0.75, below the 0.8 gate.
    expect(result.level).not.toBe("mastered");
  });

  it("Mastered is reached when every gate genuinely passes (5/6 = 0.833, the spec's own eligible example)", () => {
    const events: MasteryEvent[] = [
      ...advancedBaseEvents(),
      kcEvent("qa", true, 1, 3),
      kcEvent("qb", true, 1, 4),
      kcEvent("qc", true, 1, 5),
      kcEvent("qd", true, 1, 6),
      kcEvent("qe", true, 1, 7),
      kcEvent("qf", false, 1, 8),
    ];
    const result = computeMastery(events);
    expect(result.level).toBe("mastered");
  });

  it("Mastered requires Advanced's own breadth/activity gate to also pass, not knowledge checks alone", () => {
    // Strong, perfectly-accurate knowledge-check history, but almost no
    // reading/activity underneath it -- score never reaches the Advanced
    // floor, so Mastered must stay out of reach regardless of knowledge-
    // check performance.
    const events: MasteryEvent[] = [
      kcEvent("qa", true, 1, 0),
      kcEvent("qb", true, 1, 1),
      kcEvent("qc", true, 1, 2),
    ];
    const result = computeMastery(events);
    expect(result.level).not.toBe("mastered");
  });

  it("a single lucky correct answer cannot produce Mastered even with an otherwise-Advanced topic", () => {
    const events: MasteryEvent[] = [...advancedBaseEvents(), kcEvent("q1", true, 1, 3)];
    const result = computeMastery(events);
    expect(result.level).not.toBe("mastered");
  });

  it("existing Exploring/Familiar/Proficient/Advanced boundaries are unchanged by the knowledge-check addition", () => {
    // Identical to the pre-Phase-2 "reaches Proficient" and "reaches
    // Advanced" tests above, with zero knowledge-check events -- confirms
    // no accidental threshold drift from adding the new scoring branch.
    const proficientEvents: MasteryEvent[] = [
      { eventType: "content_viewed", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(0) },
      { eventType: "content_engaged", createdAt: day(1) },
      { eventType: "note_taken", createdAt: day(1) },
      { eventType: "note_taken", createdAt: day(2) },
      { eventType: "note_taken", createdAt: day(3) },
    ];
    expect(computeMastery(proficientEvents).level).toBe("proficient");
    expect(computeMastery(advancedBaseEvents()).level).toBe("advanced");
  });

  it("is deterministic for knowledge-check-bearing event histories too", () => {
    const events = [...advancedBaseEvents(), kcEvent("qa", true, 1, 3), kcEvent("qb", true, 1, 4)];
    const first = computeMastery(events);
    const second = computeMastery([...events]);
    expect(second).toEqual(first);
  });
});
