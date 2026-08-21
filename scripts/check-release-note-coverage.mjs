#!/usr/bin/env node
// Flags -- never blocks, never auto-writes -- a push whose changed files
// look like a product-code change but don't touch src/lib/release-notes.ts.
// This is Tier 2's safety net for Tier 1 (see CLAUDE.md and
// release-notes.ts's own header): the commit that ships a change is
// supposed to update release-notes.ts itself, with real product context;
// this only catches the case where that step got skipped.
//
// Classification is a simple, transparent path allowlist, not Conventional
// Commits or PR labels -- this repo has neither (see
// docs/release-documentation-investigation.md). Deliberately biased toward
// over-flagging: a human/agent dismissing an occasional false positive is
// cheap, silently missing a real shipped feature is the actual problem.
//
// Usage: git diff --name-only <range> | node scripts/check-release-note-coverage.mjs

import { createInterface } from "node:readline";

export const RELEASE_NOTES_PATH = "src/lib/release-notes.ts";

// Paths whose changes plausibly represent a product-facing change, based
// on this repo's actual top-level structure (see `ls src/`, `ls supabase/`)
// -- not a generic assumption. Everything else (tests/, docs/, scripts/,
// .github/, public/, root-level config and markdown files) is ignored.
export const PRODUCT_PATH_PREFIXES = ["src/app/", "src/components/", "src/lib/", "supabase/migrations/"];

export function isProductPath(filePath) {
  if (filePath === RELEASE_NOTES_PATH) return false;
  return PRODUCT_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

export function checkCoverage(changedPaths) {
  const touchedReleaseNotes = changedPaths.includes(RELEASE_NOTES_PATH);
  const productPaths = changedPaths.filter(isProductPath);
  const needsFlag = productPaths.length > 0 && !touchedReleaseNotes;
  return { needsFlag, productPaths, touchedReleaseNotes };
}

export function buildWarningMessage(productPaths) {
  const list = productPaths.map((p) => `  - ${p}`).join("\n");
  return (
    `This push touched product code without updating ${RELEASE_NOTES_PATH}:\n${list}\n\n` +
    "If this change is something a returning reader or contributor would actually notice, add an entry to " +
    `${RELEASE_NOTES_PATH} (see that file's own header for the exact criteria and format). ` +
    "If it's genuinely internal-only (a refactor, a test, a config change), no action needed -- this is a flag, not a requirement."
  );
}

async function readStdinLines() {
  const lines = [];
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }
  return lines;
}

async function main() {
  const changedPaths = await readStdinLines();
  const { needsFlag, productPaths } = checkCoverage(changedPaths);

  if (!needsFlag) {
    console.log(
      changedPaths.length === 0
        ? "No changed paths to check."
        : "Release-note coverage looks fine (no product-code changes, or release-notes.ts was already updated).",
    );
    return;
  }

  const message = buildWarningMessage(productPaths);
  // GitHub Actions workflow-annotation syntax -- surfaces in the job
  // summary and commit checks UI without failing the job.
  console.log(`::warning title=Release note may be missing::${message.replace(/\n/g, "%0A")}`);
  console.log(message);
}

// Only run when executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
