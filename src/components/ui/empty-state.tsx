import type { ReactNode } from "react";

type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

// The "nothing here yet" text pattern, previously hand-copied with
// occasionally-drifted classes (text-zinc-600 vs. text-zinc-500, text-sm
// present or missing, mt-* spacing baked in inconsistently).
export function EmptyState({ children, className }: EmptyStateProps) {
  const classes = ["text-sm text-zinc-600 dark:text-zinc-300", className ?? ""].filter(Boolean).join(" ");
  return <p className={classes}>{children}</p>;
}
