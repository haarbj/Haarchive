"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ContentBlock } from "@/lib/sections";
import { recordConversionEvent } from "@/app/conversion-actions";
import { formatRelativeTime } from "@/lib/format";
import { resolveAnchor } from "@/lib/notes/anchor";
import { createNote, deleteNote, updateNoteBody } from "@/lib/notes/actions";
import {
  findSourceBlockElement,
  highlightExactPassage,
  isSourceNavigable,
  pulseSourcePassage,
  scrollToSourcePassage,
} from "@/lib/notes/navigate-to-source";
import type { Note, NoteAnchor } from "@/lib/notes/types";
import { useAutosave } from "@/lib/use-autosave";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Tooltip } from "@/components/ui/tooltip";

type NoteCardProps = {
  content: ContentBlock[];
  contentSlug: string;
  // Either an existing, persisted note, or the seed for a brand-new one
  // (draft.id is undefined until the first debounced save actually creates
  // the row -- see useAutosave's create-then-update handoff below).
  note: Note | { id?: undefined; body: string; selectedText: string | null; anchor: NoteAnchor | null };
  onDeleted: () => void;
  autoFocus?: boolean;
  // Called after successfully navigating to a note's source passage --
  // ArticleNotes passes its own handleClose here, the same function
  // Escape/the backdrop/the Close button already use, so "click a quote"
  // closes the panel exactly the way every other close path already does.
  onNavigateToSource?: () => void;
};

// Keeps a Delete button's aria-label (see below) readable even for a note
// anchored to a long selected passage -- the visible quote itself is never
// truncated, only this screen-reader-only differentiator.
function truncateForAriaLabel(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

// A margin note, not a form field: no visible box/border around the
// textarea itself, just a hairline underneath separating one note from the
// next -- matching the site's own default separator convention rather than
// a bordered "card" treatment that would read as a product UI panel.
export function NoteCard({ content, contentSlug, note, onDeleted, autoFocus, onNavigateToSource }: NoteCardProps) {
  const [body, setBody] = useState(note.body);
  const idRef = useRef<string | undefined>(note.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteWrapperRef = useRef<HTMLSpanElement>(null);
  const [deleting, setDeleting] = useState(false);

  const { status, error, retry } = useAutosave({
    value: body,
    isEmpty: (value) => value.trim().length === 0,
    onSave: async (value) => {
      if (!idRef.current) {
        const result = await createNote({
          contentSlug,
          body: value,
          selectedText: note.selectedText,
          anchor: note.anchor,
        });
        if ("error" in result) return { ok: false, error: result.error };
        idRef.current = result.id;
        // Phase 12A: only on creation, matching createNote's own
        // note_taken signal above it (an edit to an existing note isn't a
        // new "first action"). Idempotent server-side; fire-and-forget.
        recordConversionEvent("first_learning_action", "learning_progress", { surface: "note_card" });
        return { ok: true };
      }
      const result = await updateNoteBody(idRef.current, value);
      if (result.error) return { ok: false, error: result.error };
      return { ok: true };
    },
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  useEffect(() => {
    if (!autoFocus) return;
    // scrollIntoView, not just focus(): a new draft is always prepended to
    // the top of its section, but if the panel is already scrolled down
    // past that point (a real case once there are several notes), focus
    // alone moves the caret somewhere the user can't see land.
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ block: "nearest" });
  }, [autoFocus]);

  // Only real, persisted notes have a timestamp -- a draft mid-composition
  // has nothing to report yet. Shown only once autosave is otherwise quiet
  // (idle), reusing the same status slot rather than adding a second line:
  // "Saving…"/"Saved" already tell the more relevant story while they're
  // true, and once they're not, "returned to this later" is what's useful.
  const timestamp = "updatedAt" in note ? note.updatedAt : null;

  const anchorResolution = useMemo(() => {
    if (!note.selectedText || !note.anchor) return null;
    return resolveAnchor(content, note.selectedText, note.anchor);
  }, [content, note.selectedText, note.anchor]);

  async function handleDelete() {
    if (idRef.current) {
      setDeleting(true);
      await deleteNote(idRef.current);
    }
    onDeleted();
  }

  // Only ever wired up when isSourceNavigable is true (resolved anchor,
  // real selectedText) -- resolveAnchor already refuses to guess at an
  // ambiguous or missing passage, and this refuses to navigate on the
  // strength of anything less than that same real resolution.
  //
  // Closes the panel *before* measuring/scrolling, not after: closing also
  // widens the article's own reading column back to full width (see
  // article-notes.tsx's --notes-reserved-width), which reflows every block
  // below where that width changes. Reading this element's position first
  // and closing second was measuring a spot that was about to move --
  // found this the hard way, via a live scroll-position check, not by
  // inspection. The double requestAnimationFrame waits until the browser
  // has actually painted the reflowed layout before measuring; the element
  // reference itself stays valid across it (this is a width/layout change,
  // not a remount).
  function handleNavigateToSource() {
    if (anchorResolution?.status !== "resolved") return;
    if (!note.selectedText || !note.anchor) return;
    const element = findSourceBlockElement(anchorResolution.blockIndex);
    if (!element) return;

    onNavigateToSource?.();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        scrollToSourcePassage(element, prefersReducedMotion);
        pulseSourcePassage(element);
        // Independent of the block-level pulse above: this narrows the cue
        // to the exact phrase within the block, and simply doesn't apply
        // (silently -- the pulse alone still lands you in the right spot)
        // when the exact text can't be found unambiguously. See
        // findExactOccurrence's own comment for why that's a deliberate
        // refusal to guess, not a bug.
        if (note.selectedText && note.anchor) {
          highlightExactPassage(element, note.selectedText, note.anchor);
        }
      });
    });
  }

  const navigable = isSourceNavigable(note, anchorResolution);

  return (
    <div className="group border-b border-black/5 py-4 first:pt-0 last:border-b-0 dark:border-white/10">
      {note.selectedText ? (
        navigable ? (
          // A <button>, not a styled <a> -- this returns you to a place in
          // the same page, not a navigation destination, and shouldn't
          // read as a link (no blue, no underline). Still an excerpt
          // first: the hover/focus treatment only nudges the existing
          // border and text color rather than adding a pill or a visible
          // "action" chrome around it.
          <button
            type="button"
            onClick={handleNavigateToSource}
            aria-label={`Return to highlighted passage: ${note.selectedText}`}
            // dark:focus-visible:outline-zinc-600 measured at 2.29:1 against
            // the panel background -- fails the 3:1 focus-indicator floor
            // (WCAG 2.4.11/1.4.11). zinc-400 measures 6.91:1, a comfortable
            // pass, without jumping all the way to white. py-0.5 also
            // bumped to py-1: at py-0.5 this sat right at the ~24px WCAG
            // 2.5.8 target-size floor (text-sm line-height + 4px padding);
            // py-1 gives it a real, unambiguous margin above that line
            // rather than a browser-font-metric-dependent exact boundary.
            className="mb-2 block w-full cursor-pointer rounded-md border-l-2 border-zinc-900/15 py-1 pr-2 pl-3 text-left text-sm text-zinc-500 italic transition hover:border-zinc-900/30 hover:bg-black/[0.02] hover:text-zinc-700 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-zinc-300 dark:border-white/20 dark:text-zinc-400 dark:hover:border-white/40 dark:hover:bg-white/[0.03] dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-400"
          >
            &ldquo;{note.selectedText}&rdquo;
          </button>
        ) : (
          <blockquote className="mb-2 border-l-2 border-zinc-900/15 pl-3 text-sm text-zinc-500 italic dark:border-white/20 dark:text-zinc-400">
            &ldquo;{note.selectedText}&rdquo;
            {anchorResolution?.status === "unresolved" ? (
              <span className="mt-1 block not-italic text-xs font-medium text-zinc-400 dark:text-zinc-400">
                This passage may have changed since the note was made.
              </span>
            ) : null}
          </blockquote>
        )
      ) : null}

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note…"
        rows={1}
        aria-label={note.selectedText ? "Note on highlighted passage" : "General note"}
        className="w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-6 text-zinc-800 placeholder:text-zinc-400 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-zinc-300 dark:text-zinc-200 dark:placeholder:text-zinc-400 dark:focus-visible:outline-zinc-400"
      />

      {/* text-zinc-500 on the dark panel measures 3.67:1 -- passes the 3:1
          large-text/UI floor but fails the 4.5:1 normal-text floor this
          small (text-xs) status/metadata copy actually needs. zinc-400
          measures 6.91:1. */}
      <div className="mt-1.5 flex h-4 items-center justify-between text-xs text-zinc-400 dark:text-zinc-400">
        <span aria-live="polite">
          {status === "saving" ? "Saving…" : null}
          {status === "saved" ? "Saved" : null}
          {status === "idle" && timestamp ? formatRelativeTime(timestamp) : null}
          {status === "error" ? (
            <span className="text-accent-error">
              Unable to save.{" "}
              <button type="button" onClick={retry} className="font-semibold underline underline-offset-2">
                Retry
              </button>
              {error ? <span className="sr-only"> ({error})</span> : null}
            </span>
          ) : null}
        </span>

        <span ref={deleteWrapperRef} className="group/delete relative inline-flex">
          {/* opacity-0-until-hover only applies on devices that actually
              have a hover capability -- gated behind (hover: hover) rather
              than the bare `hover:`/`opacity-0` pair used everywhere else on
              desktop, so a touch device (no hover event ever fires) doesn't
              end up with a permanently invisible Delete control. Idle-state
              color also bumped: dark:text-zinc-500 measured 3.67:1 against
              the panel, under the 4.5:1 normal-text floor -- zinc-400
              measures 6.91:1. focus-visible:outline-none previously had no
              replacement indicator at all -- a keyboard Tab to this button
              only ever changed its opacity (already the case whenever it's
              hovered too, so on its own that's not a real focus cue).
              Same outline treatment as the quote button/textarea above,
              just a tighter offset-2 rather than offset-4 for this
              small inline text control. p-1 -m-1: the bare text was only
              ~16-20px tall/wide, under the 24px WCAG 2.5.8 target-size
              floor -- padding widens the real hit area, the matching
              negative margin keeps the visible size/position unchanged.
              ariaLabel differentiates this from every other note's own
              "Delete" button -- otherwise a screen reader user tabbing
              through several notes hears the same undifferentiated
              "Delete, button" with no way to tell which note it's on. */}
          <ConfirmButton
            action={handleDelete}
            confirmMessage="Delete this note? This can't be undone."
            label="Delete"
            pendingLabel="Deleting…"
            ariaLabel={
              note.selectedText
                ? `Delete note on "${truncateForAriaLabel(note.selectedText)}"`
                : body.trim()
                  ? `Delete note: ${truncateForAriaLabel(body.trim())}`
                  : "Delete empty note"
            }
            className="-m-1 p-1 font-medium text-zinc-400 transition [@media(hover:hover)]:opacity-0 hover:text-zinc-700 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 group-hover:opacity-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:focus-visible:outline-zinc-400"
          />
          {/* No aria-describedby wiring -- ConfirmButton doesn't forward
              arbitrary props to its own inner <button>, and its visible
              "Delete" text is already an adequate accessible name on its
              own; this tooltip is purely a sighted-hover nicety. Anchored
              to this wrapper span (tightly sized around the one button
              inside it) rather than the button itself, since ConfirmButton
              doesn't forward a ref to its inner element either. */}
          <Tooltip label="Delete note" side="top" align="end" anchorRef={deleteWrapperRef} />
        </span>
      </div>
      {deleting ? <span className="sr-only">Deleting note…</span> : null}
    </div>
  );
}
