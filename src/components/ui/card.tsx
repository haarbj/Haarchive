import type { ElementType, ReactNode } from "react";

// The card recipe the audit found repeated ~56 times, near-verbatim, across
// 34 files. `padding` ties to the radius that recipe actually used at each
// size (denser cards -> rounded-control, bigger cards -> rounded-card), so
// callers don't have to think about radius separately.
export type CardPadding = "sm" | "md" | "lg";

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: "rounded-control p-4",
  md: "rounded-card p-6",
  lg: "rounded-card p-8",
};

type CardProps = {
  children: ReactNode;
  padding?: CardPadding;
  emphasis?: boolean;
  shadow?: boolean;
  className?: string;
  as?: ElementType;
  [key: string]: unknown;
};

export function Card({
  children,
  padding = "md",
  emphasis = false,
  shadow = true,
  className,
  as: Tag = "div",
  ...rest
}: CardProps) {
  const classes = [
    PADDING_CLASSES[padding],
    "bg-white dark:bg-zinc-900",
    emphasis
      ? "border-2 border-zinc-900 dark:border-white"
      : "border border-black/10 dark:border-white/10",
    shadow ? "shadow-card" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
