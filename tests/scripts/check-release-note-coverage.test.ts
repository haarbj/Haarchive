import { describe, expect, it } from "vitest";

import {
  buildWarningMessage,
  checkCoverage,
  isProductPath,
  RELEASE_NOTES_PATH,
} from "../../scripts/check-release-note-coverage.mjs";

describe("isProductPath", () => {
  it("flags src/app, src/components, src/lib, and supabase/migrations paths", () => {
    expect(isProductPath("src/app/release-notes/page.tsx")).toBe(true);
    expect(isProductPath("src/components/environmental-calculator.tsx")).toBe(true);
    expect(isProductPath("src/lib/environmental/altitude-engine.ts")).toBe(true);
    expect(isProductPath("supabase/migrations/20260821000000_new_table.sql")).toBe(true);
  });

  it("does not flag release-notes.ts itself, even though it's under src/lib/", () => {
    expect(isProductPath(RELEASE_NOTES_PATH)).toBe(false);
  });

  it("does not flag tests, docs, scripts, CI config, or root-level config/markdown", () => {
    expect(isProductPath("tests/lib/environmental/altitude-engine.test.ts")).toBe(false);
    expect(isProductPath("docs/release-documentation-investigation.md")).toBe(false);
    expect(isProductPath("scripts/sync-readme-status.mjs")).toBe(false);
    expect(isProductPath(".github/workflows/release-docs.yml")).toBe(false);
    expect(isProductPath("package.json")).toBe(false);
    expect(isProductPath("README.md")).toBe(false);
    expect(isProductPath("CLAUDE.md")).toBe(false);
  });

  it("does not flag public/ assets", () => {
    expect(isProductPath("public/homepage/new-photo.jpg")).toBe(false);
  });
});

describe("checkCoverage", () => {
  it("needs a flag when product code changed and release-notes.ts did not", () => {
    const result = checkCoverage(["src/components/environmental-calculator.tsx", "tests/lib/foo.test.ts"]);
    expect(result.needsFlag).toBe(true);
    expect(result.productPaths).toEqual(["src/components/environmental-calculator.tsx"]);
  });

  it("does not need a flag when release-notes.ts was updated alongside product code", () => {
    const result = checkCoverage(["src/components/environmental-calculator.tsx", RELEASE_NOTES_PATH]);
    expect(result.needsFlag).toBe(false);
    expect(result.touchedReleaseNotes).toBe(true);
  });

  it("does not need a flag when nothing product-facing changed at all", () => {
    const result = checkCoverage(["tests/lib/foo.test.ts", "docs/some-note.md", "README.md"]);
    expect(result.needsFlag).toBe(false);
    expect(result.productPaths).toEqual([]);
  });

  it("does not need a flag for an empty change set", () => {
    expect(checkCoverage([]).needsFlag).toBe(false);
  });

  it("does not need a flag when release-notes.ts is the only product-relevant change", () => {
    const result = checkCoverage([RELEASE_NOTES_PATH, "docs/note.md"]);
    expect(result.needsFlag).toBe(false);
  });
});

describe("buildWarningMessage", () => {
  it("lists every flagged path and points at release-notes.ts's own criteria", () => {
    const message = buildWarningMessage(["src/lib/foo.ts", "src/components/bar.tsx"]);
    expect(message).toContain("src/lib/foo.ts");
    expect(message).toContain("src/components/bar.tsx");
    expect(message).toContain(RELEASE_NOTES_PATH);
    expect(message).toContain("flag, not a requirement");
  });
});
