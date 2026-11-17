import { describe, expect, it } from "vitest";

import { ALLOWED_IMAGE_TYPES, resolveImageType, withResolvedContentType } from "@/lib/validation/image-upload";

// Real file header bytes, not invented -- the exact signature each format
// actually starts with.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const TEXT_BYTES = new TextEncoder().encode("not an image at all");

function blobOf(bytes: ArrayLike<number>, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

describe("resolveImageType", () => {
  it("trusts a correctly-declared type without reading the file", async () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(await resolveImageType(blobOf(new Uint8Array(), type))).toBe(type);
    }
  });

  it("normalizes the non-standard 'image/jpg' alias to 'image/jpeg'", async () => {
    expect(await resolveImageType(blobOf(JPEG_BYTES, "image/jpg"))).toBe("image/jpeg");
  });

  // The actual bug: an extensionless file (saved from a chat app, a
  // screenshot tool, a clipboard paste) reports file.type === "" even
  // though it's a perfectly normal image -- verified directly against a
  // real, extensionless JPEG via Playwright before this fix (see the
  // upload actions' own comment). A bare `ALLOWED_IMAGE_TYPES.has("")`
  // rejected every one of these as "Unsupported image type."
  it("sniffs the real file header when the browser couldn't declare a type", async () => {
    expect(await resolveImageType(blobOf(JPEG_BYTES, ""))).toBe("image/jpeg");
    expect(await resolveImageType(blobOf(PNG_BYTES, ""))).toBe("image/png");
    expect(await resolveImageType(blobOf(GIF_BYTES, ""))).toBe("image/gif");
    expect(await resolveImageType(blobOf(WEBP_BYTES, ""))).toBe("image/webp");
  });

  it("also sniffs when the declared type is simply wrong, not just missing", async () => {
    expect(await resolveImageType(blobOf(PNG_BYTES, "application/octet-stream"))).toBe("image/png");
  });

  it("returns null for a genuinely unsupported file, declared or not", async () => {
    expect(await resolveImageType(blobOf(TEXT_BYTES, ""))).toBeNull();
    expect(await resolveImageType(blobOf(TEXT_BYTES, "text/plain"))).toBe(null);
  });
});

describe("withResolvedContentType", () => {
  // The remaining half of the same real bug: @supabase/storage-js's
  // upload() ignores its own `contentType` fileOption whenever the body
  // is already a Blob/File -- it appends the Blob into FormData as-is,
  // so the Content-Type that reaches Supabase Storage is the Blob's own
  // intrinsic `.type`, not the resolved type resolveImageType computed
  // for validation. Confirmed against the real package source (see this
  // function's own comment). An extensionless file's own `.type` is
  // still "" even after resolveImageType correctly identifies it as a
  // real JPEG for validation purposes -- this is what has to carry that
  // resolved type into the actual upload body.
  it("rewraps a file whose own declared type doesn't match what was resolved", async () => {
    const original = blobOf(JPEG_BYTES, "");
    const wrapped = withResolvedContentType(original, "image/jpeg");
    expect(wrapped.type).toBe("image/jpeg");
    expect(await wrapped.arrayBuffer()).toEqual(await original.arrayBuffer());
  });

  it("returns the original blob untouched when its type already matches", async () => {
    const original = blobOf(JPEG_BYTES, "image/jpeg");
    expect(withResolvedContentType(original, "image/jpeg")).toBe(original);
  });
});
