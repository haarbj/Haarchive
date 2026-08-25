"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

import { saveLearningPreferences, skipLearningOnboarding } from "@/app/learning-actions";
import type { LearningInterestCategory, LearningOrientation } from "@/lib/validation/learning";
import type { Recommendation } from "@/lib/mastery/recommend";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { textLinkClass } from "@/components/ui/text-link";

const ORIENTATION_OPTIONS: { value: LearningOrientation; label: string }[] = [
  { value: "new_runner", label: "I'm new to running" },
  { value: "training_goal", label: "I'm training for a specific goal" },
  { value: "science", label: "I want to understand the science" },
  { value: "coaching", label: "I coach runners" },
  { value: "exploring", label: "I'm just exploring" },
];

const INTEREST_OPTIONS: { value: LearningInterestCategory; label: string }[] = [
  { value: "physiology", label: "Physiology" },
  { value: "psychology", label: "Psychology" },
  { value: "philosophy", label: "Philosophy" },
  { value: "practice", label: "Practice" },
];

// Full-width, stacked choice buttons -- segmentedButtonClass (tool-styles.ts)
// is built for a 2-3-way horizontal row, too cramped for 5 stacked options
// on mobile, but this deliberately reuses its same selected/unselected
// color language (zinc-900 solid vs. hairline border) for visual consistency.
function choiceButtonClass(active: boolean) {
  return `w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
    active
      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
      : "border-black/10 bg-white text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10"
  }`;
}

type Step = 1 | 2 | "done";

type LearningOnboardingPromptProps = {
  // Owned by the parent slot (learning-onboarding-slot.tsx), not this
  // component -- revalidatePath("/dashboard") inside the server actions
  // below re-renders the dashboard's Server Component tree the instant
  // preferences save, and if this component's own local "dismissed" state
  // were what controlled visibility at the *call site*, React would swap
  // this component out for ContinueLearning before the user ever saw the
  // "You're all set" screen. Keeping one stable component across that
  // re-render (see the slot) and letting these callbacks drive the
  // transition instead fixes that.
  onSkip: () => void;
  onRecommendation: (recommendation: Recommendation) => void;
  onDone: () => void;
};

export function LearningOnboardingPrompt({ onSkip, onRecommendation, onDone }: LearningOnboardingPromptProps) {
  const [step, setStep] = useState<Step>(1);
  const [orientation, setOrientation] = useState<LearningOrientation | null>(null);
  const [interests, setInterests] = useState<LearningInterestCategory[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stepHeadingRef = useRef<HTMLParagraphElement>(null);

  // Moves focus to the new step's own question on every step change (1 ->
  // 2, 2 -> "done", 2 -> 1 via Back) so a screen reader announces the
  // content actually changed, instead of leaving focus on a button that's
  // no longer there (Step 1's options are removed from the DOM entirely
  // once Step 2 renders). Skipped on first mount -- the card's own initial
  // render already gets a sensible reading order without stealing focus
  // from wherever the page already was.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  function toggleInterest(value: LearningInterestCategory) {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function handleSkip() {
    startTransition(async () => {
      await skipLearningOnboarding();
      onSkip();
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (orientation) formData.set("orientation", orientation);
      interests.forEach((slug) => formData.append("interests", slug));

      const result = await saveLearningPreferences({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      const nextRecommendation = result.recommendation ?? null;
      setRecommendation(nextRecommendation);
      if (nextRecommendation) onRecommendation(nextRecommendation);
      setStep("done");
    });
  }

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Make the Haarchive yours
          </h2>
          {step !== "done" && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              A few quick questions help us recommend where to start.
            </p>
          )}
        </div>
        {step !== "done" && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="shrink-0 text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            Maybe later
          </button>
        )}
      </div>

      {step === 1 && (
        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Step 1 of 2
            </p>
            <p
              ref={stepHeadingRef}
              tabIndex={-1}
              className="mb-3 rounded text-sm font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:text-white dark:focus:ring-white"
            >
              What brings you to the Haarchive?
            </p>
            <div className="space-y-2">
              {ORIENTATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setOrientation(option.value);
                    setStep(2);
                  }}
                  aria-pressed={orientation === option.value}
                  className={choiceButtonClass(orientation === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Step 2 of 2
            </p>
            <p
              ref={stepHeadingRef}
              tabIndex={-1}
              className="mb-3 rounded text-sm font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:text-white dark:focus:ring-white"
            >
              What do you want to learn about?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {INTEREST_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleInterest(option.value)}
                  aria-pressed={interests.includes(option.value)}
                  className={choiceButtonClass(interests.includes(option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && <FormError>{error}</FormError>}

          <div className="flex items-center gap-4">
            <Button type="button" size="lg" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving…" : "Continue"}
            </Button>
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={isPending}
              className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-60 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-4 space-y-3">
          <p
            ref={stepHeadingRef}
            tabIndex={-1}
            className="rounded text-sm font-semibold text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:text-white dark:focus:ring-white"
          >
            You&rsquo;re all set.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Based on what you told us, here&rsquo;s where I&rsquo;d start.
          </p>
          {recommendation && (
            <p className="text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">Start with → </span>
              <Link
                href={`/${recommendation.topicSlug}`}
                className={`font-semibold text-zinc-900 dark:text-white ${textLinkClass}`}
              >
                {recommendation.title}
              </Link>
            </p>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            You can update this anytime in Settings.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Got it
          </Button>
        </div>
      )}
    </Card>
  );
}
