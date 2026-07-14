// Shared visual vocabulary for interactive tools (pace-calculator,
// wind-calculator, and any future one) -- extracted so a design tweak
// (e.g. the card border radius) happens in one place instead of being
// hand-copied across every tool component.
export const statCardClass =
  "rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900";
export const heroCardClass =
  "rounded-xl border-2 border-zinc-900 bg-white p-5 dark:border-white dark:bg-zinc-900";
export const statLabelClass =
  "text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300";
export const sectionLabelClass =
  "mb-3 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300";
// A bigger umbrella heading for a whole page section (Activity / Conditions
// / Results / Learn More) that groups several sectionLabelClass subsections --
// distinct from sectionLabelClass's smaller per-subsection labels, so a
// page's overall structure reads clearly even when scrolled through freely
// rather than stepped through as a wizard.
export const pageSectionHeadingClass =
  "border-t border-black/10 pt-8 text-lg font-bold text-zinc-900 first:border-t-0 first:pt-0 dark:border-white/10 dark:text-white";
export const groupLabelClass =
  "mb-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400";
export const learnMoreClass =
  "mt-2 inline-block text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 transition hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white";
export const toggleClass =
  "inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white";
export const detailsClass =
  "group rounded-lg border border-black/10 dark:border-white/10";
export const summaryClass =
  "flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden dark:text-white";
export const detailsBodyClass =
  "px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300";

// A small, borderless two/three-way choice -- "pace vs. effort mode",
// "lbs vs. kg" -- as opposed to fieldClass's boxed <select>, for choices
// better shown as a segmented row of buttons.
export const segmentedButtonClass = (active: boolean) =>
  `flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
    active
      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
      : "border-black/10 bg-white text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10"
  }`;
