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
