type PullQuoteSize = "default" | "article" | "large";

type PullQuoteProps = {
  text: string;
  attribution?: string;
  // "large" is a genuine standalone editorial moment (the homepage's
  // Coaching Philosophy section) -- untouched, homepage-only, do not
  // repurpose. "article" is the in-article quote-block scale used via
  // content-blocks.tsx (Foundations essays and DB-backed articles alike),
  // tuned toward the homepage's own editorial pull-quote language now that
  // quotes are meant to read as a deliberate, recurring interruption in
  // long-form content, not a small aside -- see the design-migration plan.
  // "default" is kept as its own untouched size for any other existing
  // caller (e.g. training-philosophy-page.tsx) that still wants the
  // original small scale.
  size?: PullQuoteSize;
};

const SIZE_CLASSES: Record<PullQuoteSize, string> = {
  default: "text-2xl leading-9",
  article: "text-3xl leading-[1.35] sm:text-4xl",
  large: "text-3xl leading-[1.25] sm:text-4xl sm:leading-[1.2]",
};

export function PullQuote({ text, attribution, size = "default" }: PullQuoteProps) {
  return (
    <blockquote className="border-l-4 border-zinc-900/15 py-1 pl-6 dark:border-white/20">
      <p className={`font-serif font-medium tracking-tight text-zinc-900 italic dark:text-white ${SIZE_CLASSES[size]}`}>
        {text}
      </p>
      {attribution ? (
        <footer className="mt-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          — {attribution}
        </footer>
      ) : null}
    </blockquote>
  );
}
