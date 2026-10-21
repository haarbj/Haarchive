"use client";

import { useActionState } from "react";

import { enterViewAsAthlete } from "@/lib/private-coaching/view-as-actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// The one entry point into view-as, reused by the roster row (a client
// component) and the athlete-detail header. "use client" so it can be
// rendered from either a Server Component parent or roster-table.tsx's
// own client tree -- same precedent as RemoveAthleteButton in that same
// file, binding a top-level Server Action the same way
// sendCoachAthleteMessage is bound in message-thread.tsx.
// enterViewAsAthlete re-validates the relationship itself, so this
// component carries no authorization logic of its own; a caller just
// never renders it for a row it already knows isn't a real athlete
// relationship (the self-coach row, someone else's athlete).
export function ViewAsButton({
  athleteId,
  athleteFirstName,
  size = "sm",
}: {
  athleteId: string;
  athleteFirstName: string;
  size?: "sm" | "md";
}) {
  const [state, formAction, isPending] = useActionState(enterViewAsAthlete.bind(null, athleteId), {});
  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" size={size} disabled={isPending}>
        View as {athleteFirstName}
      </Button>
      {state.error ? <FormError className="mt-1">{state.error}</FormError> : null}
    </form>
  );
}
