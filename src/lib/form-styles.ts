// The single canonical definition -- previously independently copy-pasted
// into 7 files, which meant a one-property fix (the iOS zoom text-base
// change) had to be made by hand in all 7. Deliberately without a width
// utility: some call sites (dashboard/form-constants.ts, settings-form.tsx,
// auth-form.tsx) want `w-full` by default, others (pace-calculator.tsx and
// a few others) rely on the bare class having no intrinsic width so their
// own explicit `w-*` override is the only one in effect -- baking `w-full`
// in here would silently change those.
export const fieldClass =
  "rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
export const labelClass =
  "mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300";
