"use client";

import { useState } from "react";

import type { Recommendation } from "@/lib/mastery/recommend";
import { LearningOnboardingPrompt } from "@/components/learning/learning-onboarding-prompt";
import { ContinueLearning } from "@/components/learning/continue-learning";

type LearningOnboardingSlotProps = {
  initialShowOnboarding: boolean;
  recommendation: Recommendation;
  // Keyed by topic slug -- passed as a map (not a single resolved boolean)
  // so ContinueLearning can still look up the right count if onboarding
  // completes with a *different* recommended topic than the one this page
  // load started with (see this component's own comment on why
  // resolvedRecommendation can change without a fresh server round-trip).
  // A topic recommended only after onboarding completes and not present in
  // this map (a narrow edge case -- see dashboard/page.tsx) falls back to
  // "no knowledge check" until the next real page load.
  knowledgeCheckCounts: Record<string, number>;
  // Same map-not-single-value reasoning as knowledgeCheckCounts above --
  // passed through to ContinueLearning so the "Start with" vs "Continue"
  // label is still correct if the resolved recommendation changes
  // client-side after onboarding completes.
  engagedTopicSlugs: readonly string[];
};

// One stable component at this call site in dashboard/page.tsx, on
// purpose -- both LearningOnboardingPrompt and ContinueLearning save
// preferences via a "use server" action that calls revalidatePath("/dashboard"),
// which re-renders the Server Component tree well before the user has
// finished looking at the onboarding "You're all set" screen. If the
// dashboard page itself picked between the two components based on
// server-computed state, React would unmount the prompt (a different
// component type) the instant that revalidation lands, so the completion
// message would never actually be seen. Seeding local state once from the
// initial server props, then only ever changing it via this component's
// own callbacks, keeps one component mounted across that revalidation and
// lets the visible transition happen on the user's own pace instead.
export function LearningOnboardingSlot({
  initialShowOnboarding,
  recommendation,
  knowledgeCheckCounts,
  engagedTopicSlugs,
}: LearningOnboardingSlotProps) {
  const [showOnboarding, setShowOnboarding] = useState(initialShowOnboarding);
  const [resolvedRecommendation, setResolvedRecommendation] = useState(recommendation);

  if (showOnboarding) {
    return (
      <LearningOnboardingPrompt
        onSkip={() => setShowOnboarding(false)}
        onRecommendation={setResolvedRecommendation}
        onDone={() => setShowOnboarding(false)}
      />
    );
  }

  return (
    <ContinueLearning
      recommendation={resolvedRecommendation}
      hasKnowledgeCheck={(knowledgeCheckCounts[resolvedRecommendation.topicSlug] ?? 0) > 0}
      engagedTopicSlugs={engagedTopicSlugs}
    />
  );
}
