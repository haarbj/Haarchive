import { describe, expect, it } from "vitest";

import { classifyChange, computeContentSnapshot, computeFingerprint, wordChangeRatio } from "@/lib/knowledge-checks/fingerprint";
import type { SectionForAnalysis } from "@/lib/knowledge-checks/types";
import type { ContentBlock } from "@/lib/sections";

function makeSection(content: ContentBlock[]): SectionForAnalysis {
  return { slug: "test", title: "Test", mission: "test", topics: [], content };
}

describe("computeFingerprint / computeContentSnapshot", () => {
  it("produces the same hash for identical content", () => {
    const section = makeSection([{ type: "paragraph", text: "The aerobic base is built over years." }]);
    const a = computeFingerprint(computeContentSnapshot(section));
    const b = computeFingerprint(computeContentSnapshot(section));
    expect(a).toBe(b);
  });

  it("produces a different hash when the text actually changes", () => {
    const a = computeFingerprint(computeContentSnapshot(makeSection([{ type: "paragraph", text: "Version one." }])));
    const b = computeFingerprint(computeContentSnapshot(makeSection([{ type: "paragraph", text: "Version two." }])));
    expect(a).not.toBe(b);
  });

  it("ignores pure whitespace differences that don't change the rendered text", () => {
    const a = computeContentSnapshot(makeSection([{ type: "paragraph", text: "Hello   world" }]));
    const b = computeContentSnapshot(makeSection([{ type: "paragraph", text: "Hello world" }]));
    expect(a).toBe(b);
  });
});

describe("wordChangeRatio", () => {
  it("is zero for identical text", () => {
    expect(wordChangeRatio("the aerobic base is real", "the aerobic base is real")).toBe(0);
  });

  it("is small for a one-word typo fix in a long passage", () => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const withTypo = long.replace("word50", "wrod50");
    const ratio = wordChangeRatio(long, withTypo);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(0.03);
  });

  it("is large when a substantial new passage is added", () => {
    const base = "the aerobic base is built over years of consistent easy running";
    const withNewParagraph = `${base} ${Array.from({ length: 100 }, (_, i) => `newword${i}`).join(" ")}`;
    expect(wordChangeRatio(base, withNewParagraph)).toBeGreaterThan(0.5);
  });
});

describe("classifyChange", () => {
  // Realistic length on purpose -- a one-word tweak inside a single 11-word
  // sentence is a much bigger fraction of that sentence's words than it
  // would be of a real section's several-hundred-word paragraph, so a
  // longer, more representative passage is what makes the cosmetic-vs-
  // material distinction actually testable here.
  const longParagraph = Array.from(
    { length: 15 },
    (_, i) => `Sentence number ${i} explains a real, distinct point about aerobic base training and how it builds over consistent weeks of running.`,
  ).join(" ");
  const section = makeSection([{ type: "paragraph", text: longParagraph }]);
  const snapshot = computeContentSnapshot(section);
  const fingerprint = computeFingerprint(snapshot);

  it("reports 'new' when there is no stored fingerprint yet", () => {
    expect(classifyChange(null, null, snapshot)).toEqual({ kind: "new", reason: expect.any(String) });
  });

  it("reports 'unchanged' when the fingerprint matches", () => {
    expect(classifyChange(fingerprint, snapshot, snapshot)).toEqual({ kind: "unchanged" });
  });

  it("reports 'cosmetic' for a tiny wording tweak against realistically-sized content", () => {
    const tweaked = computeContentSnapshot(makeSection([{ type: "paragraph", text: longParagraph.replace("real, distinct point", "real, careful point") }]));
    const result = classifyChange(fingerprint, snapshot, tweaked);
    expect(result.kind).toBe("cosmetic");
  });

  it("reports 'material' when a genuinely new subsection is added", () => {
    const rewritten = computeContentSnapshot(
      makeSection([
        { type: "paragraph", text: longParagraph },
        { type: "heading", text: "A Brand New Subsection" },
        {
          type: "paragraph",
          text: "This is an entirely new block of real educational content covering a topic the section never discussed before, long enough to represent a genuine addition rather than a wording tweak.",
        },
      ]),
    );
    const result = classifyChange(fingerprint, snapshot, rewritten);
    expect(result.kind).toBe("material");
  });

  it("reports 'material' when a subsection is removed (not just added)", () => {
    const longer = makeSection([
      { type: "paragraph", text: longParagraph },
      { type: "heading", text: "A Subsection" },
      { type: "paragraph", text: "Extra content that will later be removed entirely from this section in a future edit." },
    ]);
    const longerSnapshot = computeContentSnapshot(longer);
    const longerFingerprint = computeFingerprint(longerSnapshot);

    const shrunk = computeContentSnapshot(makeSection([{ type: "paragraph", text: longParagraph }]));
    const result = classifyChange(longerFingerprint, longerSnapshot, shrunk);
    expect(result.kind).toBe("material");
  });
});
