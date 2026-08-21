import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyStatusBlock,
  buildStatusBlock,
  END_MARKER,
  loadReleaseNotes,
  README_PATH,
  RELEASE_NOTES_PATH,
  START_MARKER,
  stripReleaseNoteTypeAnnotations,
} from "../../scripts/sync-readme-status.mjs";

const FIXTURE_SOURCE = `// some header comment
export type ReleaseNote = {
  date: string;
  headline: string;
  detail: string;
};

export const releaseNotes: ReleaseNote[] = [
  {
    date: "2026-08-21",
    headline: "Newest entry",
    detail: "Newest detail, with an escaped \\"quote\\" inside it.",
  },
  {
    date: "2026-08-19",
    headline: "Second entry",
    detail: "Second detail.",
  },
  {
    date: "2026-08-12",
    headline: "Third entry",
    detail: "Third detail.",
  },
  {
    date: "2026-07-30",
    headline: "Fourth entry",
    detail: "Fourth detail.",
  },
];
`;

describe("stripReleaseNoteTypeAnnotations", () => {
  it("removes the type declaration and the array's own type annotation, leaving valid JS", () => {
    const stripped = stripReleaseNoteTypeAnnotations(FIXTURE_SOURCE);
    expect(stripped).not.toContain("ReleaseNote");
    expect(stripped).toContain("export const releaseNotes = [");
  });

  it("throws a clear error when the type declaration is missing", () => {
    const malformed = FIXTURE_SOURCE.replace("export type ReleaseNote = {", "export type SomethingElse = {");
    expect(() => stripReleaseNoteTypeAnnotations(malformed)).toThrow(/ReleaseNote/);
  });

  it("throws a clear error when the array declaration is missing", () => {
    const malformed = FIXTURE_SOURCE.replace("export const releaseNotes: ReleaseNote[] = [", "export const somethingElse = [");
    expect(() => stripReleaseNoteTypeAnnotations(malformed)).toThrow(/releaseNotes/);
  });
});

describe("loadReleaseNotes", () => {
  it("evaluates the stripped source and returns the real array, in order", async () => {
    const notes = await loadReleaseNotes(FIXTURE_SOURCE);
    expect(notes).toHaveLength(4);
    expect(notes[0].headline).toBe("Newest entry");
    expect(notes[3].headline).toBe("Fourth entry");
  });

  it("correctly handles an escaped quote inside a string field", async () => {
    const notes = await loadReleaseNotes(FIXTURE_SOURCE);
    expect(notes[0].detail).toContain('escaped "quote" inside');
  });

  it("throws a clear error for an empty releaseNotes array (edge case)", async () => {
    const emptyArraySource = `
      export type ReleaseNote = {
        date: string;
        headline: string;
        detail: string;
      };

      export const releaseNotes: ReleaseNote[] = [];
    `;
    await expect(loadReleaseNotes(emptyArraySource)).rejects.toThrow(/empty or invalid/);
  });

  it("throws a clear error when an entry is missing a required field", async () => {
    const malformed = FIXTURE_SOURCE.replace('headline: "Newest entry",', "");
    await expect(loadReleaseNotes(malformed)).rejects.toThrow(/missing a date or headline/);
  });
});

describe("buildStatusBlock", () => {
  it("includes the markers, the latest entry, and up to 3 additional highlights", async () => {
    const notes = await loadReleaseNotes(FIXTURE_SOURCE);
    const block = buildStatusBlock(notes);
    expect(block.startsWith(START_MARKER)).toBe(true);
    expect(block.endsWith(END_MARKER)).toBe(true);
    expect(block).toContain("Newest entry");
    expect(block).toContain("Second entry");
    expect(block).toContain("Third entry");
    expect(block).toContain("Fourth entry");
  });

  it("does not print a 'Recent highlights' section when there's only one entry (edge case)", () => {
    const block = buildStatusBlock([{ date: "2026-08-21", headline: "Only entry", detail: "..." }]);
    expect(block).toContain("Only entry");
    expect(block).not.toContain("Recent highlights");
  });

  it("links to the real release-notes URL", () => {
    const block = buildStatusBlock([{ date: "2026-08-21", headline: "X", detail: "..." }]);
    expect(block).toContain("https://brodyhaar.com/release-notes");
  });

  it("is deterministic -- the same input always produces the same output", async () => {
    const notes = await loadReleaseNotes(FIXTURE_SOURCE);
    expect(buildStatusBlock(notes)).toBe(buildStatusBlock(notes));
  });
});

describe("applyStatusBlock", () => {
  const readmeTemplate = (middle: string) => `# Title\n\nIntro paragraph.\n\n${middle}\n\n## Next section\n`;

  it("replaces only the content between the markers, leaving everything else untouched", () => {
    const readme = readmeTemplate(`${START_MARKER}\nold content\n${END_MARKER}`);
    const result = applyStatusBlock(readme, `${START_MARKER}\nnew content\n${END_MARKER}`);
    expect(result).toContain("# Title");
    expect(result).toContain("Intro paragraph.");
    expect(result).toContain("## Next section");
    expect(result).toContain("new content");
    expect(result).not.toContain("old content");
  });

  it("is idempotent -- applying the same block twice produces the same result as applying it once", () => {
    const readme = readmeTemplate(`${START_MARKER}\nold content\n${END_MARKER}`);
    const block = `${START_MARKER}\nnew content\n${END_MARKER}`;
    const once = applyStatusBlock(readme, block);
    const twice = applyStatusBlock(once, block);
    expect(twice).toBe(once);
  });

  it("throws a clear error when the start marker is missing", () => {
    const readme = readmeTemplate(`old content\n${END_MARKER}`);
    expect(() => applyStatusBlock(readme, "new block")).toThrow(/RELEASE_STATUS:START/);
  });

  it("throws a clear error when the end marker is missing", () => {
    const readme = readmeTemplate(`${START_MARKER}\nold content`);
    expect(() => applyStatusBlock(readme, "new block")).toThrow(/RELEASE_STATUS:END/);
  });

  it("throws a clear error when both markers are missing entirely", () => {
    const readme = readmeTemplate("no markers here at all");
    expect(() => applyStatusBlock(readme, "new block")).toThrow();
  });

  it("throws a clear error when the markers are out of order", () => {
    const readme = readmeTemplate(`${END_MARKER}\nsomething\n${START_MARKER}`);
    expect(() => applyStatusBlock(readme, "new block")).toThrow(/out of order/);
  });

  it("throws a clear error when the start marker is duplicated", () => {
    const readme = readmeTemplate(`${START_MARKER}\nold\n${END_MARKER}\n\n${START_MARKER}\nold2\n${END_MARKER}`);
    expect(() => applyStatusBlock(readme, "new block")).toThrow(/more than one/);
  });
});

// Guards against future drift silently breaking the sync: the real
// release-notes.ts and README.md must satisfy the same contract the unit
// tests above verify against fixtures.
describe("against the real repository files", () => {
  it("parses the real release-notes.ts without error", async () => {
    const source = readFileSync(RELEASE_NOTES_PATH, "utf8");
    const notes = await loadReleaseNotes(source);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("finds real, correctly-ordered markers in the real README.md", () => {
    const readme = readFileSync(README_PATH, "utf8");
    expect(readme.indexOf(START_MARKER)).toBeGreaterThanOrEqual(0);
    expect(readme.indexOf(END_MARKER)).toBeGreaterThan(readme.indexOf(START_MARKER));
  });

  it("running the sync against the real files is a no-op (README is already up to date)", async () => {
    const notesSource = readFileSync(RELEASE_NOTES_PATH, "utf8");
    const notes = await loadReleaseNotes(notesSource);
    const block = buildStatusBlock(notes);
    const readme = readFileSync(README_PATH, "utf8");
    expect(applyStatusBlock(readme, block)).toBe(readme);
  });
});
