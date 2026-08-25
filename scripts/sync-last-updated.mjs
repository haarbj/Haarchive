#!/usr/bin/env node
// Keeps each Foundations section's `lastUpdated` field (src/lib/sections.ts)
// current automatically, instead of relying on a contributor to remember to
// hand-edit it -- see that field's own comment for the rationale. Uses the
// TypeScript compiler API (already a devDependency, not a new one) to find
// each section object's real line range and `slug`/`category`/`lastUpdated`
// property positions -- deliberately not a brace-counting regex, which
// could miscount braces that show up inside a section's own prose strings.
//
// "Changed" is derived from a real git diff, not a heuristic: a line that
// changed inside a given section's object literal means that section's
// content changed, so its `lastUpdated` gets bumped to today; sections with
// no changed lines are left untouched.
//
// Usage:
//   node scripts/sync-last-updated.mjs                        # diff against HEAD (local/uncommitted changes)
//   node scripts/sync-last-updated.mjs --before <sha> --after <sha>   # diff a specific range (CI)
//   node scripts/sync-last-updated.mjs --check                 # exit 1 if anything would change, without writing

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
export const RELATIVE_SECTIONS_PATH = "src/lib/sections.ts";
export const SECTIONS_PATH = path.join(REPO_ROOT, RELATIVE_SECTIONS_PATH);

const ALL_ZERO_SHA = "0000000000000000000000000000000000000000";
const INSERTED_INDENT = "    ";

/**
 * Parses sections.ts and returns one record per top-level section object in
 * the `sections` array: its `slug`, its line range (1-indexed, inclusive),
 * the end offset of its `category` property (used to find where to insert
 * a new `lastUpdated` line when one doesn't exist yet), and the exact
 * source span of its `lastUpdated` value (when one already exists, so it
 * can be replaced in place).
 */
export function findSectionRanges(sourceText) {
  const sourceFile = ts.createSourceFile(RELATIVE_SECTIONS_PATH, sourceText, ts.ScriptTarget.Latest, true);

  let sectionsArray = null;
  function findSectionsArray(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "sections" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      sectionsArray = node.initializer;
      return;
    }
    ts.forEachChild(node, findSectionsArray);
  }
  findSectionsArray(sourceFile);

  if (!sectionsArray) {
    throw new Error(
      `Could not find "export const sections: Section[] = [...]" in ${RELATIVE_SECTIONS_PATH} -- its shape may have changed. Update sync-last-updated.mjs to match.`,
    );
  }

  function findProp(element, name) {
    return element.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name,
    );
  }

  return sectionsArray.elements.map((element) => {
    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error("A non-object element was found in the sections array -- sections.ts may be malformed.");
    }
    const slugProp = findProp(element, "slug");
    if (!slugProp || !ts.isStringLiteral(slugProp.initializer)) {
      throw new Error("A section object is missing a plain string `slug` property.");
    }
    const categoryProp = findProp(element, "category");
    if (!categoryProp) {
      throw new Error(`Section "${slugProp.initializer.text}" has no \`category\` property -- can't find where to insert lastUpdated.`);
    }
    const lastUpdatedProp = findProp(element, "lastUpdated");
    const lastUpdatedValueSpan =
      lastUpdatedProp && ts.isStringLiteral(lastUpdatedProp.initializer)
        ? { start: lastUpdatedProp.initializer.getStart(sourceFile), end: lastUpdatedProp.initializer.getEnd() }
        : null;

    return {
      slug: slugProp.initializer.text,
      startLine: sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile)).line + 1,
      endLine: sourceFile.getLineAndCharacterOfPosition(element.getEnd()).line + 1,
      categoryEnd: categoryProp.getEnd(),
      lastUpdatedValueSpan,
    };
  });
}

/**
 * Parses `git diff --unified=0` output for a single file into the set of
 * line numbers touched in the "after" version of that file. A pure
 * deletion hunk (0-length "after" range) has no line of its own in the new
 * file, so it's attributed to the line immediately after the deletion
 * point -- the nearest surviving context -- rather than dropped entirely.
 */
export function parseChangedLineNumbers(diffText) {
  const changedLines = new Set();
  const hunkHeaderRe = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
  for (const line of diffText.split("\n")) {
    const match = hunkHeaderRe.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count === 0) {
      changedLines.add(start);
    } else {
      for (let i = 0; i < count; i++) changedLines.add(start + i);
    }
  }
  return changedLines;
}

/** Which sections' line ranges contain at least one changed line. */
export function findAffectedSlugs(sectionRanges, changedLines) {
  const affected = new Set();
  for (const line of changedLines) {
    const section = sectionRanges.find((s) => line >= s.startLine && line <= s.endLine);
    if (section) affected.add(section.slug);
  }
  return affected;
}

/**
 * Applies a `lastUpdated: "<todayIso>"` edit to every affected section:
 * replaces the existing value in place if one exists, otherwise inserts a
 * new line right after `category:`'s trailing comma (matching this file's
 * own established field order/indentation). Edits are applied bottom-to-top
 * so earlier offsets in the same pass stay valid.
 */
export function applyLastUpdatedEdits(sourceText, sectionRanges, affectedSlugs, todayIso) {
  const edits = [];
  for (const section of sectionRanges) {
    if (!affectedSlugs.has(section.slug)) continue;
    if (section.lastUpdatedValueSpan) {
      edits.push({ start: section.lastUpdatedValueSpan.start, end: section.lastUpdatedValueSpan.end, text: `"${todayIso}"` });
    } else {
      const commaIndex = sourceText.indexOf(",", section.categoryEnd);
      if (commaIndex === -1) {
        throw new Error(`Section "${section.slug}"'s \`category\` property has no trailing comma -- sections.ts may be malformed.`);
      }
      const insertAt = commaIndex + 1;
      edits.push({ start: insertAt, end: insertAt, text: `\n${INSERTED_INDENT}lastUpdated: "${todayIso}",` });
    }
  }
  edits.sort((a, b) => b.start - a.start);

  let result = sourceText;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

function runGitDiff(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

/** Resolves the actual `before`/`after` git refs to diff, handling the
 * "brand new branch" all-zero-SHA case the same way a push webhook can
 * report it: fall back to the after commit's own parent, or (a true
 * first-ever commit) treat every line as changed. */
function resolveDiffText({ before, after }) {
  if (!before && !after) {
    return runGitDiff(["diff", "--unified=0", "HEAD", "--", RELATIVE_SECTIONS_PATH]);
  }
  const resolvedAfter = after && after !== ALL_ZERO_SHA ? after : "HEAD";
  if (before && before !== ALL_ZERO_SHA) {
    return runGitDiff(["diff", "--unified=0", before, resolvedAfter, "--", RELATIVE_SECTIONS_PATH]);
  }
  try {
    return runGitDiff(["diff", "--unified=0", `${resolvedAfter}^`, resolvedAfter, "--", RELATIVE_SECTIONS_PATH]);
  } catch {
    // No parent commit exists (the very first commit in the repo) --
    // nothing to diff against, so the whole file counts as new/changed.
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const before = getArgValue(args, "--before");
  const after = getArgValue(args, "--after");

  const sourceText = readFileSync(SECTIONS_PATH, "utf8");
  const sectionRanges = findSectionRanges(sourceText);

  const diffText = resolveDiffText({ before, after });
  const affectedSlugs =
    diffText === null
      ? new Set(sectionRanges.map((s) => s.slug))
      : findAffectedSlugs(sectionRanges, parseChangedLineNumbers(diffText));

  if (affectedSlugs.size === 0) {
    console.log("No changed lines fall inside a section object -- nothing to update.");
    return;
  }

  const updated = applyLastUpdatedEdits(sourceText, sectionRanges, affectedSlugs, todayIsoDate());
  if (updated === sourceText) {
    console.log(`lastUpdated is already current for: ${[...affectedSlugs].join(", ")}.`);
    return;
  }

  if (checkOnly) {
    console.error(`lastUpdated is out of date for: ${[...affectedSlugs].join(", ")} -- run \`npm run sync:last-updated\` to update.`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(SECTIONS_PATH, updated);
  console.log(`Updated lastUpdated for: ${[...affectedSlugs].join(", ")}.`);
}

// Only run when executed directly (`node scripts/sync-last-updated.mjs`), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
