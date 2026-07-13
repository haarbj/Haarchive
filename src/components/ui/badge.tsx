import type { ReactNode } from "react";

// Generalizes questions/status-badge.tsx's color map onto the shared
// --color-accent-* tokens (globals.css) instead of a second, separately
// hand-maintained sky/amber/violet/emerald map -- content-callout.tsx
// references the same tokens for the same semantic reason (tip=sky,
// warning=amber, research=violet, success=emerald), so a color choice made
// once in globals.css now governs both a status pill and a callout box.
export type BadgeTone = "neutral" | "tip" | "warning" | "research" | "success" | "error";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-500/10 text-zinc-700 dark:bg-zinc-400/10 dark:text-zinc-300",
  tip: "bg-accent-tip/10 text-accent-tip",
  warning: "bg-accent-warning/10 text-accent-warning",
  research: "bg-accent-research/10 text-accent-research",
  success: "bg-accent-success/10 text-accent-success",
  error: "bg-accent-error/10 text-accent-error",
};

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  const classes = [
    "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold tracking-wide",
    TONE_CLASSES[tone],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
