import Link from "next/link";
import type { ReactNode } from "react";

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

// The opening spread of a publication, not a product card -- no rounded
// corners, no card border/shadow, no background differentiation from the
// page itself. An asymmetric two-column layout (image narrower than text,
// not centered/balanced) reads as an editorial choice the way a real
// magazine feature does; a symmetric card grid reads as "one more tile."
// Text-only fallback (no imageUrl) keeps the same typographic rhythm minus
// the image column, rather than a visibly different layout for that case.
export function FeaturedEssay({ href, eyebrow = "Featured essay", title, description, ctaLabel, imageUrl }: FeaturedEssayProps) {
  const textBlock = (
    <div className="flex flex-col justify-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">{eyebrow}</p>
      <h3 className="font-serif mt-3 text-3xl leading-tight font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
        {title}
      </h3>
      <p className="mt-4 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-300">{description}</p>
      <span className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-900 underline decoration-black/20 underline-offset-4 transition group-hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:group-hover:decoration-white/70">
        {ctaLabel}
      </span>
    </div>
  );

  if (!imageUrl) {
    return (
      <Link href={href} className="group mt-10 block border-t border-black/10 pt-10 dark:border-white/10">
        {textBlock}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group mt-10 grid grid-cols-1 gap-8 border-t border-black/10 pt-10 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-10 dark:border-white/10"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external URL (Supabase storage), not a local/optimized asset */}
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      {textBlock}
    </Link>
  );
}
