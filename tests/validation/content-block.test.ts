import { describe, expect, it } from "vitest";

import { contentBlockSchema, contentBlocksSchema } from "@/lib/validation/content-block";

describe("contentBlockSchema", () => {
  it("accepts a valid heading block", () => {
    expect(contentBlockSchema.safeParse({ type: "heading", text: "Recovery" }).success).toBe(true);
  });

  it("rejects a heading with empty text", () => {
    expect(contentBlockSchema.safeParse({ type: "heading", text: "" }).success).toBe(false);
  });

  it("accepts a paragraph block with an optional link", () => {
    const result = contentBlockSchema.safeParse({
      type: "paragraph",
      text: "See the research library",
      linkHref: "/research-library",
      linkText: "here",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a list block with zero items", () => {
    expect(contentBlockSchema.safeParse({ type: "list", items: [] }).success).toBe(false);
  });

  it("accepts a callout block with only items, no text", () => {
    const result = contentBlockSchema.safeParse({ type: "callout", variant: "tip", items: ["Do this", "Not that"] });
    expect(result.success).toBe(true);
  });

  it("rejects a callout with an unrecognized variant", () => {
    const result = contentBlockSchema.safeParse({ type: "callout", variant: "nonsense", text: "x" });
    expect(result.success).toBe(false);
  });

  it("accepts an image block with an https URL", () => {
    const result = contentBlockSchema.safeParse({ type: "image", url: "https://example.com/photo.jpg" });
    expect(result.success).toBe(true);
  });

  it("rejects an image block with a non-http(s) URL", () => {
    const result = contentBlockSchema.safeParse({ type: "image", url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    expect(contentBlockSchema.safeParse({ type: "video", url: "https://example.com" }).success).toBe(false);
  });
});

describe("contentBlocksSchema", () => {
  it("accepts an empty array", () => {
    expect(contentBlocksSchema.safeParse([]).success).toBe(true);
  });

  it("accepts a mixed sequence of valid blocks", () => {
    const result = contentBlocksSchema.safeParse([
      { type: "heading", text: "Intro" },
      { type: "paragraph", text: "Some text." },
      { type: "list", items: ["a", "b"] },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects the whole array if one block is invalid", () => {
    const result = contentBlocksSchema.safeParse([{ type: "heading", text: "Intro" }, { type: "heading", text: "" }]);
    expect(result.success).toBe(false);
  });
});
