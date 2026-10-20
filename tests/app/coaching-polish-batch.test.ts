import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Regression coverage for the Oct 19 production-polish batch. No React
// component-rendering harness exists in this repo (vitest.config.ts runs
// in a plain node environment), so the three source-copy/structure
// assertions below read the real files directly and check their actual
// string content -- the same technique tests/scripts/sync-readme-status.
// test.ts already uses for asserting on real file contents, rather than a
// fabricated render test.

const COACHING_ROOT = join(__dirname, "../../src/app/(app)/(protected)/coaching");
const COACHING_PAGE = join(COACHING_ROOT, "page.tsx");
const ATHLETE_DETAIL_PAGE = join(COACHING_ROOT, "athletes/[athleteId]/page.tsx");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("1. leaked dev seed command", () => {
  const DEV_COMMAND_PATTERNS = [/npm run seed/, /npx tsx scripts\//, /seed:framework-programs/];

  it("the seed:framework-programs shell command no longer appears anywhere under the coaching routes", () => {
    for (const file of walk(COACHING_ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of DEV_COMMAND_PATTERNS) {
        expect(pattern.test(source), `${file} still contains a leaked dev command matching ${pattern}`).toBe(false);
      }
    }
  });

  it("the same dev-command pattern is absent from the shared private-coaching components too", () => {
    const sharedRoot = join(__dirname, "../../src/components/private-coaching");
    for (const file of walk(sharedRoot)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of DEV_COMMAND_PATTERNS) {
        expect(pattern.test(source), `${file} still contains a leaked dev command matching ${pattern}`).toBe(false);
      }
    }
  });
});

describe("2. roster nav link", () => {
  it("the coach home section links to /coaching/roster regardless of whether the coach currently has only themselves on their roster", () => {
    const source = readFileSync(COACHING_PAGE, "utf8");
    // Both branches of the isSelfOnly conditional must offer the Roster
    // link -- previously only the non-self-only branch did, making
    // /coaching/roster unreachable by any link for a self-only coach.
    const rosterLinkCount = (source.match(/href="\/coaching\/roster"/g) ?? []).length;
    expect(rosterLinkCount).toBeGreaterThanOrEqual(2);
  });

  it("the roster link uses the real Button component, not a plain unstyled anchor (matches the existing nav items' styling)", () => {
    const source = readFileSync(COACHING_PAGE, "utf8");
    expect(source).toMatch(/<Button href="\/coaching\/roster"[^>]*>\s*Roster\s*<\/Button>/);
  });
});

describe("3. self-coach copy", () => {
  it("no longer tells a coach-less athlete they are \"coaching themselves\"", () => {
    const source = readFileSync(COACHING_PAGE, "utf8");
    expect(source).not.toMatch(/coaching yourself/i);
  });

  it("reads as a neutral no-coach-assigned statement instead", () => {
    const source = readFileSync(COACHING_PAGE, "utf8");
    expect(source).toMatch(/No coach assigned/i);
  });
});

describe("4. combobox: shared datalist ids are unique per instance", () => {
  it("DayVocabularyFields no longer hardcodes its datalist ids as plain string literals", () => {
    const source = readFileSync(join(__dirname, "../../src/components/private-coaching/day-vocabulary-fields.tsx"), "utf8");
    expect(source).not.toContain('list="day-label-suggestions"');
    expect(source).not.toContain('list="xt-type-suggestions"');
    expect(source).not.toContain('<datalist id="day-label-suggestions">');
    expect(source).not.toContain('<datalist id="xt-type-suggestions">');
    expect(source).toContain("useId");
  });

  it("ExtrasEditor's per-row datalist id is likewise unique per instance, not a shared static string", () => {
    const source = readFileSync(join(__dirname, "../../src/components/private-coaching/extras-editor.tsx"), "utf8");
    expect(source).not.toContain('list="extra-kind-suggestions"');
    expect(source).not.toContain('<datalist id="extra-kind-suggestions">');
    expect(source).toContain("useId");
  });
});

describe("5. unlabeled mileage inputs", () => {
  it("program-form.tsx's mileage min/max inputs each carry their own accessible label", () => {
    const source = readFileSync(join(__dirname, "../../src/app/(app)/(protected)/coaching/programs/program-form.tsx"), "utf8");
    expect(source).toContain('aria-label="Initial mileage minimum (mi/wk)"');
    expect(source).toContain('aria-label="Initial mileage maximum (mi/wk)"');
    expect(source).toContain('aria-label="Peak mileage minimum (mi/wk)"');
    expect(source).toContain('aria-label="Peak mileage maximum (mi/wk)"');
  });
});

describe("6. check-in note renders in full", () => {
  const LONG_NOTE =
    "Felt surprisingly good this week despite the heat -- the long run on Saturday was the best I've felt in months, " +
    "legs were fresh the whole way and I actually negative-split the back half without trying to. Sleep has been " +
    "inconsistent though, probably averaging 6 hours a night instead of my usual 7.5, and I noticed my resting heart " +
    "rate creeping up a few beats by Thursday. Nothing that felt like it affected the workouts, just wanted to flag it " +
    "in case it's worth watching. Also switched shoes mid-week for the tempo run and they felt great, might make that " +
    "the regular tempo/interval shoe going forward if Saturday's long run in them goes well too.";

  const NOTE_BLOCK_WINDOW = 900;

  it("the check-in note paragraph has no truncating CSS class (truncate / line-clamp)", () => {
    const source = readFileSync(ATHLETE_DETAIL_PAGE, "utf8");
    const noteBlockMatch = source.match(new RegExp(`checkin\\.notes[\\s\\S]{0,${NOTE_BLOCK_WINDOW}}`));
    expect(noteBlockMatch, "could not find the checkin.notes rendering block").toBeTruthy();
    const block = noteBlockMatch![0];
    expect(block).not.toMatch(/\btruncate\b/);
    expect(block).not.toMatch(/\bline-clamp-\d/);
  });

  it("the full long note text is never sliced/substringed before rendering", () => {
    const source = readFileSync(ATHLETE_DETAIL_PAGE, "utf8");
    const noteBlockMatch = source.match(new RegExp(`checkin\\.notes[\\s\\S]{0,${NOTE_BLOCK_WINDOW}}`));
    const block = noteBlockMatch![0];
    expect(block).not.toMatch(/\.slice\(/);
    expect(block).not.toMatch(/\.substring\(/);
    // Sanity check on the fixture itself -- a genuinely long note (matching
    // what QA would have typed) to document what "no truncation" is meant
    // to preserve; there is no render harness to mount the real component
    // against, so this documents the invariant the source-level checks
    // above enforce.
    expect(LONG_NOTE.length).toBeGreaterThan(400);
  });

  it("the note paragraph has a scrollable max-height, not an unbounded one that could visually overrun the card", () => {
    const source = readFileSync(ATHLETE_DETAIL_PAGE, "utf8");
    const noteBlockMatch = source.match(new RegExp(`checkin\\.notes[\\s\\S]{0,${NOTE_BLOCK_WINDOW}}`));
    const block = noteBlockMatch![0];
    expect(block).toMatch(/max-h-\d+/);
    expect(block).toMatch(/overflow-y-auto/);
  });
});
