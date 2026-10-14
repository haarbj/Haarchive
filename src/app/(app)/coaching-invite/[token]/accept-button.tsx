"use client";

import { useActionState } from "react";

import { acceptPrivateCoachInvite } from "./actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function AcceptButton({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(acceptPrivateCoachInvite.bind(null, token), {});

  return (
    <form action={formAction}>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Accepting…" : "Accept coaching invite"}
      </Button>
      {state.error && <FormError className="mt-3">{state.error}</FormError>}
    </form>
  );
}
