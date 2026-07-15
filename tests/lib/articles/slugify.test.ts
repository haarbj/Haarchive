import { describe, expect, it } from "vitest";

import { isReservedSlug, slugifyTitle } from "@/lib/articles/slugify";

describe("slugifyTitle", () => {
  it("lowercases and hyphenates a normal title", () => {
    expect(slugifyTitle("Whole Food Most of the Time")).toBe("whole-food-most-of-the-time");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugifyTitle("Fueling: What's Actually True?")).toBe("fueling-what-s-actually-true");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugifyTitle("  --Hello World--  ")).toBe("hello-world");
  });

  it("caps length at 80 characters", () => {
    const title = "a".repeat(200);
    expect(slugifyTitle(title).length).toBeLessThanOrEqual(80);
  });
});

describe("isReservedSlug", () => {
  it("flags a real Foundations section slug as reserved", () => {
    expect(isReservedSlug("recovery")).toBe(true);
  });

  it("flags a real category slug as reserved", () => {
    expect(isReservedSlug("the-science")).toBe(true);
  });

  it("does not flag a slug that isn't part of the Foundations site map", () => {
    expect(isReservedSlug("a-brand-new-contributor-essay")).toBe(false);
  });
});
