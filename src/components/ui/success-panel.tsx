import type { ReactNode } from "react";

type SuccessPanelProps = {
  heading: string;
  children: ReactNode;
};

// The "thanks, that's submitted" panel shown after a form succeeds --
// previously three near-identical copies (contact form, contributor
// application, ask-a-question) hand-writing the same raw emerald classes
// instead of the --accent-success token Badge/ContentCallout already use
// for the same semantic meaning.
export function SuccessPanel({ heading, children }: SuccessPanelProps) {
  return (
    <div className="rounded-2xl border border-accent-success/30 bg-accent-success/5 p-6">
      <p className="text-lg font-semibold text-zinc-900 dark:text-white">{heading}</p>
      <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{children}</div>
    </div>
  );
}
