import type { ReactNode } from "react";
import Link from "next/link";

import type { CalloutVariant } from "@/lib/sections";

type ContentCalloutProps = {
  variant: CalloutVariant;
  title?: string;
  // ReactNode (not string) so a caller can pass already-linkified content
  // (see linkifyContent in lib/linkify.tsx) -- a plain string is still a
  // valid ReactNode, so tool components passing hardcoded copy are unaffected.
  text?: ReactNode;
  items?: ReactNode[];
  collapsed?: boolean;
  // Same trailing "lead-in text ... <Link>Destination</Link>." pattern the
  // paragraph block renders -- appended after text/items so a callout can
  // point at a whole section, not just a heading within one.
  linkHref?: string;
  linkText?: string;
};

// Same --color-accent-* tokens Badge/StatusBadge use (globals.css) -- a
// color choice made once there now governs a status pill, a callout's
// rule, and its label, instead of separately hand-maintained color maps.
// No background tint and no rounded box, per the editorial-identity pass
// on article/Foundations content (see the design-migration plan): a
// callout is a thin accent rule with an uppercase label, matching the
// homepage's own eyebrow-label language and PullQuote's rule-only shell --
// not a tinted card. Shared by every sections.ts page (Foundations essays
// and DB-backed articles alike), so it has to read correctly on both the
// light article/homepage theme and the site's dark default -- every color
// here is a token, not a literal hex, so both themes resolve correctly.
const VARIANT_STYLES: Record<CalloutVariant, { label: string; ruleClass: string; labelClass: string }> = {
  tip: {
    label: "Coaching Tip",
    ruleClass: "border-accent-tip",
    labelClass: "text-accent-tip",
  },
  mistake: {
    label: "Common Mistake",
    ruleClass: "border-accent-warning",
    labelClass: "text-accent-warning",
  },
  research: {
    label: "Research Insight",
    ruleClass: "border-accent-research",
    labelClass: "text-accent-research",
  },
  takeaway: {
    label: "Practical Takeaway",
    ruleClass: "border-accent-success",
    labelClass: "text-accent-success",
  },
  advanced: {
    label: "Advanced Topic",
    ruleClass: "border-zinc-400 dark:border-zinc-600",
    labelClass: "text-zinc-500 dark:text-zinc-400",
  },
};

export function ContentCallout({ variant, title, text, items, collapsed, linkHref, linkText }: ContentCalloutProps) {
  const style = VARIANT_STYLES[variant];
  const heading = title ?? style.label;
  const link =
    linkHref && linkText ? (
      <Link
        href={linkHref}
        className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
      >
        {linkText}
      </Link>
    ) : null;
  const body = (
    <>
      {text ? (
        <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300">
          {text}
          {link ? (
            <>
              {" "}
              {link}.
            </>
          ) : null}
        </p>
      ) : null}
      {items && items.length > 0 ? (
        <ul className={`space-y-2 text-base leading-7 text-zinc-700 dark:text-zinc-300 ${text ? "mt-2" : ""}`}>
          {items.map((item, index) => (
            <li key={index}>• {item}</li>
          ))}
        </ul>
      ) : null}
      {!text && link ? (
        <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300">{link}.</p>
      ) : null}
    </>
  );

  if (variant === "advanced") {
    return (
      <details open={collapsed === false} className={`border-l-2 py-1 pl-5 ${style.ruleClass}`}>
        <summary className={`cursor-pointer text-xs font-semibold tracking-[0.2em] uppercase ${style.labelClass}`}>
          {heading}
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }

  return (
    <div className={`border-l-2 py-1 pl-5 ${style.ruleClass}`}>
      <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${style.labelClass}`}>{heading}</p>
      <div className="mt-2">{body}</div>
    </div>
  );
}
