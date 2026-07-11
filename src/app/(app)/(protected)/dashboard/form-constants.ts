import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";

export { labelClass };

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

export const fieldClass = `w-full ${baseFieldClass}`;

// Native date inputs render the calendar-picker icon black by default, which
// is invisible against a dark background -- invert it in dark mode so the
// picker is still visibly clickable.
export const dateFieldClass = `${fieldClass} [&::-webkit-calendar-picker-indicator]:dark:invert`;
