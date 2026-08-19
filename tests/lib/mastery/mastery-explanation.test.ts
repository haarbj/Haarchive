import { describe, expect, it } from "vitest";

import { explainMastery, type MasteryExplanationInput } from "@/lib/mastery/mastery-explanation";

function baseInput(overrides: Partial<MasteryExplanationInput>): MasteryExplanationInput {
  return {
    score: 0,
    level: "exploring",
    hasActiveSignal: false,
    activeSignalCount: 0,
    conceptCount: 0,
    knowledgeCheckAttempted: 0,
    knowledgeCheckCorrect: 0,
    knowledgeCheckAccuracy: null,
    hasKnowledgeChecksAvailable: false,
    hasReadableContent: true,
    ...overrides,
  };
}

describe("explainMastery", () => {
  it("Exploring: encourages continued reading", () => {
    const result = explainMastery(baseInput({ level: "exploring" }));
    expect(result.headline).toMatch(/started reading/i);
    expect(result.detail).not.toBeNull();
  });

  // Phase 3.1 audit finding: training-plans and every calculator have
  // neither a sections.ts `content` array nor any content_viewed/
  // content_engaged wiring at all -- tool_used is their only possible
  // signal, and it's structurally incapable of crossing the Familiar
  // threshold (a flat, one-time +8, see algorithm.ts's WEIGHT_TOOL), so
  // Exploring is their real, permanent ceiling. The old copy ("Keep
  // reading, or leave a note...") was actively false for a topic with no
  // prose and no Notes UI at all. (coaching-library/athlete-library/
  // training-philosophy also lack a sections.ts `content` array but *do*
  // fire content_viewed/content_engaged from real prose elsewhere -- see
  // dashboard/page.tsx's own hasReadableContent computation, fixed in
  // Phase 4.1 to pass true for those three specifically. This test only
  // covers the pure function's behavior given hasReadableContent=false;
  // it doesn't assert which real topics produce that value.)
  it("Exploring with no readable content (a tool-only topic): never suggests reading or notes, and says something real in `detail` (the only field the UI actually renders)", () => {
    const result = explainMastery(
      baseInput({ level: "exploring", hasActiveSignal: true, activeSignalCount: 1, hasReadableContent: false }),
    );
    expect(result.headline.toLowerCase()).not.toMatch(/read/);
    expect(result.detail).not.toBeNull();
    // May reference "reading" only to explain it doesn't apply here (e.g.
    // "no reading progress to build") -- must never suggest it as an
    // action, the way the readable-content branch's "Keep reading..." does.
    expect(result.detail ?? "").not.toMatch(/keep reading|leave a note|started reading/i);
  });

  it("Exploring with readable content: keeps the original reading-focused copy", () => {
    const result = explainMastery(baseInput({ level: "exploring", hasReadableContent: true }));
    expect(result.headline).toMatch(/started reading/i);
    expect(result.detail).toMatch(/read|note/i);
  });

  it("Familiar: names reading's own ceiling and an active next step", () => {
    const result = explainMastery(baseInput({ level: "familiar" }));
    expect(result.headline).toMatch(/read/i);
    expect(result.detail).toMatch(/note|revisit|tool/i);
  });

  it("Proficient: suggests concept breadth when breadth is genuinely missing", () => {
    const result = explainMastery(
      baseInput({ level: "proficient", hasActiveSignal: true, conceptCount: 0, activeSignalCount: 1 }),
    );
    expect(result.detail).toMatch(/concept/i);
  });

  it("Proficient: does not suggest concepts when breadth is already satisfied by active-signal count", () => {
    const result = explainMastery(
      baseInput({ level: "proficient", hasActiveSignal: true, conceptCount: 0, activeSignalCount: 4 }),
    );
    expect(result.detail).not.toMatch(/concept/i);
  });

  it("Proficient: does not suggest concepts when breadth is already satisfied by concept count", () => {
    const result = explainMastery(
      baseInput({ level: "proficient", hasActiveSignal: true, conceptCount: 2, activeSignalCount: 1 }),
    );
    expect(result.detail).not.toMatch(/concept/i);
  });

  it("Advanced with no knowledge checks available: never invents a call to action, states the real ceiling honestly instead of going silent", () => {
    // Phase 3.1 audit fix: this branch used to return detail: null, which
    // read as "nothing left to say" -- indistinguishable from Mastered
    // being achievable and simply not yet reached through inaction. A
    // topic with zero knowledge checks has no path to Mastered at all
    // right now, which is a real, nameable fact, not an absence of one.
    const result = explainMastery(
      baseInput({ level: "advanced", hasActiveSignal: true, conceptCount: 2, hasKnowledgeChecksAvailable: false }),
    );
    expect(result.detail).not.toBeNull();
    expect(result.detail).toMatch(/no verification available|ceiling/i);
    expect(result.headline.toLowerCase()).not.toMatch(/knowledge check/);
    // Never invents a call to action the user could actually act on --
    // "verify", "answer", "reach Mastered" would all imply an available
    // mechanism that doesn't exist for this topic.
    expect(result.detail).not.toMatch(/verify|answer a knowledge check|to reach mastered/i);
  });

  it("Advanced with knowledge checks available but none attempted: invites verification", () => {
    const result = explainMastery(
      baseInput({
        level: "advanced",
        hasActiveSignal: true,
        conceptCount: 2,
        hasKnowledgeChecksAvailable: true,
        knowledgeCheckAttempted: 0,
        knowledgeCheckCorrect: 0,
      }),
    );
    expect(result.detail).toMatch(/verify|knowledge check/i);
  });

  it("Advanced with 1 correct (breadth not yet met): asks for one more, not a generic restart", () => {
    const result = explainMastery(
      baseInput({
        level: "advanced",
        hasActiveSignal: true,
        conceptCount: 2,
        hasKnowledgeChecksAvailable: true,
        knowledgeCheckAttempted: 1,
        knowledgeCheckCorrect: 1,
      }),
    );
    expect(result.detail).toMatch(/one more/i);
  });

  it("Advanced with breadth satisfied (2+ correct) but accuracy still short: names accuracy, never breadth", () => {
    // 2 correct out of 5 attempted = 40%, below the 80% gate -- breadth
    // (>=2 correct) is genuinely already satisfied here, so the copy must
    // not ask for "one more correct answer" (already misleading -- they
    // have 2). This is the audit's own named failure mode.
    const result = explainMastery(
      baseInput({
        level: "advanced",
        hasActiveSignal: true,
        conceptCount: 2,
        hasKnowledgeChecksAvailable: true,
        knowledgeCheckAttempted: 5,
        knowledgeCheckCorrect: 2,
        knowledgeCheckAccuracy: 0.4,
      }),
    );
    expect(result.detail).toMatch(/accuracy/i);
    expect(result.detail).not.toMatch(/one more|answer a knowledge check/i);
  });

  it("Mastered: reports concrete correct-count and concept-count, not raw score", () => {
    const result = explainMastery(
      baseInput({
        level: "mastered",
        hasActiveSignal: true,
        conceptCount: 3,
        hasKnowledgeChecksAvailable: true,
        knowledgeCheckAttempted: 3,
        knowledgeCheckCorrect: 3,
        knowledgeCheckAccuracy: 1,
      }),
    );
    expect(result.detail).toBe("3 knowledge checks correct · 3 concepts explored");
    expect(result.headline.toLowerCase()).not.toMatch(/\d+\/100|score/);
  });

  it("Mastered: singular phrasing for exactly 1 knowledge check / 1 concept", () => {
    const result = explainMastery(
      baseInput({
        level: "mastered",
        hasActiveSignal: true,
        conceptCount: 1,
        hasKnowledgeChecksAvailable: true,
        knowledgeCheckAttempted: 2,
        knowledgeCheckCorrect: 2,
      }),
    );
    // Note: Mastered requires >=2 distinct correct per the algorithm's own
    // gate, so this scenario is illustrative of the singular/plural
    // boundary at the concept level, not a real reachable KC count of 1.
    expect(result.detail).toContain("1 concept explored");
  });

  it("never returns a numeric score anywhere in the explanation text", () => {
    for (const level of ["exploring", "familiar", "proficient", "advanced", "mastered"] as const) {
      const result = explainMastery(
        baseInput({
          level,
          score: 87,
          hasActiveSignal: true,
          conceptCount: 3,
          hasKnowledgeChecksAvailable: true,
          knowledgeCheckAttempted: 3,
          knowledgeCheckCorrect: 3,
        }),
      );
      expect(result.headline).not.toMatch(/87/);
      expect(result.detail ?? "").not.toMatch(/87/);
    }
  });
});
