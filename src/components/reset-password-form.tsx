"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/(app)/auth-actions";
import { fieldClass as baseFieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const fieldClass = `w-full ${baseFieldClass}`;

// Password + confirm only -- no email field, unlike AuthForm. Reachable
// only with the short-lived recovery session /auth/callback already
// established; updatePassword redirects to /dashboard on success, so
// there's no success message state to render here.
export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={fieldClass}
        />
      </div>

      {state.error && <FormError>{state.error}</FormError>}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
