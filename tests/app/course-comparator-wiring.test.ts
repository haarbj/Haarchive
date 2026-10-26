import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no React component-rendering harness exists in this
// repo -- see today-conditions-wiring.test.ts's own header comment for
// the established pattern). The race database and its derivation logic
// are covered directly by marathons.test.ts; this file is about the
// picker's own wiring: defaults, the dirty-label flip, and that the
// comparison engine/verdict logic is never touched.

const ROOT = join(__dirname, "../..");
const COMPARATOR = readFileSync(join(ROOT, "src/components/course-comparator.tsx"), "utf8");
const SECTIONS = readFileSync(join(ROOT, "src/lib/sections.ts"), "utf8");

describe("default view: Chicago vs Tucson, filled immediately", () => {
  it("both default picker values resolve to real race ids", () => {
    expect(COMPARATOR).toContain('const DEFAULT_PICKER_A = "chicago"');
    expect(COMPARATOR).toContain('const DEFAULT_PICKER_B = "tucson"');
  });

  it("the initial manual state for each side is derived from that default race, not left blank", () => {
    expect(COMPARATOR).toContain("initialManualForPicker(DEFAULT_PICKER_A)");
    expect(COMPARATOR).toContain("initialManualForPicker(DEFAULT_PICKER_B)");
  });

  // Regression test for the actual shipped bug: a returning visitor's
  // OLD localStorage blob (saved under the pre-race-picker key, with the
  // old blank-course shape) silently won the `persistedValue ??
  // defaultValue` fallback over the new race-filled defaults -- the
  // picker showed Chicago/Tucson selected (pickerA/pickerB didn't exist
  // in the old shape, so THOSE correctly defaulted) while every other
  // field (manualA/manualB/labelAInput/labelBInput, which DID exist in
  // the old shape) stayed blank. Reproduced live via Playwright against
  // a real dev server with a seeded old-shaped blob under the literal
  // pre-fix key below, confirmed broken before this version bump and
  // fixed after. This exact literal string must never be the live
  // storage key again.
  it("the storage key was bumped past the pre-race-picker version, so old incompatible blobs can never shadow the new race-filled defaults", () => {
    expect(COMPARATOR).not.toContain('const STORAGE_KEY = "haarchive-course-comparator-state";');
    expect(COMPARATOR).toMatch(/const STORAGE_KEY = "haarchive-course-comparator-state-v\d+";/);
  });
});

describe("picking a race fills the existing manual-entry fields, never a new engine input", () => {
  it("the picker's onChange fills courseDistanceMilesInput/totalGainFtInput/totalLossFtInput/climbs via manualStateFromRace", () => {
    expect(COMPARATOR).toContain("function manualStateFromRace(race: RaceRecord): ManualCourseState {");
    expect(COMPARATOR).toContain("courseDistanceMilesInput: String(race.distanceMi)");
    expect(COMPARATOR).toContain("climbs: climbsForRace(race)");
  });

  it("climbs are derived fresh from the race's own profile (climbsForRace), never read from a hand-typed field on the race record", () => {
    expect(COMPARATOR).not.toMatch(/race\.climbs\b/);
  });

  it("the comparison engine itself (compare.ts) is never imported with a different signature or re-implemented here", () => {
    expect(COMPARATOR).toContain('from "@/lib/course-comparator/compare"');
    expect(COMPARATOR).toContain("compareCourses(profileA, labelAInput.trim()");
  });
});

describe("editing a filled value flips the card to the custom label", () => {
  it("onLabelChange and onManualChange both set dirty when a race is currently selected", () => {
    const labelHandlerStart = COMPARATOR.indexOf("onLabelChange={(next) => {\n            setLabelAInput(next);");
    expect(labelHandlerStart).toBeGreaterThan(-1);
    const labelHandlerBody = COMPARATOR.slice(labelHandlerStart, labelHandlerStart + 300);
    expect(labelHandlerBody).toContain("if (selectedRaceA) {");
    expect(labelHandlerBody).toContain("setDirtyA(true)");
  });

  it("selecting a new race (or custom/gps) always resets dirty back to false", () => {
    expect(COMPARATOR).toContain("setDirty(false);");
  });

  it("the dirty label reads 'Custom (based on <race name>)', shown only while dirty", () => {
    expect(COMPARATOR).toMatch(/Custom \(based on \{selectedRace\.name\}\)/);
    expect(COMPARATOR).toContain("{selectedRace && dirty ? (");
  });

  it("the extras info block is shown only while NOT dirty -- hidden the moment a filled value is edited", () => {
    expect(COMPARATOR).toContain("{selectedRace && !dirty ? <RaceExtrasPanel race={selectedRace} /> : null}");
  });
});

describe("manual and GPS fallback modes are preserved unchanged", () => {
  it("the picker still offers Custom course (manual entry) and GPS route as real options", () => {
    expect(COMPARATOR).toContain("Custom course (manual entry)");
    expect(COMPARATOR).toContain("<option value={GPS_PICKER_VALUE}>GPS route</option>");
  });

  it("GPS mode still renders RouteImportPanel and falls back to custom on an analysis failure, same as before", () => {
    expect(COMPARATOR).toContain("<RouteImportPanel onRouteLoaded={onRouteLoaded} />");
    expect(COMPARATOR).toContain("setPicker(CUSTOM_PICKER_VALUE);");
  });

  it("the honest-caveats section, the Race Pace Planner link, and the 15ft/mi noise-floor copy are all unchanged", () => {
    expect(COMPARATOR).toContain("Honest caveats");
    expect(COMPARATOR).toContain("/race-pace-planner");
    expect(COMPARATOR).toContain("15ft/mi noise floor");
  });
});

describe("no em dashes in any new UI copy", () => {
  it("course-comparator.tsx contains no em dash character", () => {
    expect(COMPARATOR).not.toContain("—");
  });
});

describe("the tools-index copy mentions the race database", () => {
  it("the course-comparator section entry in sections.ts was updated", () => {
    const start = SECTIONS.indexOf('slug: "course-comparator"');
    const block = SECTIONS.slice(start, start + 600);
    expect(block.toLowerCase()).toMatch(/real race|race database|pick a real race/);
  });
});
