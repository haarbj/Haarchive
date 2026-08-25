import type { LucideIcon } from "lucide-react";
import { Activity, CloudSun, Compass, Flag, Gauge, HeartPulse, MountainSnow, Mountain, Percent, Route, Thermometer } from "lucide-react";

// Derived from what each tool's own mission/content actually says it does
// (see choosing-a-pace-calculator's own essay in sections.ts, which is
// itself this site's authoritative explanation of how these tools relate
// to each other), not invented from category names that sounded plausible.
// Three categories, not four or five: the tools genuinely split into "what
// pace should I run" (predicts or converts a pace from your own fitness --
// six tools, the largest and most central group), "how do real-world
// conditions change that" (grade, heat, altitude, and weather -- four
// tools), and "what do these numbers in my body actually mean" (a
// population physiological reference -- currently just one tool, kept as
// its own category rather than folded into either of the others since
// it's neither a pace prediction nor a conditions adjustment).
// Deliberately not "Calculators/Trackers/References/Converters" -- that
// taxonomy describes implementation, not the problem a runner is actually
// trying to solve, which is the one CATEGORY_LABELS is meant to answer.
//
// marathon-pacing-calculator sits in Pacing, not Environment: it uses
// terrain/weather physics as an *input*, but its actual output -- a full
// mile-by-mile pacing plan -- is the same kind of thing every other
// Pacing tool produces. What a tool gives you back, not what it consumes,
// is the categorization signal.
export type ToolCategory = "pacing" | "environment" | "physiology";

export const TOOL_CATEGORY_ORDER: ToolCategory[] = ["pacing", "environment", "physiology"];

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  pacing: "Pacing",
  environment: "Environment",
  physiology: "Physiology",
};

// choosing-a-pace-calculator (the "Choosing a Pace Calculator" essay) is
// deliberately NOT in TOOL_VISUALS below, and deliberately not a "tool" at
// all: it performs no calculation, measurement, simulation, or lookup --
// it's editorial guidance about how to choose between the three tools that
// do. Treating it as a 12th tool (its own category, an icon standing in
// for a calculator it isn't, an "Open tool" link promising an interactive
// experience that doesn't exist) actively misled a reader before this
// comment existed. [slug]/page.tsx renders it separately, as a "Start
// Here" guide above the categorized tool index, using this same slug
// constant rather than a second hardcoded copy of it.
export const TOOLS_GUIDE_SLUG = "choosing-a-pace-calculator";

export type ToolVisual = {
  icon: LucideIcon;
  accentFrom: string;
  accentTo: string;
  category: ToolCategory;
};

// Purely presentational -- an icon + accent pair for each tools-category
// section, rendered as a small inline icon+numeral marker on the Tools
// index (see [slug]/page.tsx's category-landing branch). `accentFrom` is
// the one color actually read there today; `accentTo` is kept as real,
// deliberately-chosen data (not dead weight) for any future call site that
// wants the full gradient pair, the way the old card chip once did. Kept
// out of the Section type in sections.ts, since every other category uses
// that type too and has no use for it. gap-calculator and tinman-calculator
// deliberately reuse the site's --accent-forest/--accent-navy hex values
// (elevation and a steady, trusted reference calculator both fit those
// tones).
export const TOOL_VISUALS: Record<string, ToolVisual> = {
  // Pacing -- predicts or converts a pace from your own fitness/goals.
  "pace-calculator": { icon: Gauge, accentFrom: "#0ea5e9", accentTo: "#6366f1", category: "pacing" },
  "cv-threshold-calculator": { icon: Activity, accentFrom: "#f43f5e", accentTo: "#ec4899", category: "pacing" },
  "tinman-calculator": { icon: Compass, accentFrom: "#6366f1", accentTo: "#172554", category: "pacing" },
  "race-pace-calculator": { icon: Flag, accentFrom: "#f59e0b", accentTo: "#f97316", category: "pacing" },
  "pace-percent-calculator": { icon: Percent, accentFrom: "#a855f7", accentTo: "#6366f1", category: "pacing" },
  // Uses terrain/weather physics as an input, but its output is a full
  // pacing plan like every tool above it -- see this file's own header
  // comment on why that puts it here, not in Environment.
  "marathon-pacing-calculator": { icon: Route, accentFrom: "#06b6d4", accentTo: "#2563eb", category: "pacing" },
  // Environment -- adjusts effort/pace for grade, heat, altitude, or
  // weather, rather than predicting fitness from a result or producing a
  // pacing plan.
  "gap-calculator": { icon: Mountain, accentFrom: "#4ade80", accentTo: "#166534", category: "environment" },
  "environmental-calculator": { icon: CloudSun, accentFrom: "#06b6d4", accentTo: "#0ea5e9", category: "environment" },
  "heat-tracker": { icon: Thermometer, accentFrom: "#f97316", accentTo: "#dc2626", category: "environment" },
  "altitude-calculator": { icon: MountainSnow, accentFrom: "#94a3b8", accentTo: "#312e81", category: "environment" },
  // Physiology -- a population physiological reference, not a personal
  // pace prediction or a conditions adjustment; its own category rather
  // than folded into either of the other two for that reason, even though
  // it's currently the only tool in it (see choosing-a-pace-calculator's
  // own essay, which explicitly separates "population reference" from
  // both the pace-prediction models and the conditions-adjustment tools).
  "hr-threshold-calculator": { icon: HeartPulse, accentFrom: "#ef4444", accentTo: "#f43f5e", category: "physiology" },
};
