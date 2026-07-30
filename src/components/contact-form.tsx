"use client";

import { useActionState } from "react";

import { submitContactMessage } from "@/app/contact-actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { SuccessPanel } from "@/components/ui/success-panel";
import { FormError } from "@/components/ui/form-error";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactMessage, {});

  if (state.success) {
    return (
      <SuccessPanel heading="Thanks for reaching out.">
        I read every message myself. I&rsquo;ll get back to you at the email you left.
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

      {state.error ? <FormError>{state.error}</FormError> : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
