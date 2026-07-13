// Mirrors the `--container-*` custom properties in src/app/globals.css.
// Tailwind can't read a .ts file, so those CSS values are the actual
// source of truth for what renders -- this file exists only for the rare
// case something needs the raw number in JS (not a Tailwind class) rather
// than a `max-w-*` utility. Keep both in sync by hand when a width changes.
export const layout = {
  chrome: "1080px",
  content: "1080px",
  dashboard: "900px",
  narrow: "680px",
  auth: "400px",
  articleProse: "72ch",
} as const;

export type LayoutToken = keyof typeof layout;
