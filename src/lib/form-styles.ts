// The single canonical definition -- previously independently copy-pasted
// into 7 files, which meant a one-property fix (the iOS zoom text-base
// change) had to be made by hand in all 7. Deliberately without a width
// utility: some call sites (dashboard/form-constants.ts, settings-form.tsx,
// auth-form.tsx) want `w-full` by default, others (pace-calculator.tsx and
// a few others) rely on the bare class having no intrinsic width so their
// own explicit `w-*` override is the only one in effect -- baking `w-full`
// in here would silently change those.
// [color-scheme:light_dark] tells the browser this control supports both
// themes so it renders native chrome (the datetime-local calendar icon,
// number-input spin buttons, etc.) to match automatically -- without it,
// browsers default that chrome to a light-mode rendering that's nearly
// invisible against a dark card (the actual root cause of a "the calendar
// icon is too dark to see in dark mode" report; a manual icon filter would
// only patch the one control that got reported, not the underlying issue).
export const fieldClass =
  "rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none [color-scheme:light_dark] dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
export const labelClass =
  "mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300";
