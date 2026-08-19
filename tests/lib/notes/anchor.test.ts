import { describe, expect, it } from "vitest";

import { blockPlainText, computeAnchor, resolveAnchor } from "@/lib/notes/anchor";
import type { ContentBlock } from "@/lib/sections";

const CONTENT: ContentBlock[] = [
  { type: "heading", text: "Aerobic Adaptations" },
  {
    type: "paragraph",
    text: "Endurance training produces adaptations to prolonged aerobic training, most notably an increase in mitochondrial density.",
  },
  { type: "paragraph", text: "A second, unrelated paragraph about pacing strategy on race day." },
  {
    type: "list",
    items: ["Increased capillary density", { text: "Mitochondrial biogenesis", items: ["More ATP per breath"] }],
  },
  { type: "callout", variant: "tip", title: "Worth knowing", text: "Adaptations compound over months, not weeks." },
];

describe("blockPlainText", () => {
  it("extracts paragraph text", () => {
    expect(blockPlainText(CONTENT[1])).toContain("mitochondrial density");
  });

  it("joins list items, including nested sub-items", () => {
    const text = blockPlainText(CONTENT[3]);
    expect(text).toContain("Increased capillary density");
    expect(text).toContain("Mitochondrial biogenesis");
    expect(text).toContain("More ATP per breath");
  });

  it("joins a callout's title and text", () => {
    const text = blockPlainText(CONTENT[4]);
    expect(text).toContain("Worth knowing");
    expect(text).toContain("Adaptations compound over months");
  });

  it("returns an empty string for a calculator block", () => {
    expect(blockPlainText({ type: "calculator", calculatorId: "tempo-pace" })).toBe("");
  });
});

describe("computeAnchor", () => {
  it("captures prefix/suffix context around the selection", () => {
    const anchor = computeAnchor(CONTENT, 1, "adaptations to prolonged aerobic training");
    expect(anchor).not.toBeNull();
    expect(anchor!.blockIndex).toBe(1);
    expect(anchor!.prefix.endsWith("produces ")).toBe(true);
    expect(anchor!.suffix.startsWith(", most notably")).toBe(true);
  });

  it("returns null if the text isn't actually in that block", () => {
    expect(computeAnchor(CONTENT, 1, "this text does not appear here")).toBeNull();
  });

  it("returns null for an out-of-range block index", () => {
    expect(computeAnchor(CONTENT, 99, "anything")).toBeNull();
  });
});

describe("resolveAnchor", () => {
  it("resolves when nothing has changed", () => {
    const anchor = computeAnchor(CONTENT, 1, "adaptations to prolonged aerobic training")!;
    const result = resolveAnchor(CONTENT, "adaptations to prolonged aerobic training", anchor);
    expect(result).toEqual({ status: "resolved", blockIndex: 1 });
  });

  it("re-finds the passage after the block it was in moves to a new position", () => {
    const anchor = computeAnchor(CONTENT, 1, "adaptations to prolonged aerobic training")!;
    const reordered = [CONTENT[0], CONTENT[2], CONTENT[3], CONTENT[1], CONTENT[4]];
    const result = resolveAnchor(reordered, "adaptations to prolonged aerobic training", anchor);
    expect(result).toEqual({ status: "resolved", blockIndex: 3 });
  });

  it("is unresolved once the surrounding text has genuinely changed and the quote is gone", () => {
    const anchor = computeAnchor(CONTENT, 1, "adaptations to prolonged aerobic training")!;
    const edited: ContentBlock[] = [
      CONTENT[0],
      { type: "paragraph", text: "This paragraph was rewritten and no longer discusses that topic at all." },
      CONTENT[2],
      CONTENT[3],
      CONTENT[4],
    ];
    const result = resolveAnchor(edited, "adaptations to prolonged aerobic training", anchor);
    expect(result).toEqual({ status: "unresolved" });
  });

  it("falls back to an unambiguous quote-only match when the surrounding context changed slightly", () => {
    const anchor = computeAnchor(CONTENT, 1, "adaptations to prolonged aerobic training")!;
    const edited: ContentBlock[] = [
      CONTENT[0],
      {
        type: "paragraph",
        text: "New lead-in sentence. Endurance training produces adaptations to prolonged aerobic training, but the rest of this sentence was also rewritten.",
      },
      CONTENT[2],
      CONTENT[3],
      CONTENT[4],
    ];
    const result = resolveAnchor(edited, "adaptations to prolonged aerobic training", anchor);
    expect(result).toEqual({ status: "resolved", blockIndex: 1 });
  });

  it("never guesses when the quote alone is now ambiguous across the article", () => {
    const anchor = computeAnchor(CONTENT, 1, "mitochondrial density")!;
    const ambiguous: ContentBlock[] = [
      CONTENT[0],
      { type: "paragraph", text: "First mention of mitochondrial density, rewritten." },
      { type: "paragraph", text: "A second, unrelated mention of mitochondrial density shows up here too." },
      CONTENT[3],
      CONTENT[4],
    ];
    const result = resolveAnchor(ambiguous, "mitochondrial density", anchor);
    expect(result).toEqual({ status: "unresolved" });
  });

  it("prefers the original block index when context matches more than one block identically", () => {
    const duplicate: ContentBlock[] = [
      { type: "paragraph", text: "Repeated line. Repeated line. Repeated line." },
      { type: "paragraph", text: "Repeated line. Repeated line. Repeated line." },
    ];
    const anchor = computeAnchor(duplicate, 1, "Repeated line")!;
    const result = resolveAnchor(duplicate, "Repeated line", anchor);
    expect(result).toEqual({ status: "resolved", blockIndex: 1 });
  });
});
