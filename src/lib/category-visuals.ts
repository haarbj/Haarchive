import type { LucideIcon } from "lucide-react";
import { BatteryCharging, Brain, Dumbbell, FlaskConical, Footprints, Layers, Library, Wrench } from "lucide-react";

export type CategoryVisual = {
  icon: LucideIcon;
  accentFrom: string;
  accentTo: string;
};

// Same "icon + accent pair" idea as tool-visuals.ts, keyed by category slug
// instead of tool slug -- for the "What You'll Find Here" list on the
// homepage (see about-page.tsx), per the visual-system README's own
// recommendation to give the six... eight standing categories a visual
// identity without any photography. Deliberately its own small map rather
// than reusing TOOL_VISUALS: that one is keyed per-calculator, one entry
// per Tools-category member, not per top-level category, and "tools" here
// needs its own single icon distinct from any individual calculator's.
export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  "getting-started": { icon: Footprints, accentFrom: "#fbbf24", accentTo: "#f59e0b" },
  foundations: { icon: Layers, accentFrom: "#38bdf8", accentTo: "#0284c7" },
  "the-science": { icon: FlaskConical, accentFrom: "#a78bfa", accentTo: "#7c3aed" },
  "coaching-and-training": { icon: Dumbbell, accentFrom: "#fb923c", accentTo: "#ea580c" },
  "recovery-and-fueling": { icon: BatteryCharging, accentFrom: "#4ade80", accentTo: "#16a34a" },
  "mind-and-recovery": { icon: Brain, accentFrom: "#f472b6", accentTo: "#db2777" },
  "writing-and-resources": { icon: Library, accentFrom: "#60a5fa", accentTo: "#2563eb" },
  tools: { icon: Wrench, accentFrom: "#94a3b8", accentTo: "#475569" },
};
