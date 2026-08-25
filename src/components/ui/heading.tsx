import type { ReactNode } from "react";

// The two recurring H1 literal strings the audit found: "page" (24
// occurrences -- every marketing/section/dashboard/admin page) and
// "compact" (the 4 narrow auth-adjacent pages: login/signup/pending/settings).
export type HeadingVariant = "page" | "compact";

const VARIANT_BASE_CLASSES: Record<HeadingVariant, string> = {
  page: "text-4xl leading-tight tracking-tight sm:text-5xl",
  compact: "text-3xl tracking-tight text-zinc-900 dark:text-white",
};

// "page" defaults to the serif display face; "compact" stays sans (matches
// the "reading vs using" split -- login/signup/settings aren't editorial
// moments). `serif` is an explicit boolean, not a className override,
// because two same-specificity Tailwind utilities (font-serif vs
// font-semibold) don't have a reliable "last one wins" guarantee from
// string concatenation alone -- omitting font-serif from the class list
// entirely is the only deterministic way for one call site to opt out.
const VARIANT_SERIF_DEFAULT: Record<HeadingVariant, boolean> = {
  page: true,
  compact: false,
};

type HeadingProps = {
  variant?: HeadingVariant;
  serif?: boolean;
  children: ReactNode;
  className?: string;
};

export function Heading({ variant = "page", serif, children, className }: HeadingProps) {
  const useSerif = serif ?? VARIANT_SERIF_DEFAULT[variant];
  const fontClass = useSerif ? "font-serif font-medium" : "font-semibold";
  const classes = [VARIANT_BASE_CLASSES[variant], fontClass, className ?? ""].filter(Boolean).join(" ");
  return <h1 className={classes}>{children}</h1>;
}
