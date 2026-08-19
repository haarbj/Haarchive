import Link from "next/link";

import type { Recommendation } from "@/lib/mastery/recommend";
import { continueLearningLabel } from "@/lib/mastery/continue-learning-label";
import { Card } from "@/components/ui/card";

type ContinueLearningProps = {
  recommendation: Recommendation;
  // Purely a discovery signal ("this topic includes one somewhere"), not a
  // progress claim -- shown regardless of the recommended topic's current
  // mastery level, unlike the Advanced-only "verify your understanding"
  // language in mastery-explanation.ts. Never implies the check is
  // required before reading.
  hasKnowledgeCheck?: boolean;
  // Every topic slug the user has at least one learning_event for (the same
  // list already computed for recommendNextTopic -- see
  // continue-learning-label.ts). Looked up by the *resolved* recommendation
  // slug at render time, same resilience-to-post-onboarding-change pattern
  // as hasKnowledgeCheck above, rather than a single boolean tied to the
  // page-load-time recommendation.
  engagedTopicSlugs?: readonly string[];
};

// One recommended next topic, deterministically chosen (recommend.ts) --
// not a recommendation engine, and not shown alongside
// LearningOnboardingPrompt (dashboard/page.tsx renders exactly one of the
// two in this same slot, since the onboarding prompt's own completion
// screen already shows this same kind of recommendation once).
export function ContinueLearning({ recommendation, hasKnowledgeCheck, engagedTopicSlugs = [] }: ContinueLearningProps) {
  const hasPathContext =
    recommendation.pathTitle != null && recommendation.pathIndex != null && recommendation.pathLength != null;
  const ctaLabel = continueLearningLabel(engagedTopicSlugs, recommendation.topicSlug);

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
        Continue Learning
      </p>
      {/* Quiet path context -- omitted entirely rather than guessed when
          recommend.ts didn't attach real path metadata (see Recommendation's
          own comment on why those fields are optional). Never a second,
          competing heading -- one small line above the real recommendation. */}
      {hasPathContext && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Part of {recommendation.pathTitle} · {recommendation.pathIndex} of {recommendation.pathLength}
        </p>
      )}
      <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
        {recommendation.title}
      </p>
      <Link
        href={`/${recommendation.topicSlug}`}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/20 dark:hover:decoration-white"
      >
        {ctaLabel}
      </Link>
      {hasKnowledgeCheck && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Knowledge check available</p>
      )}
    </Card>
  );
}
