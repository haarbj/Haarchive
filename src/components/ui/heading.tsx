import type { ReactNode } from "react";

// The two recurring H1 literal strings the audit found: "page" (24
// occurrences -- every marketing/section/dashboard/admin page) and
// "compact" (the 4 narrow auth-adjacent pages: login/signup/pending/settings).
export type HeadingVariant = "page" | "compact";

const VARIANT_CLASSES: Record<HeadingVariant, string> = {
  page: "text-4xl leading-tight font-semibold tracking-tight sm:text-5xl",
  compact: "text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white",
};

type HeadingProps = {
  variant?: HeadingVariant;
  children: ReactNode;
  className?: string;
};

export function Heading({ variant = "page", children, className }: HeadingProps) {
  const classes = [VARIANT_CLASSES[variant], className ?? ""].filter(Boolean).join(" ");
  return <h1 className={classes}>{children}</h1>;
}
