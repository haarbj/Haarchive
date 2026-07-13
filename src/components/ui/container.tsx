import type { ElementType, ReactNode } from "react";

// The single change point for "how wide should this kind of page be" -- see
// src/design/layout.ts and the --container-* tokens in globals.css for the
// actual numbers. `chrome` (header/footer) isn't a variant here on purpose:
// it's a flex nav row with different padding and no fade-in, not a page
// shell, so it applies `max-w-chrome` directly instead.
//
// Four variants, each tied to a distinct kind of page rather than a
// per-page guess:
//   - content: the reading/browsing width. Home, category landings, and
//     every section page (tool, article, list, or placeholder) share this
//     one -- see [slug]/page.tsx's comment for why articles don't get a
//     wider shell of their own.
//   - dashboard: authenticated list/detail pages (dashboard, coach, admin,
//     plan). Denser than content, still roomy enough for cards and tables.
//   - narrow: a form with some supporting content around it (generate a
//     plan/season, an error state, "ask a question").
//   - auth: a single-column form and nothing else (sign in/up, settings).
export type ContainerVariant = "content" | "dashboard" | "narrow" | "auth";

// Literal strings, not interpolated -- Tailwind's static scanner needs to
// see the exact class name in source to generate it, so this map (not a
// template literal built from the variant name) is what makes the new
// container tokens actually ship in the compiled CSS.
const VARIANT_CLASSES: Record<ContainerVariant, string> = {
  content: "max-w-content",
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
