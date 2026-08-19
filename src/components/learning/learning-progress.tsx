import type { MasteryLevel } from "@/lib/mastery/algorithm";
import type { MasteryExplanation } from "@/lib/mastery/mastery-explanation";
import { CardLink } from "@/components/ui/card-link";
import { detailsBodyClass, detailsClass, summaryClass } from "@/lib/tool-styles";

export type TopicProgressRow = {
  slug: string;
  title: string;
  level: MasteryLevel;
  // Per-topic "why this level" -- computed fresh from this topic's own
  // event history (see dashboard/page.tsx), not a generic per-level
  // description. Replaces the earlier standalone "Verify your
  // understanding · N questions" hint, which could fire before Advanced
  // was even reached; explainMastery only ever names a knowledge check as
  // the next step once it's genuinely the next step.
  explanation: MasteryExplanation;
};

// Product-facing label -- "Mastery"/score/points never appear in this
// component. "Mastered" (Phase 2) requires a verified knowledge check --
// see algorithm.ts's explicit gates -- reading, notes, tools, and revisits
// alone still cap at Advanced.
const LEVEL_LABELS: Record<MasteryLevel, string> = {
  exploring: "Exploring",
  familiar: "Familiar",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
};

// One line per level, in the same plain, non-promotional voice as the rest
// of the site's UI copy -- no "unlock," no "earn." Reading alone can only
// ever reach Familiar (see algorithm.ts's guardrail); this is the one
// place that guardrail is stated in plain language for the reader, not
// just enforced silently. Kept as the generic, level-only reference
// (the "What do these levels mean?" disclosure below) alongside the new
// per-topic `explanation` shown on each row -- one explains the system,
// the other explains the user's own state in it.
const LEVEL_DESCRIPTIONS: Record<MasteryLevel, string> = {
  // Phase 9 audit fix: this generic line used to unconditionally say
  // "started reading," even for a tool-only topic (a calculator) where
  // reading was never possible -- the per-topic explanation just above
  // already correctly branches on hasReadableContent for this, but this
  // disclosure describes the level in the abstract, not per-topic, so it
  // now names both real paths to Exploring instead of assuming one.
  exploring: "You've opened this topic -- by reading it, or, for a tool-only topic, by using it.",
  familiar: "You've spent real time with this topic.",
  proficient: "You've engaged actively with this topic -- a note, a return visit, or applying it in a tool, not just reading.",
  // Phase 9 audit fix: algorithm.ts's actual gate is an OR (concepts.length
  // >= 2 OR activeSignalCount >= 4) -- this used to claim breadth across
  // concepts as if it were the only route, which wasn't true for someone
  // who reached Advanced through sustained notes/revisits/tool-use alone.
  advanced: "You've engaged deeply with this topic -- across multiple ideas, or through sustained active engagement over time.",
  mastered: "You've verified your understanding -- at least 2 knowledge checks answered correctly, with a strong accuracy rate. Never awarded from reading or activity alone.",
};

// A proportional visual only -- never the raw internal score. Level is
// also always shown as text, so nothing here depends on color alone.
const LEVEL_FRACTION: Record<MasteryLevel, number> = {
  exploring: 0.2,
  familiar: 0.45,
  proficient: 0.7,
  advanced: 0.9,
  mastered: 1,
};

// Lower on the dashboard, deliberately small: the 3-5 topics a user has
// actually engaged with, not all ~40 topics in the taxonomy. No streaks,
// no XP, no account-wide level -- this is a deliberate product choice
// (CLAUDE.md's own product philosophy: research archive, not a fitness
// app), not a missing feature.
export function LearningProgress({
  topics,
  moreCount,
}: {
  topics: TopicProgressRow[];
  moreCount: number;
}) {
  if (topics.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
        Learning Progress
      </p>
      <div className="mt-3 space-y-2">
        {topics.map((topic) => (
          <CardLink key={topic.slug} padding="sm" href={`/${topic.slug}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-900 dark:text-white">{topic.title}</span>
              <span className="shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {LEVEL_LABELS[topic.level]}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${topic.title}: ${LEVEL_LABELS[topic.level]}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(LEVEL_FRACTION[topic.level] * 100)}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
            >
              <div
                className="h-full rounded-full bg-zinc-900 dark:bg-white"
                style={{ width: `${LEVEL_FRACTION[topic.level] * 100}%` }}
              />
            </div>
            {topic.explanation.detail && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{topic.explanation.detail}</p>
            )}
          </CardLink>
        ))}
      </div>
      {moreCount > 0 && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {moreCount} more {moreCount === 1 ? "topic" : "topics"} explored
        </p>
      )}

      <details className={`mt-3 ${detailsClass}`}>
        <summary className={summaryClass}>
          <span
            aria-hidden="true"
            className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
          >
            ▶
          </span>
          What do these levels mean?
        </summary>
        <div className={detailsBodyClass}>
          <dl className="space-y-2">
            {(["exploring", "familiar", "proficient", "advanced", "mastered"] as const).map((level) => (
              <div key={level}>
                <dt className="font-semibold text-zinc-800 dark:text-zinc-100">{LEVEL_LABELS[level]}</dt>
                <dd>{LEVEL_DESCRIPTIONS[level]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </div>
  );
}
