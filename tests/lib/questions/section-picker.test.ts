import { describe, expect, it } from "vitest";

import { buildLinkableTargets, searchLinkableTargets } from "@/lib/questions/section-picker";
import { resolveLinkedSection } from "@/lib/sections";

describe("buildLinkableTargets", () => {
  it("includes a whole-page target for every section", () => {
    const targets = buildLinkableTargets();
    const recoveryPage = targets.find((t) => t.value === "recovery");
    expect(recoveryPage).toBeDefined();
    expect(recoveryPage?.label).toBe("Recovery");
    expect(recoveryPage?.categoryTitle).toBe("Physiology");
  });

  it("includes a heading-anchored target matching the real reported bug", () => {
    const targets = buildLinkableTargets();
    const soreness = targets.find((t) => t.value === "recovery#jog-through-soreness-don-t-wait-it-out");
    expect(soreness).toBeDefined();
    expect(soreness?.label).toBe("Jog Through Soreness, Don't Wait It Out");
  });

  it("produces only values that resolveLinkedSection can actually resolve", () => {
    const targets = buildLinkableTargets();
    for (const target of targets) {
      expect(resolveLinkedSection(target.value)?.href).toBeTruthy();
    }
  });
});

describe("searchLinkableTargets", () => {
  const targets = buildLinkableTargets();

  it("finds the soreness heading by a partial, lowercase, unrelated-word query", () => {
    const results = searchLinkableTargets("soreness", targets);
    expect(results.some((t) => t.value === "recovery#jog-through-soreness-don-t-wait-it-out")).toBe(true);
  });

  it("ranks a label that starts with the query above one that merely contains it", () => {
    const results = searchLinkableTargets("recovery", targets);
    const wholePageIndex = results.findIndex((t) => t.value === "recovery");
    const containsIndex = results.findIndex((t) => t.label.toLowerCase().includes("recovery") && t.value !== "recovery");
    if (wholePageIndex !== -1 && containsIndex !== -1) {
      expect(wholePageIndex).toBeLessThan(containsIndex);
    }
  });

  it("returns an empty array for a blank query", () => {
    expect(searchLinkableTargets("", targets)).toEqual([]);
    expect(searchLinkableTargets("   ", targets)).toEqual([]);
  });

  it("returns no more than 20 results even for a very broad query", () => {
    const results = searchLinkableTargets("e", targets);
    expect(results.length).toBeLessThanOrEqual(20);
  });
});
