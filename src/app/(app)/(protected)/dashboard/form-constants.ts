export const GOAL_DISTANCES = [
  { label: "1 Mile", meters: 1609 },
  { label: "5K", meters: 5000 },
  { label: "8K", meters: 8000 },
  { label: "10K", meters: 10000 },
  { label: "Half Marathon", meters: 21097 },
  { label: "Marathon", meters: 42195 },
];

export const COURSE_TYPES = [
  { label: "Road", value: "road" },
  { label: "Track", value: "track" },
  { label: "Cross Country", value: "xc" },
  { label: "Trail", value: "trail" },
];

export const fieldClass =
  "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";
export const labelClass =
  "mb-1 block text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300";

// Native date inputs render the calendar-picker icon black by default, which
// is invisible against a dark background -- invert it in dark mode so the
// picker is still visibly clickable.
export const dateFieldClass = `${fieldClass} [&::-webkit-calendar-picker-indicator]:dark:invert`;
