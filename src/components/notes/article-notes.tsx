"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { ContentBlock } from "@/lib/sections";
import { recordConversionEvent } from "@/app/conversion-actions";
import { createClient } from "@/lib/db/client";
import { computeAnchor, resolveAnchor } from "@/lib/notes/anchor";
import { mapNoteRow, type Note, type NoteRow } from "@/lib/notes/types";
import { useTextSelection } from "@/lib/notes/use-text-selection";
import { useAuthStatus } from "@/lib/use-auth-status";
import {
  findSourceBlockElement,
  highlightExactPassage,
  isSourceNavigable,
  pulseSourcePassage,
  scrollToSourcePassage,
} from "@/lib/notes/navigate-to-source";
import { Drawer } from "@/components/ui/drawer";
import { Tooltip } from "@/components/ui/tooltip";
import { NotesPanel, type DraftNote } from "@/components/notes/notes-panel";
import { SelectionToolbar } from "@/components/notes/selection-toolbar";
import { BookmarkButton } from "@/components/notes/bookmark-button";

type ArticleNotesProps = {
  contentSlug: string;
  content: ContentBlock[];
  // Phase 5 -- server-fetched initial Saved-Topics state (see
  // article-layout.tsx and bookmark-actions.ts's getBookmarkStatus).
  // Rendered in the same row as the Notes trigger below (see that div's
  // own comment) since product-wise they're the two quiet per-article
  // utilities that belong beside each other, not because they share any
  // implementation -- BookmarkButton owns its own state/actions entirely.
  initialBookmarked: boolean;
};

// Mounted once per long-form page (see article-layout.tsx). Deliberately
// quiet: a small text control, not a button styled to compete with the
// article, sitting at the same sticky offset the desktop TOC already uses
// so it reads as part of the page's own margin rather than injected chrome.
// Notes are fetched lazily -- only once the panel is actually opened or a
// selection note is actually started, never on page load -- so the (today,
// 100%) of readers who never touch this feature pay nothing for it.
export function ArticleNotes({ contentSlug, content, initialBookmarked }: ArticleNotesProps) {
  const authStatus = useAuthStatus();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [drafts, setDrafts] = useState<DraftNote[]>([]);
  const [anonHintOpen, setAnonHintOpen] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);
  const hintId = useId();
  const tooltipId = useId();

  useEffect(() => {
    containerRef.current = document.getElementById("article-content");
  }, []);

  const selection = useTextSelection(containerRef, authStatus === "authenticated");

  useEffect(() => {
    if (!anonHintOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (hintRef.current && !hintRef.current.contains(event.target as Node)) setAnonHintOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anonHintOpen]);

  // The desktop panel is a fixed overlay, not a layout participant, so it
  // can't narrow the article's own prose column just by opening -- real
  // article text was found overlapping it at common laptop widths without
  // this. document.documentElement (not a ref) because the panel and the
  // article's grid are siblings deep in different parts of this tree, and
  // this is the one property genuinely worth a DOM-level bridge rather than
  // threading "is the notes panel open" through props the article layout
  // otherwise has no reason to know about. xl:pr-[var(--notes-reserved-width)]
  // on the grid (article-layout.tsx) is the only consumer; zero by default
  // everywhere else, and only ever non-zero at xl:+, matching the panel's
  // own side-panel breakpoint (see drawer.tsx).
  useEffect(() => {
    document.documentElement.style.setProperty("--notes-reserved-width", open ? "340px" : "0px");
    return () => document.documentElement.style.setProperty("--notes-reserved-width", "0px");
  }, [open]);

  // Always refetches on open rather than caching after the first load --
  // notes created earlier in the same visit (via a draft) never got folded
  // back into local state, so a stale cache would make a just-created note
  // appear to vanish the moment the panel was closed and reopened. `notes`
  // is only ever replaced with a fresh result, never reset to null first,
  // so a reopen shows the last-known list instantly instead of flashing
  // "Loading notes…" for something already seen this visit.
  async function refreshNotes() {
    const fetchId = ++fetchIdRef.current;
    const supabase = createClient();
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("content_slug", contentSlug)
      .order("created_at", { ascending: false })
      .returns<NoteRow[]>();
    if (fetchId !== fetchIdRef.current) return; // a newer refresh already landed
    setNotes((data ?? []).map(mapNoteRow));
  }

  // Phase 5 (Library "My Notes" -> click a note -> open the article and
  // jump to the exact passage): the notes panel already fetches lazily and
  // never on a plain page load (see this component's own header comment),
  // so this is the one narrow exception -- only when a `?note=<id>` param
  // is actually present, meaning the visit itself came from that click,
  // not an ordinary read. Reuses every existing resolution/navigation
  // primitive (resolveAnchor, findSourceBlockElement,
  // scrollToSourcePassage, pulseSourcePassage, highlightExactPassage) --
  // the exact same functions note-card.tsx's own in-page "return to
  // passage" button already calls -- rather than a second implementation.
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkNoteId = searchParams.get("note");
  const deepLinkHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deepLinkNoteId || authStatus !== "authenticated") return;
    if (deepLinkHandledRef.current === deepLinkNoteId) return;
    deepLinkHandledRef.current = deepLinkNoteId;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("id", deepLinkNoteId)
        .maybeSingle<NoteRow>();
      if (cancelled) return;

      // Strips the param on every path below, found-and-highlighted or
      // unresolvable alike, so a refresh/back-navigation never re-triggers
      // the same lookup -- replace, not push, since this isn't a real
      // navigation the user should be able to "back" out of separately
      // from the click that brought them here. A stale/deleted note (the
      // failure case) gets no highlight and no visible message, just a
      // clean URL -- the article renders exactly as an ordinary visit.
      const cleanUpUrl = () => router.replace(`/${contentSlug}`, { scroll: false });

      if (!data) return cleanUpUrl(); // deleted/nonexistent note -- nothing to jump to
      const note = mapNoteRow(data);
      if (!note.selectedText || !note.anchor) return cleanUpUrl(); // a general note has no passage to jump to

      const resolution = resolveAnchor(content, note.selectedText, note.anchor);
      if (!isSourceNavigable(note, resolution) || resolution.status !== "resolved") return cleanUpUrl();
      const element = findSourceBlockElement(resolution.blockIndex);
      if (!element) return cleanUpUrl();

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollToSourcePassage(element, prefersReducedMotion);
      pulseSourcePassage(element);
      highlightExactPassage(element, note.selectedText, note.anchor);
      cleanUpUrl();
    })();

    return () => {
      cancelled = true;
    };
  }, [deepLinkNoteId, authStatus, content, contentSlug, router]);

  function handleTriggerClick() {
    if (authStatus !== "authenticated") {
      setAnonHintOpen((v) => {
        const next = !v;
        // Phase 12A: fire only on open, same "count appearances, not
        // clicks" reasoning as bookmark-button.tsx. Fire-and-forget.
        if (next) recordConversionEvent("cta_shown", "notes", { surface: "notes_trigger" });
        return next;
      });
      return;
    }
    setOpen(true);
    void refreshNotes();
  }

  function handleAddGeneral() {
    setOpen(true);
    void refreshNotes();
    setDrafts((prev) => [{ localId: crypto.randomUUID(), selectedText: null, anchor: null }, ...prev]);
  }

  function handleAddFromSelection() {
    if (!selection) return;
    const anchor = computeAnchor(content, selection.blockIndex, selection.text);
    setOpen(true);
    void refreshNotes();
    setDrafts((prev) => [{ localId: crypto.randomUUID(), selectedText: selection.text, anchor }, ...prev]);
  }

  function handleClose() {
    setOpen(false);
    // Drafts are session-only scaffolding, not persisted state: anything
    // genuinely typed has already autosaved into a real row by now, and an
    // abandoned empty composer was correctly never created at all. The next
    // open refreshes notes fresh, so there's nothing to carry forward.
    setDrafts([]);
  }

  if (authStatus === "loading") return null;

  return (
    <>
      {/* A plain row above the article, not docked into the grid gutter --
          the gutter's actual free width varies with viewport and TOC
          presence, which made a floating/sticky placement there fragile.
          Right-aligned and unstyled beyond a hover state, the same
          treatment as any other quiet text control on the site, so it
          reads as one more small utility above the piece (like a reading
          time) rather than injected product chrome. */}
      <div className="flex items-center justify-end gap-1">
        <BookmarkButton topicSlug={contentSlug} initialBookmarked={initialBookmarked} />
        <div ref={hintRef} className="group relative">
          <button
            type="button"
            onClick={handleTriggerClick}
            aria-haspopup={authStatus === "authenticated" ? "dialog" : undefined}
            aria-expanded={authStatus === "authenticated" ? open : undefined}
            aria-describedby={anonHintOpen ? hintId : authStatus === "authenticated" ? tooltipId : undefined}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg className="h-[15px] w-[15px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4.5 3.5h8l3 3v10a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path d="M7 9h6M7 12h6M7 15h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Notes
          </button>

          {/* Only for the authenticated trigger -- the anonymous hint below
              already explains the control on click, and showing both at
              once would just compete for the same spot. Adds real
              information beyond the visible "Notes" label itself
              (privacy), rather than just restating it. */}
          {authStatus === "authenticated" ? (
            <Tooltip id={tooltipId} label="Your private notes" side="bottom" align="end" anchorRef={hintRef} />
          ) : null}

          {anonHintOpen ? (
            <div
              id={hintId}
              role="tooltip"
              className="absolute top-full right-0 z-[var(--z-dropdown)] mt-2 w-64 rounded-xl border border-black/10 bg-white p-4 text-sm text-zinc-600 shadow-dropdown dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Notes are private to your account.{" "}
              <Link
                href="/login"
                onClick={() => recordConversionEvent("cta_clicked", "notes", { surface: "notes_trigger" })}
                className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white"
              >
                Sign in
              </Link>{" "}
              to keep your own notes on what you read.
            </div>
          ) : null}
        </div>
      </div>

      {/* Hidden below lg: -- this is about input modality (a floating
          affordance next to a mouse-made selection), not the panel's own
          side-panel/bottom-sheet breakpoint. On a touchscreen it would also
          fight with the OS's own native selection menu appearing in
          roughly the same spot; general notes (via the panel's own "Add a
          general note") stay fully available on mobile either way. */}
      {authStatus === "authenticated" && selection ? (
        <div className="hidden lg:block">
          <SelectionToolbar rect={selection.rect} onAddNote={handleAddFromSelection} />
        </div>
      ) : null}

      {authStatus === "authenticated" ? (
        <Drawer open={open} onClose={handleClose} title="Notes">
          <NotesPanel
            content={content}
            contentSlug={contentSlug}
            notes={notes}
            drafts={drafts}
            onAddGeneral={handleAddGeneral}
            onDraftDeleted={(localId) => setDrafts((prev) => prev.filter((d) => d.localId !== localId))}
            onNoteDeleted={(id) => setNotes((prev) => (prev ? prev.filter((n) => n.id !== id) : prev))}
            onNavigateToSource={handleClose}
          />
        </Drawer>
      ) : null}
    </>
  );
}
