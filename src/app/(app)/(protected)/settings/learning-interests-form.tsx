"use client";

import { useActionState, useId, useState } from "react";

import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { saveLearningPreferences } from "@/app/learning-actions";
import type { LearningInterestCategory, LearningOrientation } from "@/lib/validation/learning";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

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

type LearningInterestsFormProps = {
  initialOrientation: LearningOrientation | null;
  initialInterestCategorySlugs: LearningInterestCategory[];
};

// Small, on purpose -- CLAUDE.md's Phase 1 spec is explicit that this is
// not a full profile page, just the one place to review/change what
// onboarding asked (the orientation single-select and interest
// multi-select), reusing the exact same server action the two-step
// dashboard onboarding prompt submits to.
export function LearningInterestsForm({
  initialOrientation,
  initialInterestCategorySlugs,
}: LearningInterestsFormProps) {
  const baseId = useId();
  const [state, formAction, isPending] = useActionState(saveLearningPreferences, {});
  const [interests, setInterests] = useState<LearningInterestCategory[]>(initialInterestCategorySlugs);

  function toggleInterest(value: LearningInterestCategory) {
    setInterests((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor={`${baseId}-orientation`} className={labelClass}>
          What brings you to the Haarchive?
        </label>
        <select
          id={`${baseId}-orientation`}
          name="orientation"
          defaultValue={initialOrientation ?? ""}
          className={fieldClass}
        >
          <option value="">Not set</option>
          {ORIENTATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className={labelClass}>What do you want to learn about?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {INTEREST_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200"
            >
              <input
                type="checkbox"
                name="interests"
                value={option.value}
                checked={interests.includes(option.value)}
                onChange={() => toggleInterest(option.value)}
                className="h-4 w-4 rounded border-black/20 dark:border-white/20"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {state.error && <FormError>{state.error}</FormError>}
      {state.success && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
