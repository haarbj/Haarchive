import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mastery/taxonomy", () => ({ CONCEPT_SEEDS: [] }));

const { buildSectionReport, statusFor } = await import("@/lib/knowledge-checks/report");
import type { ContentBlock } from "@/lib/sections";

function section(content: ContentBlock[]) {
  return { slug: "test-section", title: "Test Section", mission: "m", topics: [], content };
}

describe("buildSectionReport / statusFor", () => {
  it("reports NEW for a section with content but no stored fingerprint and no existing questions", () => {
    const report = buildSectionReport({
      section: section([{ type: "heading", text: "A Topic" }, { type: "paragraph", text: "Some real content here." }]),
      storedFingerprint: null,
      storedSnapshot: null,
      existingQuestions: [],
    });
    expect(statusFor(report)).toBe("NEW");
    expect(report.plan.action).toBe("new");
  });

  it("reports OK once a section is unchanged and has enough well-distributed questions", () => {
    const content: ContentBlock[] = [{ type: "heading", text: "A Topic" }, { type: "paragraph", text: "Some real content." }];
    const snapshotReport = buildSectionReport({ section: section(content), storedFingerprint: null, storedSnapshot: null, existingQuestions: [] });

    const report = buildSectionReport({
      section: section(content),
      storedFingerprint: snapshotReport.currentFingerprint,
      storedSnapshot: snapshotReport.currentSnapshot,
      existingQuestions: [
        { id: "q1", concepts: ["a-topic"], conceptId: null, locked: true, sourceFingerprint: snapshotReport.currentFingerprint, question: "Q1", cognitiveLevel: null, difficulty: "standard" },
        { id: "q2", concepts: ["a-topic"], conceptId: null, locked: true, sourceFingerprint: snapshotReport.currentFingerprint, question: "Q2", cognitiveLevel: null, difficulty: "standard" },
      ],
    });
    expect(report.change.kind).toBe("unchanged");
    expect(statusFor(report)).toBe("OK");
  });

  it("reports NEEDS UPDATE after a material content change even if the question count alone still looks adequate", () => {
    const before = section([{ type: "heading", text: "A Topic" }, { type: "paragraph", text: "Some real content." }]);
    const beforeReport = buildSectionReport({ section: before, storedFingerprint: null, storedSnapshot: null, existingQuestions: [] });

    const after = section([
      { type: "heading", text: "A Topic" },
      { type: "paragraph", text: "Some real content." },
      { type: "heading", text: "A Brand New Subsection" },
      { type: "paragraph", text: "A genuinely new, substantial block of content that didn't exist before this edit, long enough to count as material." },
    ]);
    const report = buildSectionReport({
      section: after,
      storedFingerprint: beforeReport.currentFingerprint,
      storedSnapshot: beforeReport.currentSnapshot,
      existingQuestions: [
        { id: "q1", concepts: ["a-topic"], conceptId: null, locked: true, sourceFingerprint: beforeReport.currentFingerprint, question: "Q1", cognitiveLevel: null, difficulty: "standard" },
      ],
    });
    expect(report.change.kind).toBe("material");
    expect(statusFor(report)).toBe("NEEDS UPDATE");
  });

  it("flags OVER-QUESTIONED when a section has far more questions than its tier recommends", () => {
    const content: ContentBlock[] = [{ type: "heading", text: "A Topic" }, { type: "paragraph", text: "Short content." }];
    const base = buildSectionReport({ section: section(content), storedFingerprint: null, storedSnapshot: null, existingQuestions: [] });
    const manyQuestions = Array.from({ length: 15 }, (_, i) => ({
      id: `q${i}`,
      concepts: ["a-topic"],
      conceptId: null,
      locked: true,
      sourceFingerprint: base.currentFingerprint,
      question: `Question number ${i}`,
      cognitiveLevel: null,
      difficulty: "standard",
    }));
    const report = buildSectionReport({
      section: section(content),
      storedFingerprint: base.currentFingerprint,
      storedSnapshot: base.currentSnapshot,
      existingQuestions: manyQuestions,
    });
    expect(statusFor(report)).toBe("OVER-QUESTIONED");
  });
});
