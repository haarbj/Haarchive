"use client";

import { useEffect, useRef } from "react";

import { recordConversionEvent } from "@/app/conversion-actions";
import { useAuthStatus } from "@/lib/use-auth-status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Phase 12A -- the one new public-facing product surface in this phase.
// Matches questions-cta.tsx's own end-of-article Card treatment exactly
// (same padding, centered text, Button) rather than inventing a new visual
// language for "one more CTA." Never a modal, never an interstitial:
// everything above it is fully readable whether or not this ever renders,
// and it renders nothing at all (not even a placeholder) for a loading or
// authenticated session -- see the authStatus guard below.
export function LearningProgressTeaser() {
  const authStatus = useAuthStatus();
  const shownRef = useRef(false);

  useEffect(() => {
    if (authStatus !== "unauthenticated" || shownRef.current) return;
    shownRef.current = true;
    // Fire-and-forget: never awaited, and never gates this render on
    // succeeding (see conversion-actions.ts's own fail-open reasoning).
    recordConversionEvent("cta_shown", "learning_progress", { surface: "article_end" });
  }, [authStatus]);

  // Covers both "loading" (avoids a flash before the real session is known
  // -- same guard ArticleNotes/BookmarkButton already use) and
  // "authenticated" (this teaser has nothing to say to a signed-in user).
  if (authStatus !== "unauthenticated") return null;

  return (
    <Card padding="md" className="mt-12 text-center">
      <p className="text-base font-semibold text-zinc-900 dark:text-white">Build your running knowledge.</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Sign in to track your progress, test what you know, and build toward deeper mastery.
      </p>
      <Button
        href="/login"
        onClick={() => recordConversionEvent("cta_clicked", "learning_progress", { surface: "article_end" })}
        className="mt-4"
      >
        Sign in to start
      </Button>
    </Card>
  );
}
