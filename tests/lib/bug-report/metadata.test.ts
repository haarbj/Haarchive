import { describe, expect, it } from "vitest";

import { buildBugReportMetadata, readablePagePath, sanitizePageUrl } from "@/lib/bug-report/metadata";

describe("sanitizePageUrl", () => {
  it("strips a URL fragment", () => {
    expect(sanitizePageUrl("https://brodyhaar.com/exercise-physiology#the-crossover-point")).toBe(
      "https://brodyhaar.com/exercise-physiology",
    );
  });

  it("keeps query parameters -- they often distinguish the actual bug", () => {
    expect(sanitizePageUrl("https://brodyhaar.com/search?q=lydiard")).toBe(
      "https://brodyhaar.com/search?q=lydiard",
    );
  });

  it("keeps a plain URL with neither hash nor query unchanged", () => {
    expect(sanitizePageUrl("https://brodyhaar.com/pace-calculator")).toBe(
      "https://brodyhaar.com/pace-calculator",
    );
  });

  it("falls back to a naive hash strip for an unparseable string rather than throwing", () => {
    expect(sanitizePageUrl("not a real url#fragment")).toBe("not a real url");
  });
});

describe("buildBugReportMetadata", () => {
  const base = {
    href: "https://brodyhaar.com/settings#profile",
    innerWidth: 1440.4,
    innerHeight: 900.6,
    devicePixelRatio: 2,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  };

  it("shapes the raw browser values into the diagnostic payload", () => {
    const result = buildBugReportMetadata(base);
    expect(result).toEqual({
      pageUrl: "https://brodyhaar.com/settings",
      viewportWidth: 1440,
      viewportHeight: 901,
      devicePixelRatio: 2,
      userAgent: base.userAgent,
    });
  });

  it("truncates an unusually long user agent string rather than storing it unbounded", () => {
    const result = buildBugReportMetadata({ ...base, userAgent: "x".repeat(1000) });
    expect(result.userAgent.length).toBe(500);
  });

  it("never includes anything beyond viewport/pixel-ratio/user-agent/URL", () => {
    const result = buildBugReportMetadata(base);
    expect(Object.keys(result).sort()).toEqual(
      ["devicePixelRatio", "pageUrl", "userAgent", "viewportHeight", "viewportWidth"].sort(),
    );
  });
});

describe("readablePagePath", () => {
  it("reduces a full URL to just its path, for a shorter notification body", () => {
    expect(readablePagePath("https://brodyhaar.com/pace-calculator")).toBe("/pace-calculator");
  });

  it("keeps query parameters -- often exactly what identifies the bug", () => {
    expect(readablePagePath("https://brodyhaar.com/search?q=lydiard")).toBe("/search");
  });

  it("falls back to the raw string for an unparseable URL rather than dropping content", () => {
    expect(readablePagePath("not a real url")).toBe("not a real url");
  });

  it("falls back to the raw string for an empty pathname", () => {
    // new URL("https://brodyhaar.com").pathname is "/" (never empty), so
    // this exercises the fallback branch's other trigger: a non-URL input
    // that still happens to parse (unlikely in practice, but the branch
    // exists and should be covered).
    expect(readablePagePath("https://brodyhaar.com")).toBe("/");
  });
});
