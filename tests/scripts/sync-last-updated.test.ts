import { describe, expect, it } from "vitest";

import {
  applyLastUpdatedEdits,
  findAffectedSlugs,
  findSectionRanges,
  parseChangedLineNumbers,
} from "../../scripts/sync-last-updated.mjs";

// Mirrors the real file's actual shape/indentation (2-space object indent,
// 4-space property indent, double-quoted strings) closely enough that line
// numbers below are meaningful -- doesn't need to be valid against the real
// `Section` type, just structurally identical to what the parser reads.
const FIXTURE_SOURCE = `export type Section = {
  slug: string;
};

export const sections: Section[] = [
  {
    slug: "first-section",
    title: "First Section",
    mission: "First mission.",
    topics: ["A"],
    category: "practice",
    lastUpdated: "2026-01-01",
    content: [
      { type: "paragraph", text: "Hello." },
    ],
  },
  {
    slug: "second-section",
    title: "Second Section",
    mission: "Second mission.",
    topics: ["B"],
    category: "physiology",
    content: [
      { type: "paragraph", text: "World." },
    ],
  },
];
`;

describe("findSectionRanges", () => {
  const ranges = findSectionRanges(FIXTURE_SOURCE);

  it("finds every section with its slug and line range", () => {
    expect(ranges).toHaveLength(2);
    expect(ranges[0].slug).toBe("first-section");
    expect(ranges[1].slug).toBe("second-section");
    expect(ranges[0].startLine).toBeLessThan(ranges[0].endLine);
    expect(ranges[1].startLine).toBeGreaterThan(ranges[0].endLine);
  });

  it("captures an existing lastUpdated value's exact span", () => {
    const [first] = ranges;
    expect(first.lastUpdatedValueSpan).not.toBeNull();
    const spanText = FIXTURE_SOURCE.slice(first.lastUpdatedValueSpan.start, first.lastUpdatedValueSpan.end);
    expect(spanText).toBe('"2026-01-01"');
  });

  it("leaves lastUpdatedValueSpan null when the field doesn't exist", () => {
    const [, second] = ranges;
    expect(second.lastUpdatedValueSpan).toBeNull();
    expect(second.categoryEnd).toBeGreaterThan(0);
  });

  it("throws a clear error when the sections array can't be found", () => {
    expect(() => findSectionRanges("export const somethingElse = [];")).toThrow(/sections/);
  });
});

describe("parseChangedLineNumbers", () => {
  it("expands a multi-line added/modified hunk into individual line numbers", () => {
    const diff = "@@ -10,0 +10,3 @@\n+a\n+b\n+c\n";
    expect(parseChangedLineNumbers(diff)).toEqual(new Set([10, 11, 12]));
  });

  it("treats a hunk header with no explicit count as a single changed line", () => {
    const diff = "@@ -5 +5 @@\n-old\n+new\n";
    expect(parseChangedLineNumbers(diff)).toEqual(new Set([5]));
  });

  it("attributes a pure-deletion hunk (0-length after range) to the surrounding line", () => {
    const diff = "@@ -20,3 +20,0 @@\n-gone1\n-gone2\n-gone3\n";
    expect(parseChangedLineNumbers(diff)).toEqual(new Set([20]));
  });

  it("ignores non-hunk-header lines", () => {
    const diff = "diff --git a/x b/x\nindex 111..222 100644\n--- a/x\n+++ b/x\n@@ -1,0 +1,1 @@\n+hi\n";
    expect(parseChangedLineNumbers(diff)).toEqual(new Set([1]));
  });
});

describe("findAffectedSlugs", () => {
  const ranges = findSectionRanges(FIXTURE_SOURCE);

  it("maps a changed line to the section whose range contains it", () => {
    const affected = findAffectedSlugs(ranges, new Set([ranges[0].startLine + 1]));
    expect(affected).toEqual(new Set(["first-section"]));
  });

  it("can affect more than one section at once", () => {
    const affected = findAffectedSlugs(ranges, new Set([ranges[0].startLine, ranges[1].startLine]));
    expect(affected).toEqual(new Set(["first-section", "second-section"]));
  });

  it("ignores a line number outside every section's range", () => {
    const affected = findAffectedSlugs(ranges, new Set([1]));
    expect(affected.size).toBe(0);
  });
});

describe("applyLastUpdatedEdits", () => {
  const ranges = findSectionRanges(FIXTURE_SOURCE);

  it("replaces an existing lastUpdated value in place", () => {
    const result = applyLastUpdatedEdits(FIXTURE_SOURCE, ranges, new Set(["first-section"]), "2026-09-01");
    expect(result).toContain('lastUpdated: "2026-09-01"');
    expect(result).not.toContain('lastUpdated: "2026-01-01"');
    // Only the affected section's block changed -- the second section is untouched.
    expect(result).toContain('slug: "second-section"');
    const secondBlock = result.slice(result.indexOf('slug: "second-section"'));
    expect(secondBlock).not.toContain("lastUpdated");
  });

  it("inserts a new lastUpdated field right after category when one doesn't exist", () => {
    const result = applyLastUpdatedEdits(FIXTURE_SOURCE, ranges, new Set(["second-section"]), "2026-09-01");
    expect(result).toContain('category: "physiology",\n    lastUpdated: "2026-09-01",\n    content:');
    // The first section (unaffected) keeps its original date untouched.
    expect(result).toContain('lastUpdated: "2026-01-01"');
  });

  it("applies edits to multiple affected sections in one pass without corrupting offsets", () => {
    const result = applyLastUpdatedEdits(
      FIXTURE_SOURCE,
      ranges,
      new Set(["first-section", "second-section"]),
      "2026-09-01",
    );
    expect(result).toContain('lastUpdated: "2026-09-01"');
    expect((result.match(/lastUpdated: "2026-09-01"/g) ?? []).length).toBe(2);
    expect(result).not.toContain("2026-01-01");
  });

  it("is a no-op when no sections are affected", () => {
    const result = applyLastUpdatedEdits(FIXTURE_SOURCE, ranges, new Set(), "2026-09-01");
    expect(result).toBe(FIXTURE_SOURCE);
  });
});
