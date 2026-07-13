"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

// One boundary for the whole authenticated app -- without it, any thrown
// query/render error here fell through to Next's default crash screen
// instead of a branded, actionable state. Client component per Next.js's
// error.tsx convention (error boundaries can't be server components).
export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container variant="narrow">
      <Heading>Something went wrong</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        This page hit an unexpected error. Try again, or head back to your dashboard.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={reset}>
          Try again
        </Button>
        <Button href="/dashboard" variant="outline" size="lg">
          Back to dashboard
        </Button>
      </div>
    </Container>
  );
}
