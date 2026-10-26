"use client";

import { useState, useTransition } from "react";

import { resendVerificationEmail } from "./actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function ResendVerificationButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await resendVerificationEmail();
            if (result.error) setError(result.error);
            else setMessage("Confirmation email sent.");
          });
        }}
      >
        {pending ? "Sending…" : "Resend confirmation email"}
      </Button>
      {message ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
      {error ? <FormError className="mt-2">{error}</FormError> : null}
    </div>
  );
}
