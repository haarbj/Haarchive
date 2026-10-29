import type { ReactNode } from "react";
import Link from "next/link";

import type { CardPadding } from "@/components/ui/card";

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: "rounded-control p-4",
  md: "rounded-card p-6",
  lg: "rounded-card p-8",
  none: "rounded-card",
};

type CardLinkProps = {
  href: string;
  children: ReactNode;
  padding?: CardPadding;
  className?: string;
  target?: string;
};

// Card's interactive twin -- the ~28 instances of the card recipe that are
// actually link wrappers (category tiles, essay index, chapter nav). Hover
// is a border-color shift only (no lift, no shadow growth): these grids are
// browsed at "tens of times a day" frequency, and a lift+shadow on every
// card swept past reads as busier than the hairline-border language the
// rest of the site uses for emphasis (see CLAUDE.md's card-edge
// convention). `active:scale-[0.97]` gives the same press feedback a
// button gets, since the whole card is one tap target.
export function CardLink({ href, children, padding = "md", className, target }: CardLinkProps) {
  const classes = [
    "group block",
    PADDING_CLASSES[padding],
    "border border-black/10 bg-white shadow-card transition hover:border-black/20 active:scale-[0.97] dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20",
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
