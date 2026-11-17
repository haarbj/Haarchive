// Shared by every "upload a photo" server action (uploadArticleImage,
// uploadAvatarImage) and by ImageUrlField (the one shared upload UI both
// plug into, src/components/ui/image-url-field.tsx) -- previously each
// action independently redeclared the same two constants, and nothing
// client-side knew the limit at all, so an oversized file only ever found
// out server-side, after already being multipart-encoded and sent.
//
// 8 MB, not next.config.ts's 9 MB serverActions.bodySizeLimit: that 9 MB
// figure already includes multipart overhead on top of this real file-size
// cap (see next.config.ts's own comment) -- a file right at 8 MB, once
// multipart-encoded, still needs to clear the 9 MB wall Next enforces
// before any action code runs at all. Keep both in sync if either changes.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES_LABEL = "8 MB";

// Real file header signatures for the four allowed formats -- the
// fallback for resolveImageType below, when the browser couldn't supply a
// usable `file.type`. WebP needs two separate checks (a RIFF container
// with a WEBP four-byte tag at offset 8), not one contiguous signature.
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38]; // "GIF8" -- covers both GIF87a and GIF89a

function matchesMagic(head: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, i) => head[i] === byte);
}

function isWebp(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  const riff = String.fromCharCode(head[0], head[1], head[2], head[3]);
  const webp = String.fromCharCode(head[8], head[9], head[10], head[11]);
  return riff === "RIFF" && webp === "WEBP";
}

/**
 * The one real check every "is this an allowed image" call site should
 * use instead of a bare `ALLOWED_IMAGE_TYPES.has(file.type)`.
 *
 * `file.type` is the browser's own guess, normally derived from the
 * file's extension -- and it's simply empty ("") whenever the browser or
 * OS can't make that guess, which is a real, common case: an
 * extensionless file (saved from a chat app, a screenshot tool, a
 * clipboard paste, anything that doesn't preserve a ".jpg"/".png" suffix)
 * reports file.type === "" even though it's a perfectly normal JPEG --
 * verified directly against a real, extensionless JPEG via Playwright,
 * not assumed. An exact-match check on that empty string rejected every
 * such file as "Unsupported image type," which is exactly the false
 * rejection a real bug report described ("Image uploading not working.
 * Image is in JPG format.").
 *
 * Trusts file.type first when it's already one of the four allowed
 * values (the fast, common path -- no need to read the file for that),
 * normalizes the one known non-standard alias some systems report
 * ("image/jpg" instead of "image/jpeg"), and only falls back to sniffing
 * the real file header when the declared type is missing or unrecognized.
 * Returns the resolved, canonical MIME type to actually use (for the
 * Storage upload's own contentType and the stored file's extension) --
 * never the raw, possibly-empty file.type -- or null if this genuinely
 * isn't one of the four allowed formats.
 */
export async function resolveImageType(file: Blob): Promise<string | null> {
  const declared = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (ALLOWED_IMAGE_TYPES.has(declared)) return declared;

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (matchesMagic(head, JPEG_MAGIC)) return "image/jpeg";
  if (matchesMagic(head, PNG_MAGIC)) return "image/png";
  if (matchesMagic(head, GIF_MAGIC)) return "image/gif";
  if (isWebp(head)) return "image/webp";
  return null;
}

/**
 * Every upload call site must pass the result of this (not the original
 * `file`) as the body to `admin.storage.from(...).upload(...)`.
 *
 * @supabase/storage-js's own upload() takes a `contentType` fileOption,
 * but silently ignores it whenever the upload body is already a
 * Blob/File instance (see StorageFileApi.ts's uploadOrUpdate: that branch
 * just does `body.append('', fileBody)` into a FormData and never reads
 * options.contentType at all) -- the Content-Type that actually reaches
 * Supabase Storage is whatever the Blob/File's own intrinsic `.type`
 * already is. For an extensionless file resolveImageType correctly
 * resolves to e.g. "image/jpeg" for *validation*, but the original
 * File object handed to upload() still has `.type === ""`, which
 * Supabase/fetch defaults to "application/octet-stream" on the wire --
 * then rejected by the bucket's own allowed_mime_types check. Confirmed
 * live: the crop path (always re-encodes via canvas.toBlob as a genuine
 * image/jpeg Blob) worked; the raw/"use original" path (the unmodified
 * File, type "") still failed with exactly that Supabase-side rejection.
 * Wrapping the file in a fresh Blob with the resolved type fixes this at
 * the source, rather than trusting the ignored contentType option.
 */
export function withResolvedContentType(file: Blob, resolvedType: string): Blob {
  return file.type === resolvedType ? file : new Blob([file], { type: resolvedType });
}
