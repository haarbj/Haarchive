import type { ElementType, ReactNode } from "react";

// The single change point for "how wide should this kind of page be" -- see
// src/design/layout.ts and the --container-* tokens in globals.css for the
// actual numbers. `chrome` (header/footer) isn't a variant here on purpose:
// it's a flex nav row with different padding and no fade-in, not a page
// shell, so it applies `max-w-chrome` directly instead.
//
// Five variants, each tied to a distinct kind of page rather than a
// per-page guess:
//   - content: the reading/browsing width. Category landings and every
//     section page (tool, article, list, or placeholder) use this one.
//     Same numeric width as `wide` (see globals.css's own comment on
//     --container-content/--container-wide) -- the homepage's width is
//     the standard for every reading/browsing page now, not a homepage-
//     only exception, so header and content agree on one width sitewide.
//   - wide: the homepage's own architectural width -- kept as its own
//     variant (not merged into `content`) because it still means something
//     distinct (the homepage's own layout, not "reading pages" generally),
//     even though the two resolve to the same number today. Individual
//     long-form text blocks inside it still cap at a real reading measure
//     locally (max-w-[66ch] etc.), not via the container.
//   - dashboard: authenticated list/detail pages (dashboard, coach, admin,
//     plan). Denser than content, still roomy enough for cards and tables.
//   - narrow: a form with some supporting content around it (generate a
//     plan/season, an error state, "ask a question").
//   - auth: a single-column form and nothing else (sign in/up, pending).
export type ContainerVariant = "content" | "wide" | "dashboard" | "narrow" | "auth";

// Literal strings, not interpolated -- Tailwind's static scanner needs to
// see the exact class name in source to generate it, so this map (not a
// template literal built from the variant name) is what makes the new
// container tokens actually ship in the compiled CSS.
const VARIANT_CLASSES: Record<ContainerVariant, string> = {
  content: "max-w-content",
  wide: "max-w-wide",
  dashboard: "max-w-dashboard",
  narrow: "max-w-narrow",
  auth: "max-w-auth",
};

type ContainerProps = {
  variant: ContainerVariant;
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

export function Container({ variant, children, className, as: Tag = "section" }: ContainerProps) {
  const classes = ["mx-auto", "w-full", VARIANT_CLASSES[variant], "px-6", "py-16", "animate-fade-in"];
  if (className) classes.push(className);

  return <Tag className={classes.join(" ")}>{children}</Tag>;
}
