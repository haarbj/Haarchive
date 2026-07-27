import { describe, it, expect } from "vitest";
import { parseMarksToTree, type MarkNode } from "@/lib/inline-marks";

describe("parseMarksToTree", () => {
  it("returns a single text node for plain text", () => {
    expect(parseMarksToTree("hello world")).toEqual<MarkNode[]>([{ kind: "text", value: "hello world" }]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseMarksToTree("")).toEqual([]);
  });

  it("parses bold, italic, and underline", () => {
    expect(parseMarksToTree("a **b** c")).toEqual<MarkNode[]>([
      { kind: "text", value: "a " },
      { kind: "bold", children: [{ kind: "text", value: "b" }] },
      { kind: "text", value: " c" },
    ]);
    expect(parseMarksToTree("_b_")).toEqual<MarkNode[]>([
      { kind: "italic", children: [{ kind: "text", value: "b" }] },
    ]);
    expect(parseMarksToTree("++b++")).toEqual<MarkNode[]>([
      { kind: "underline", children: [{ kind: "text", value: "b" }] },
    ]);
  });

  it("parses an explicit link", () => {
    expect(parseMarksToTree("see [Recovery](/recovery) now")).toEqual<MarkNode[]>([
      { kind: "text", value: "see " },
      { kind: "link", href: "/recovery", children: [{ kind: "text", value: "Recovery" }] },
      { kind: "text", value: " now" },
    ]);
  });

  it("nests marks (bold containing italic)", () => {
    expect(parseMarksToTree("**really _fast_**")).toEqual<MarkNode[]>([
      {
        kind: "bold",
        children: [
          { kind: "text", value: "really " },
          { kind: "italic", children: [{ kind: "text", value: "fast" }] },
        ],
      },
    ]);
  });

  it("nests a link inside bold", () => {
    expect(parseMarksToTree("**[Recovery](/recovery)**")).toEqual<MarkNode[]>([
      {
        kind: "bold",
        children: [{ kind: "link", href: "/recovery", children: [{ kind: "text", value: "Recovery" }] }],
      },
    ]);
  });

  it("picks whichever mark starts earliest when multiple are present", () => {
    const tree = parseMarksToTree("_i_ then **b**");
    expect(tree[0]).toEqual({ kind: "italic", children: [{ kind: "text", value: "i" }] });
    expect(tree[tree.length - 1]).toEqual({ kind: "bold", children: [{ kind: "text", value: "b" }] });
  });

  it("does not treat an unmatched marker as a mark", () => {
    // BOLD_RE requires a closing ** with at least one char between --
    // "****" has nothing between, so it's just literal text.
    expect(parseMarksToTree("****")).toEqual<MarkNode[]>([{ kind: "text", value: "****" }]);
  });

  it("has no notion of section cross-references or glossary terms", () => {
    // Confirms the editor's parser structurally cannot live-apply the two
    // auto-link conventions linkify.tsx's parseInline falls through to --
    // it has no import of/access to those functions at all, so a phrase
    // like "Recovery" alone (not wrapped in [Recovery](href)) never
    // becomes a link node here.
    expect(parseMarksToTree("see Recovery for more")).toEqual<MarkNode[]>([
      { kind: "text", value: "see Recovery for more" },
    ]);
  });
});
