"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";

import { addBookmark, removeBookmark } from "@/app/bookmark-actions";
import { recordConversionEvent } from "@/app/conversion-actions";
import { useAuthStatus } from "@/lib/use-auth-status";
import { Tooltip } from "@/components/ui/tooltip";

type BookmarkButtonProps = {
  topicSlug: string;
  // Server-fetched initial state (see bookmark-actions.ts's
  // getBookmarkStatus) -- avoids a client-side flash from "not saved" to
  // "saved" for the minority of visitors who already bookmarked this
  // topic, the same reasoning knowledge-check-actions.ts's currentLevel
  // field already applies. false (not fetched at all) for a signed-out
  // visitor -- see that action's own anonymous no-op.
  initialBookmarked: boolean;
};

// Sits beside ArticleNotes' own trigger button (article-notes.tsx), same
// quiet "small utility control above the piece" treatment -- not a second,
// competing visual style. Deliberately a *separate* component from Notes,
// not a shared one: a bookmark ("come back to this") and a note (an
// annotation on a specific passage) are different actions with different
// data models, and forcing them through one component would blur that
// distinction in the code the same way it would in the product.
export function BookmarkButton({ topicSlug, initialBookmarked }: BookmarkButtonProps) {
  const authStatus = useAuthStatus();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();
  const [anonHintOpen, setAnonHintOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  // Phase 5.1 audit fix: useId(), not a hardcoded string -- the hardcoded
  // "bookmark-tooltip" id would collide if this component were ever
  // rendered more than once on the same page (harmless today, since it
  // isn't, but a real landmine for future reuse -- see the audit's own
  // P3 note). Also fixes the actual reported bug: aria-describedby used
  // to point at "bookmark-tooltip" unconditionally unless the anon hint
  // was open, but that element is only ever rendered for an authenticated
  // visitor -- a signed-out visitor's button referenced an id with no
  // matching element in the DOM at all.
  const hintId = useId();
  const tooltipId = useId();

  useEffect(() => {
    if (!anonHintOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (hintRef.current && !hintRef.current.contains(event.target as Node)) setAnonHintOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anonHintOpen]);

  function handleClick() {
    if (authStatus !== "authenticated") {
      setAnonHintOpen((v) => {
        const next = !v;
        // Phase 12A: fire only on open, not on close/toggle-off -- "shown"
        // should count once per real appearance, not once per click.
        // Fire-and-forget: never awaited, so a slow/failed analytics call
        // can't delay or block the hint from appearing.
        if (next) recordConversionEvent("cta_shown", "bookmark", { surface: "bookmark_button" });
        return next;
      });
      return;
    }

    // Optimistic: flip immediately, roll back only if the server action
    // actually reports an error. Both addBookmark/removeBookmark are
    // idempotent (unique constraint / delete-matches-zero-rows), so a
    // rapid double-click here can never produce a duplicate or a stuck
    // state -- the worst case is two redundant, harmless requests.
    const next = !bookmarked;
    setBookmarked(next);
    startTransition(async () => {
      const result = next ? await addBookmark(topicSlug) : await removeBookmark(topicSlug);
      if ("error" in result) {
        setBookmarked(!next); // rollback
      } else if (next) {
        // Phase 12A: a genuine, deliberate authenticated learning action --
        // idempotent server-side (see the migration's partial unique index),
        // so no client-side "have I already fired this" tracking is needed.
        // Only on save (next===true), not on unsave, to match "a real
        // action," not a toggle-off.
        recordConversionEvent("first_learning_action", "learning_progress", { surface: "bookmark_button" });
      }
    });
  }

  return (
    <div ref={hintRef} className="group relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={isPending && authStatus === "authenticated"}
        aria-pressed={authStatus === "authenticated" ? bookmarked : undefined}
        aria-describedby={anonHintOpen ? hintId : authStatus === "authenticated" ? tooltipId : undefined}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 disabled:opacity-70 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg className="h-[15px] w-[15px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M5.5 3.5h9a1 1 0 0 1 1 1v12l-5.5-3.2-5.5 3.2v-12a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
            fill={bookmarked ? "currentColor" : "none"}
            fillOpacity={bookmarked ? 0.15 : 0}
          />
        </svg>
        {bookmarked ? "Saved" : "Save"}
      </button>

      {authStatus === "authenticated" ? (
        <Tooltip
          id={tooltipId}
          label={bookmarked ? "Remove from Saved Topics" : "Save to your Library"}
          side="bottom"
          align="end"
          anchorRef={buttonRef}
        />
      ) : null}

      {anonHintOpen ? (
        <div
          id={hintId}
          role="tooltip"
          className="absolute top-full right-0 z-[var(--z-dropdown)] mt-2 w-64 rounded-xl border border-black/10 bg-white p-4 text-sm text-zinc-600 shadow-dropdown dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Saved topics are private to your account.{" "}
          <Link
            href="/login"
            onClick={() => recordConversionEvent("cta_clicked", "bookmark", { surface: "bookmark_button" })}
            className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white"
          >
            Sign in
          </Link>{" "}
          to build your own library.
        </div>
      ) : null}
    </div>
  );
}
