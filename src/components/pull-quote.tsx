type PullQuoteProps = {
  text: string;
  attribution?: string;
};

export function PullQuote({ text, attribution }: PullQuoteProps) {
  return (
    <blockquote className="border-l-4 border-zinc-900/15 py-1 pl-6 dark:border-white/20">
      <p className="text-xl leading-8 font-medium tracking-tight text-zinc-900 dark:text-white">
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
