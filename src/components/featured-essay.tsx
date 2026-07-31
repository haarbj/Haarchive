import type { ReactNode } from "react";

import { CardLink } from "@/components/ui/card-link";

type FeaturedEssayProps = {
  href: string;
  eyebrow?: ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  // The article's own cover image, if it has one -- an arbitrary Supabase
  // storage URL like every other article cover image on the site (see
  // article-hero.tsx), so this is a plain <img> with the same
  // eslint-disable convention, not next/image (no remotePatterns
  // configured for external hosts). Optional: this component predates
  // articles having cover images at all, and the text-only layout below
  // is what renders without one.
  imageUrl?: string;
};

// Deliberately the plainest card on the homepage -- editorial, permanent,
// "featured magazine article" in feel. This is the one piece of homepage
// content every new visitor should read first, so it stays understated on
// purpose: no color, no motion beyond the standard card lift, nothing that
// competes with FeaturedTool (see that component's own comment on why the
// two are intentionally built to feel like different kinds of things).
export function FeaturedEssay({ href, eyebrow = "Featured essay", title, description, ctaLabel, imageUrl }: FeaturedEssayProps) {
  const textBlock = (
    <>
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">{eyebrow}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>
        <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-300">{description}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-white">
        {ctaLabel}
      </span>
    </>
  );

  if (!imageUrl) {
    return (
      <CardLink href={href} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {textBlock}
      </CardLink>
    );
  }

  return (
    <CardLink href={href} padding="none" className="mt-10 flex flex-col overflow-hidden sm:flex-row sm:items-stretch">
      <div className="relative aspect-video shrink-0 sm:aspect-auto sm:w-56">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL (Supabase storage), not a local/optimized asset */}
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        {textBlock}
      </div>
    </CardLink>
  );
}
