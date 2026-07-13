import { generateObject } from "ai";
import { describe, expect, it, vi } from "vitest";

import { runSiteSearch } from "@/lib/search/run-search";

// The model itself is never really invoked in these tests (generateObject is
// mocked below), but importing the real @ai-sdk/groq provider factory has no
// business running in a unit test regardless -- swapped for a plain string,
// since runSiteSearch only ever forwards it through to generateObject.
vi.mock("@/lib/ai/model", () => ({
  structuredOutputModel: "mock-model",
  coachModel: "mock-model",
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

describe("runSiteSearch", () => {
  it("returns empty results for an empty or whitespace-only query", async () => {
    expect(await runSiteSearch("")).toEqual({ matches: [], aiSuggestions: [] });
    expect(await runSiteSearch("   ")).toEqual({ matches: [], aiSuggestions: [] });
  });

  it("finds a section by title without reaching for the AI fallback", async () => {
    const result = await runSiteSearch("nutrition");
    expect(result.matches.some((m) => m.title === "Nutrition & Fueling")).toBe(true);
    expect(result.aiSuggestions).toEqual([]);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("finds a body-text match via retrieval, not just titles and headings", async () => {
    // "windsprints" isn't a section or heading title anywhere -- it only
    // shows up inside a list item's body text (see retrieval.test.ts), so a
    // hit here proves the body-text merge is actually contributing, not
    // just the pre-existing title/heading index.
    const result = await runSiteSearch("windsprints");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("skips the AI fallback for a short query even when nothing matches", async () => {
    const result = await runSiteSearch("xyz");
    expect(result.matches).toEqual([]);
    expect(result.aiSuggestions).toEqual([]);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("degrades to no suggestions, without throwing, if the model call fails", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("rate limited"));
    const result = await runSiteSearch("xyzzy plugh qwzxcv");
    expect(result.matches).toEqual([]);
    expect(result.aiSuggestions).toEqual([]);
  });

  it("maps a valid AI fallback response onto real section entries", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { slugs: ["exercise-physiology"] },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await runSiteSearch("xyzzy plugh qwzxcv");
    expect(result.matches).toEqual([]);
    expect(result.aiSuggestions).toEqual([expect.objectContaining({ href: "/exercise-physiology" })]);
  });

  it("drops an AI-suggested slug that doesn't exist rather than rendering a dead link", async () => {
    // generateObject is mocked here, so this bypasses the real schema
    // enforcement the enum gives in production -- it's specifically
    // targeting fetchAiFallback's own sectionBySlug lookup as a second,
    // independent guard against ever mapping a bad slug to a dead link.
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { slugs: ["totally-fake-slug"] },
    } as Awaited<ReturnType<typeof generateObject>>);

    const result = await runSiteSearch("xyzzy plugh qwzxcv");
    expect(result.aiSuggestions).toEqual([]);
  });
});
