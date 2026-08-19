import type { LucideIcon } from "lucide-react";
import { Activity, CloudSun, Compass, Flag, Gauge, HeartPulse, Mountain, Percent, Route, Scale, Thermometer } from "lucide-react";

export type ToolVisual = {
  icon: LucideIcon;
  accentFrom: string;
  accentTo: string;
};

// Purely presentational -- an icon + accent pair for each tools-category
// section's preview card (see tool-card.tsx). The accent colors are only
// ever applied to the ~44px icon chip, never the card itself, so per-tool
// color stays a small, restrained area rather than the full-card wash an
// earlier version tried (too much color). Kept out of the Section type in
// sections.ts, since every other category uses that type too and has no
// use for it. gap-calculator and tinman-calculator deliberately reuse the
// site's --accent-forest/--accent-navy hex values (elevation and a steady,
// trusted reference calculator both fit those tones).
export const TOOL_VISUALS: Record<string, ToolVisual> = {
  "heat-tracker": { icon: Thermometer, accentFrom: "#f97316", accentTo: "#dc2626" },
  "pace-calculator": { icon: Gauge, accentFrom: "#0ea5e9", accentTo: "#6366f1" },
  "environmental-calculator": { icon: CloudSun, accentFrom: "#06b6d4", accentTo: "#0ea5e9" },
  "gap-calculator": { icon: Mountain, accentFrom: "#4ade80", accentTo: "#166534" },
  "pace-percent-calculator": { icon: Percent, accentFrom: "#a855f7", accentTo: "#6366f1" },
  "cv-threshold-calculator": { icon: Activity, accentFrom: "#f43f5e", accentTo: "#ec4899" },
  "race-pace-calculator": { icon: Flag, accentFrom: "#f59e0b", accentTo: "#f97316" },
  "hr-threshold-calculator": { icon: HeartPulse, accentFrom: "#ef4444", accentTo: "#f43f5e" },
  "tinman-calculator": { icon: Compass, accentFrom: "#6366f1", accentTo: "#172554" },
  "marathon-pacing-calculator": { icon: Route, accentFrom: "#06b6d4", accentTo: "#2563eb" },
  // Deliberately muted, not vivid like every other chip here -- this page
  // is a guide about the tools, not a tool itself, so it borrows the exact
  // slate tone CATEGORY_VISUALS already uses for the "Tools" category chip
  // (category-visuals.ts) instead of inventing a new vivid accent that
  // would make it read as an eleventh calculator.
  "choosing-a-pace-calculator": { icon: Scale, accentFrom: "#94a3b8", accentTo: "#475569" },
};
