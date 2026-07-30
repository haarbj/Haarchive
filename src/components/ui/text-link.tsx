// The inline-prose underline-link pattern, hand-duplicated across the
// article/section renderers and a handful of other prose call sites with
// drifted decoration opacity and a sometimes-missing `transition`. Compose
// with additional classes (font-weight, color) via a template literal --
// callers vary those intentionally by context, so this only owns the
// underline mechanics.
export const textLinkClass =
  "underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70";
