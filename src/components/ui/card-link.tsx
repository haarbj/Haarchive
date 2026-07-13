import type { ReactNode } from "react";
import Link from "next/link";

import type { CardPadding } from "@/components/ui/card";

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: "rounded-control p-4",
  md: "rounded-card p-6",
  lg: "rounded-card p-8",
};

type CardLinkProps = {
  href: string;
  children: ReactNode;
  padding?: CardPadding;
  className?: string;
  target?: string;
};

// Card's interactive twin -- the ~28 instances of the card recipe that are
// actually link wrappers (category tiles, essay index, chapter nav) get
// the hover lift + shadow-card-hover transition Card itself doesn't need.
export function CardLink({ href, children, padding = "md", className, target }: CardLinkProps) {
  const classes = [
    "group block",
    PADDING_CLASSES[padding],
    "border border-black/10 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/10 dark:bg-zinc-900",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} target={target} className={classes}>
      {children}
    </Link>
  );
}
