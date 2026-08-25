import type { LucideIcon } from "lucide-react";
import { Brain, Dumbbell, FlaskConical, Layers, Library, Wrench } from "lucide-react";

export type CategoryVisual = {
  icon: LucideIcon;
  accentFrom: string;
  accentTo: string;
};

// Same "icon + accent pair" idea as tool-visuals.ts, keyed by category slug
// instead of tool slug -- for the "Explore the Archive" list on the
// homepage (see about-page.tsx). Deliberately its own small map rather
// than reusing TOOL_VISUALS: that one is keyed per-calculator, one entry
// per Tools-category member, not per top-level category, and "tools" here
// needs its own single icon distinct from any individual calculator's.
//
// Six entries now (four domains + library + tools), replacing the old
// 8-category map -- each domain keeps the icon/accent pair of whichever
// old category it absorbed most directly (physiology <- the-science,
// psychology <- mind-and-recovery, philosophy <- foundations, practice <-
// coaching-and-training), reusing the exact hex values already in this
// file rather than introducing new colors.
export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  physiology: { icon: FlaskConical, accentFrom: "#a78bfa", accentTo: "#7c3aed" },
  psychology: { icon: Brain, accentFrom: "#f472b6", accentTo: "#db2777" },
  philosophy: { icon: Layers, accentFrom: "#38bdf8", accentTo: "#0284c7" },
  practice: { icon: Dumbbell, accentFrom: "#fb923c", accentTo: "#ea580c" },
  // Keyed "archive" to match the category's real slug (see sections.ts's
  // own comment on this entry for why it isn't "library") -- the icon and
  // display title are still "Library".
  archive: { icon: Library, accentFrom: "#60a5fa", accentTo: "#2563eb" },
  tools: { icon: Wrench, accentFrom: "#94a3b8", accentTo: "#475569" },
};
