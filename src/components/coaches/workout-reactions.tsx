import type { WorkoutReaction } from "@/lib/coaches/types";

// The same fixed workout prompts across every coach (see WorkoutReaction's
// own comment) -- reading this section on two different coach pages is
// what actually demonstrates how differently two philosophies interpret
// identical training data.
export function WorkoutReactions({ reactions }: { reactions: WorkoutReaction[] }) {
  return (
    <div className="mt-8 space-y-4">
      {reactions.map((item) => (
        <div key={item.workout} className="rounded-xl border border-black/10 dark:border-white/10">
          <div className="border-b border-black/5 bg-black/[0.02] px-5 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Workout</p>
            <p className="mt-1 font-medium text-zinc-900 dark:text-white">{item.workout}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">&ldquo;{item.reaction}&rdquo;</p>
          </div>
        </div>
      ))}
    </div>
  );
}
