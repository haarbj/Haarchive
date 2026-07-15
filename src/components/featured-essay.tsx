import type { ReactNode } from "react";

import { CardLink } from "@/components/ui/card-link";

type FeaturedEssayProps = {
  href: string;
  eyebrow?: ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
};

// Deliberately the plainest card on the homepage -- editorial, permanent,
// "featured magazine article" in feel. This is the one piece of homepage
// content every new visitor should read first, so it stays understated on
// purpose: no color, no motion beyond the standard card lift, nothing that
// competes with FeaturedTool (see that component's own comment on why the
// two are intentionally built to feel like different kinds of things).
export function FeaturedEssay({ href, eyebrow = "Featured essay", title, description, ctaLabel }: FeaturedEssayProps) {
  return (
    <CardLink href={href} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>
        <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-300">{description}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-white">
        {ctaLabel}
      </span>
    </CardLink>
  );
}
