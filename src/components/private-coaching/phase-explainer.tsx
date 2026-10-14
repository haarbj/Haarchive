import Link from "next/link";

import { resolvePhaseExplainer, explainerParagraphs, taperPreview } from "@/lib/private-coaching/phase-explainers";

// "Why this phase?" -- the educational half of a training phase, shown to
// a coached athlete on their own roadmap and to their coach in Phase View.
//
// A native <details> rather than React state: this is a Server Component
// used inside Server Components, it needs no JavaScript to work, and
// keyboard and screen-reader behavior come for free (CLAUDE.md §10/§11).
//
// Renders nothing at all when there's no explainer to show, including for
// a phase type with no standard copy of its own (Taper, Transition, a key
// a coach invented), so an unexplained phase reads as a phase with no
// explanation rather than as an empty expander.
export function PhaseExplainer({
  phaseType,
  explainer,
  editHref,
}: {
  phaseType: string;
  explainer: string | null;
  // Coach-only: where to go to change this explanation for FUTURE
  // assignments. Edits there never reach phases already assigned -- that's
  // the whole point of copying at assign time -- so the label says so.
  editHref?: string | null;
}) {
  const resolved = resolvePhaseExplainer(explainer, phaseType);
  if (!resolved) return null;

  const paragraphs = explainerParagraphs(resolved);
  // Part C item 5. Kept as its own labeled section rather than appended to
  // the explainer text: a coach can replace the specific-phase explainer
  // with their own, and an athlete assigned before this shipped carries a
  // frozen copy of the old one. Either way this still shows.
  const taper = taperPreview(phaseType);

  return (
    <details className="group mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white">
        Why this phase?
      </summary>
      <div className="mt-3 max-w-2xl space-y-4 border-l border-black/10 pl-4 dark:border-white/10">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {paragraph}
          </p>
        ))}
        {taper ? (
          <section className="border-t border-black/10 pt-4 dark:border-white/10">
            <h3 className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              The final two weeks
            </h3>
            <div className="mt-3 space-y-4">
              {explainerParagraphs(taper).map((paragraph, index) => (
                <p key={index} className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ) : null}
        {editHref ? (
          <Link
            href={editHref}
            className="inline-block text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Edit for future assignments
          </Link>
        ) : null}
      </div>
    </details>
  );
}
