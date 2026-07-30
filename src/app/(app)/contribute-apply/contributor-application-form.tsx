"use client";

import { useActionState } from "react";

import { submitContributorApplication } from "./actions";
import { CONTRIBUTION_TYPES, CONTRIBUTION_TYPE_LABELS } from "@/lib/validation/contributor-application";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { SuccessPanel } from "@/components/ui/success-panel";
import { FormError } from "@/components/ui/form-error";

export function ContributorApplicationForm() {
  const [state, formAction, isPending] = useActionState(submitContributorApplication, {});

  if (state.success) {
    return (
      <SuccessPanel heading="Thanks for applying.">
        I read every application myself. I&rsquo;ll follow up at the email you left once I&rsquo;ve had a
        chance to review it.
      </SuccessPanel>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input id="name" name="name" required maxLength={100} className={`${fieldClass} w-full`} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" required maxLength={200} className={`${fieldClass} w-full`} />
      </div>

      <div>
        <span className={labelClass}>What would you like to contribute?</span>
        <div className="mt-1 flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          {CONTRIBUTION_TYPES.map((type) => (
            <label key={type} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="contributionTypes"
                value={type}
                className="accent-zinc-900 dark:accent-white"
              />
              {CONTRIBUTION_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="background" className={labelClass}>
          Relevant background
        </label>
        <textarea
          id="background"
          name="background"
          required
          rows={4}
          minLength={20}
          maxLength={2000}
          placeholder="Coaching experience, exercise science or physiology background, running experience, or other relevant credentials."
          className={`${fieldClass} w-full`}
        />
      </div>

      <div>
        <label htmlFor="topicIdea" className={labelClass}>
          A topic idea or writing sample (optional)
        </label>
        <textarea
          id="topicIdea"
          name="topicIdea"
          rows={3}
          maxLength={2000}
          placeholder="A topic or article idea you'd want to write about, or a link to past writing or coaching work."
          className={`${fieldClass} w-full`}
        />
      </div>

      <div>
        <label htmlFor="motivation" className={labelClass}>
          Why do you want to contribute to the Haarchive?
        </label>
        <textarea
          id="motivation"
          name="motivation"
          required
          rows={3}
          minLength={20}
          maxLength={2000}
          className={`${fieldClass} w-full`}
        />
      </div>

      {/* Honeypot -- invisible to real visitors, irresistible to bots that
          fill every field. A non-empty value here silently fails validation. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error ? (
        <FormError>{state.error}</FormError>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
