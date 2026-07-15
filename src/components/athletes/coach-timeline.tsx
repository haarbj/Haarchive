import Link from "next/link";

import type { CoachStint } from "@/lib/athletes/types";

// A linear coaching history, not a tree -- one athlete moving through
// coaches over time, rendered top to bottom with a connector line between
// stints (same border-based connector convention as FamilyTree, never
// literal Unicode arrows, for the same cross-platform/font reasons). A
// single-stint athlete still renders as a one-item list, not a special case.
export function CoachTimeline({ history }: { history: CoachStint[] }) {
  return (
    <ol className="mt-8 space-y-0">
      {history.map((stint, i) => (
        <li key={`${stint.coachName}-${i}`} className="relative pb-8 pl-8 last:pb-0">
          {i < history.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute top-3 left-[5px] h-full w-0.5 bg-zinc-200 dark:bg-zinc-700"
            />
          ) : null}
          <span
            aria-hidden="true"
            className="absolute top-1.5 left-0 h-3 w-3 rounded-full bg-zinc-900 dark:bg-white"
          />
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {stint.label}
            {stint.years ? ` · ${stint.years}` : ""}
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
            {stint.coachSlug ? (
              <Link
                href={`/coaching-library/${stint.coachSlug}`}
                className="underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
              >
                {stint.coachName}
              </Link>
            ) : (
              stint.coachName
            )}
          </p>
          {stint.whatChanged ? (
            <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{stint.whatChanged}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
