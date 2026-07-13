import type { ElementType, ReactNode } from "react";

// The two recurring body-text literal strings the audit found: "lede" (the
// intro paragraph under a page H1, e.g. text-lg leading-8...) and "eyebrow"
// (small uppercase labels above a value or section).
export type TextVariant = "lede" | "eyebrow";

const VARIANT_CLASSES: Record<TextVariant, string> = {
  lede: "text-lg leading-8 text-zinc-600 dark:text-zinc-300",
  eyebrow: "text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400",
};

const DEFAULT_TAG: Record<TextVariant, ElementType> = {
  lede: "p",
  eyebrow: "p",
};

type TextProps = {
  variant: TextVariant;
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

export function Text({ variant, children, className, as }: TextProps) {
  const Tag = as ?? DEFAULT_TAG[variant];
  const classes = [VARIANT_CLASSES[variant], className ?? ""].filter(Boolean).join(" ");
  return <Tag className={classes}>{children}</Tag>;
}
