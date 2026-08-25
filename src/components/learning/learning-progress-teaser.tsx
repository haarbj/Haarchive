"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { recordConversionEvent } from "@/app/conversion-actions";
import { useAuthStatus } from "@/lib/use-auth-status";
import { inlineLinkClass } from "@/lib/section-styles";

// Phase 12A -- the one new public-facing product surface in this phase.
// Deliberately the quietest thing on the page: a single inline sentence,
// not a Card/Button -- this is a product/account nudge, not an editorial
// invitation (contrast questions-cta.tsx, which is the archive's own
// section), so it should read as strictly secondary to everything above it.
// Never a modal, never an interstitial: everything above it is fully
// readable whether or not this ever renders, and it renders nothing at all
// (not even a placeholder) for a loading or authenticated session -- see
// the authStatus guard below.
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
    <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
      Want to track your progress and build toward deeper mastery?{" "}
      <Link
        href="/login"
        onClick={() => recordConversionEvent("cta_clicked", "learning_progress", { surface: "article_end" })}
        className={inlineLinkClass}
      >
        Sign in
      </Link>{" "}
      to start.
    </p>
  );
}
