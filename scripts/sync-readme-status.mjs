#!/usr/bin/env node
// Regenerates README.md's RELEASE_STATUS block from src/lib/release-notes.ts
// -- the single source of truth for release history (see that file's own
// header, and docs/release-documentation-investigation.md for the full
// reasoning). Deterministic: no network call, no LLM, no invented content
// -- this only reformats data that already exists in release-notes.ts.
// Never touches anything in README.md outside the RELEASE_STATUS markers.
//
// Written as plain ESM, not TypeScript, on purpose: release-notes.ts's own
// DATA has no TypeScript syntax in it (only its type declaration and the
// array's own type annotation do, both stripped below before the file is
// evaluated as plain JS), so this avoids adding a ts-node/tsx-style
// runtime dependency just to run one small script -- see CLAUDE.md §10
// ("avoid unnecessary dependencies").
//
// Usage:
//   node scripts/sync-readme-status.mjs           # update README.md in place
//   node scripts/sync-readme-status.mjs --check    # exit 1 if it WOULD change, without writing (for CI)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
export const RELEASE_NOTES_PATH = path.join(REPO_ROOT, "src/lib/release-notes.ts");
export const README_PATH = path.join(REPO_ROOT, "README.md");

export const START_MARKER = "<!-- RELEASE_STATUS:START -->";
export const END_MARKER = "<!-- RELEASE_STATUS:END -->";

// Entries shown beyond the single "Latest update" line -- deliberately
// small (see the investigation report: "do NOT dump the entire
// release-notes history into README").
const RECENT_HIGHLIGHT_COUNT = 3;

const RELEASE_NOTES_URL = "https://brodyhaar.com/release-notes";

/**
 * release-notes.ts is otherwise-plain JavaScript wearing two small pieces
 * of TypeScript: the `ReleaseNote` type declaration, and the `: ReleaseNote[]`
 * annotation on the exported array. Strips exactly those two things (by
 * locating them structurally, not with a broad regex over the whole file)
 * so the rest can be evaluated as real JS -- correctly handling every
 * string-escaping edge case for free, since a real JS engine parses it,
 * not a hand-rolled pattern.
 */
export function stripReleaseNoteTypeAnnotations(sourceText) {
  const typeDeclaration = "export type ReleaseNote = {";
  const typeStart = sourceText.indexOf(typeDeclaration);
  if (typeStart === -1) {
    throw new Error(
      `Could not find "${typeDeclaration}" in release-notes.ts -- its shape may have changed. Update sync-readme-status.mjs to match.`,
    );
  }
  const typeEnd = sourceText.indexOf("};", typeStart);
  if (typeEnd === -1) {
    throw new Error("Found the ReleaseNote type declaration but not its closing \"};\" -- release-notes.ts may be malformed.");
  }
  const withoutType = sourceText.slice(0, typeStart) + sourceText.slice(typeEnd + 2);

  const arrayDeclaration = "export const releaseNotes: ReleaseNote[] = [";
  if (!withoutType.includes(arrayDeclaration)) {
    throw new Error(
      `Could not find "${arrayDeclaration}" in release-notes.ts -- its shape may have changed. Update sync-readme-status.mjs to match.`,
    );
  }
  return withoutType.replace(arrayDeclaration, "export const releaseNotes = [");
}

/** Evaluates release-notes.ts's data as real JavaScript (via a data: URL import -- no temp file, no eval()) and validates its shape. */
export async function loadReleaseNotes(sourceText) {
  const jsSource = stripReleaseNoteTypeAnnotations(sourceText);
  const dataUrl = `data:text/javascript;base64,${Buffer.from(jsSource, "utf8").toString("base64")}`;
  const mod = await import(dataUrl);

  if (!Array.isArray(mod.releaseNotes) || mod.releaseNotes.length === 0) {
    throw new Error("release-notes.ts produced an empty or invalid releaseNotes array -- refusing to generate an empty status block.");
  }
  for (const entry of mod.releaseNotes) {
    if (typeof entry?.date !== "string" || typeof entry?.headline !== "string") {
      throw new Error(`A release-notes.ts entry is missing a date or headline: ${JSON.stringify(entry)}`);
    }
  }
  return mod.releaseNotes;
}

function formatEntryDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Builds the full replacement block, markers included -- entries are assumed newest-first, matching release-notes.ts's own documented ordering. */
export function buildStatusBlock(releaseNotes) {
  const [latest, ...rest] = releaseNotes;
  const highlights = rest.slice(0, RECENT_HIGHLIGHT_COUNT);

  const lines = [
    START_MARKER,
    "### Current status",
    "",
    `**Latest update ([${formatEntryDate(latest.date)}](${RELEASE_NOTES_URL})):** ${latest.headline}`,
  ];

  if (highlights.length > 0) {
    lines.push("", "Recent highlights:");
    for (const entry of highlights) {
      lines.push(`- ${entry.headline} (${formatEntryDate(entry.date)})`);
    }
  }

  lines.push(
    "",
    `Full history: [brodyhaar.com/release-notes](${RELEASE_NOTES_URL})`,
    "",
    "<!-- Auto-generated by scripts/sync-readme-status.mjs from src/lib/release-notes.ts -- do not edit by hand. -->",
    END_MARKER,
  );

  return lines.join("\n");
}

/** Replaces only the text between the markers (markers included) -- everything else in README.md is byte-for-byte untouched. Throws if the markers are missing, duplicated, or out of order, rather than guessing. */
export function applyStatusBlock(readmeText, statusBlock) {
  const startIdx = readmeText.indexOf(START_MARKER);
  const endIdx = readmeText.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `README.md is missing ${startIdx === -1 ? START_MARKER : END_MARKER} -- add both markers (adjacent, with nothing meaningful between them) before running this script.`,
    );
  }
  if (endIdx < startIdx) {
    throw new Error(`README.md has ${END_MARKER} before ${START_MARKER} -- the markers are out of order.`);
  }
  if (readmeText.indexOf(START_MARKER, startIdx + 1) !== -1) {
    throw new Error(`README.md has more than one ${START_MARKER} -- remove the duplicate before running this script.`);
  }

  const before = readmeText.slice(0, startIdx);
  const after = readmeText.slice(endIdx + END_MARKER.length);
  return `${before}${statusBlock}${after}`;
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  const releaseNotesSource = readFileSync(RELEASE_NOTES_PATH, "utf8");
  const releaseNotes = await loadReleaseNotes(releaseNotesSource);
  const statusBlock = buildStatusBlock(releaseNotes);

  const currentReadme = readFileSync(README_PATH, "utf8");
  const nextReadme = applyStatusBlock(currentReadme, statusBlock);

  if (currentReadme === nextReadme) {
    console.log("README.md's status block is already up to date.");
    return;
  }

  if (checkOnly) {
    console.error("README.md's status block is out of date -- run `npm run sync:readme` to update it.");
    process.exitCode = 1;
    return;
  }

  writeFileSync(README_PATH, nextReadme);
  console.log("README.md's status block was updated.");
}

// Only run when executed directly (`node scripts/sync-readme-status.mjs`), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
