"use client";

import { useState } from "react";

import { heroCardClass, statCardClass, statLabelClass } from "@/lib/tool-styles";

// The 1924/1925 Boston Marathon anecdote, made visually memorable -- see
// the Fueling Fridays #1 article's opening section. Both 1924 panels are
// shown up front (comparison is the point; nothing essential is hidden
// behind a click), with the 1925 intervention and result revealed below on
// request, mirroring how the article's own prose unfolds the story.
//
// Every number and detail here is exactly what the supplied source
// reports -- no invented blood-glucose readings, no runner identities
// beyond Demar, no framing of the 10-minute figure as a controlled trial.
export function BostonMarathonFuelingCard() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={heroCardClass}>
      <p className={statLabelClass}>Boston Marathon, 1924</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        The finish-line medical team noticed something: how a runner felt afterward closely matched their blood
        glucose reading.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={statCardClass}>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Clarence Demar</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">2:29:40</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">world&rsquo;s best</p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Normal blood glucose at the finish. Felt good.
          </p>
        </div>
        <div className={statCardClass}>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            The lowest reading on record
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Unconscious</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">carried into the medical tent</p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Pale, weak, and confused before collapsing. The lowest blood glucose the doctors measured that day.
          </p>
        </div>
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-4 text-sm font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 transition hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
        >
          What the doctors did about it the next year →
        </button>
      ) : (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            1925: an early fueling intervention
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Runners were advised to eat carbohydrate-rich food before the race and were given candy to consume during it.
          </p>
          <div className={`${statCardClass} mt-3`}>
            <p className={statLabelClass}>Reported result</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-white">
              +10 <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">minutes, on average</span>
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              An observational follow-up, not a randomized or controlled trial, so the improvement can&rsquo;t be
              attributed to carbohydrate alone.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
