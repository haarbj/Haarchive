"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

// A defensive boundary for every content-library page ([slug] covers
// essays, category landings, tools, coach/athlete/training-philosophy
// pages, and knowledge-check-bearing routes) -- without it, an uncaught
// render error here fell through to Next's default crash screen instead of
// a branded, actionable state, unlike (app)/(protected)/error.tsx, which
// already covers the authenticated app shell. Mirrors that same pattern
// exactly; only the fallback link differs ("Back to home" rather than
// "Back to dashboard"), since this route tree is reached by signed-out
// visitors too. Client component per Next.js's error.tsx convention
// (error boundaries can't be server components).
export default function SlugError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container variant="narrow">
      <Heading>Something went wrong</Heading>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        This page hit an unexpected error. Try again, or head back to the homepage.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={reset}>
          Try again
        </Button>
        <Button href="/" variant="outline" size="lg">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
