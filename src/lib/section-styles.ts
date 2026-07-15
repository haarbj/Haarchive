// Shared class strings for a "flagship essay" page's section rhythm --
// eyebrow + heading + divider + prose width, matching about-page.tsx's
// established pattern. Originally duplicated locally in
// training-philosophy-page.tsx and contact-page.tsx; pulled out here once a
// third page (coach-page.tsx) needed the exact same recipe.
export const eyebrowClass = "text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500";
export const sectionHeadingClass =
  "mt-3 scroll-mt-24 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white";
export const sectionDividerClass = "mt-16 border-t border-black/5 pt-14 dark:border-white/10";
export const sectionProseClass = "mt-6 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300";
export const inlineLinkClass =
  "font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70";
