import type { ReactNode } from "react";

type FigureProps = {
  // The image itself -- an ImageSlot, a Diagram, or (later) a real <img>/
  // next/image once this stops being scaffolding. Figure doesn't care what
  // it wraps; it only owns the caption underneath.
  children: ReactNode;
  // Optional on purpose: photography usually doesn't need one (the
  // surrounding prose already gives it context), while archival material
  // usually should carry a source/date. See the visual system doc's own
  // per-type caption guidance.
  caption?: string;
  // A source/date/rights line, kept visually distinct from `caption` (an
  // em dash between them) rather than concatenated into one string, so a
  // future edit to one doesn't require re-writing the other.
  attribution?: string;
  className?: string;
};

// The one consistent caption style every real image on the site should
// use -- text-xs text-zinc-500, the same eyebrow-label convention already
// used throughout (see about-page.tsx's section eyebrows, ArticleHero's
// reading-time line). Renders nothing extra when neither caption nor
// attribution is set, so wrapping an ImageSlot in Figure ahead of having
// real caption copy is free -- no visual change until there's something to
// say.
export function Figure({ children, caption, attribution, className = "" }: FigureProps) {
  return (
    <figure className={className}>
      {children}
      {caption || attribution ? (
        <figcaption className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {caption}
          {caption && attribution ? " — " : ""}
          {attribution}
        </figcaption>
      ) : null}
    </figure>
  );
}
