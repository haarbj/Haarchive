// A reference, not a mechanism -- see the comment in globals.css for why
// this isn't a --spacing-* theme scale: xs/sm/md/lg/xl/2xl collide with
// keywords Tailwind's max-width/container/breakpoint scales already use,
// and defining them silently broke max-w-sm/xl/2xl sitewide the first
// time this was tried. Use the plain Tailwind numeric utility on the
// right directly (p-6, gap-4, mt-10, ...); this table just documents
// which numeric value plays which semantic role, so new code picks the
// same one an existing page already uses for the same job.
export const spacing = {
  xs: { tailwind: "1 / 1.5", note: "tight label/heading gaps (mt-1, mt-1.5)" },
  sm: { tailwind: "2 / 3", note: "small gaps between related elements (mt-2, mt-3, gap-2, gap-3)" },
  md: { tailwind: "4 / 6", note: "intro paragraph under a heading, card padding (mt-6, p-6, gap-4)" },
  lg: { tailwind: "8 / 10", note: "content block under an intro (mt-8, mt-10)" },
  xl: { tailwind: "14 / 16", note: "section-to-section breaks (mt-14, mt-16)" },
  "2xl": { tailwind: "16 (page shell py)", note: "page-level vertical padding (py-16)" },
} as const;
