"use client";

import { useActionState } from "react";

import { submitContactMessage } from "@/app/contact-actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactMessage, {});

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 dark:border-emerald-400/30 dark:bg-emerald-400/5">
        <p className="text-lg font-semibold text-zinc-900 dark:text-white">Thanks for reaching out.</p>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          I read every message myself — I&rsquo;ll get back to you at the email you left.
        </p>
      </div>
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
        <label htmlFor="message" className={labelClass}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          minLength={10}
          maxLength={4000}
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
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
