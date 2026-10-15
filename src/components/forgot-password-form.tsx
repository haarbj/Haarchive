"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/app/(app)/auth-actions";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

// Email-only -- AuthForm always pairs email with a password field, which
// doesn't fit this step. Success is a plain message, not a redirect: the
// coach/athlete stays on this page and goes to check their email next,
// there's nowhere further to navigate to yet.
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={fieldClass} />
      </div>

      {state.error && <FormError>{state.error}</FormError>}
      {state.message && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
