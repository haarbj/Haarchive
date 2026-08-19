"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Tooltip } from "@/components/ui/tooltip";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Desktop (xl:+) breakpoint at which this stops being a bottom sheet, kept
// in sync with the xl: variants below by hand -- Tailwind has no JS-side
// export of its own breakpoint values to read instead.
const DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";

// The site's first reusable Dialog/Drawer primitive -- previously the only
// overlay anywhere in the app was image-crop-modal.tsx, a one-off fixed div
// with no role="dialog", no focus trap, and no portal (see that file). This
// is hand-built rather than a dependency (no headless-ui/radix in this
// project, and this doesn't need more than what's here): portaled to
// document.body like site-search's own dropdown, a manual focus trap since
// nothing in this codebase provides one, and focus restored to whatever
// triggered it on close.
//
// One component, not two: `open`'s CSS differs by breakpoint (a right-side
// panel at xl:, a bottom sheet below it) rather than picking a different
// component per device, so there's exactly one place that owns focus/ESC/
// portal behavior regardless of which visual shape is showing. xl: (1280px),
// not the more typical lg: (1024px): a 380px side panel plus a genuinely
// readable article column don't both fit below that -- measured real prose
// text overlapping an open lg:-breakpoint panel at common 1024-1279px
// laptop widths, not just "cramped." See article-notes.tsx for how the
// article's own column additionally narrows itself while this is open.
//
// Desktop is a persistent utility panel, not a modal: no backdrop, no
// dimmed/inert page, no aria-modal, no trapped Tab cycle -- the article
// stays genuinely interactive (selecting a passage to attach a second note
// while the panel is already open is a real, intended workflow, and a
// desktop backdrop or a Tab trap would both actively fight that). Mobile
// keeps a light backdrop and a trapped Tab cycle: a bottom sheet is a much
// more conventional, expected "this temporarily owns the screen" pattern
// at phone width, and there's no competing "select article text while
// composing" workflow to protect there (the selection toolbar is
// desktop-only -- see article-notes.tsx).
export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [everOpened, setEverOpened] = useState(false);
  const closeTooltipId = useId();
  // Real state, not a value recomputed only inside the open-effect: both
  // the render (aria-modal) and the effect (whether Tab gets trapped) need
  // the same answer, and the render runs first -- reading it live here is
  // what keeps those two in sync instead of the render seeing a stale value
  // from before the effect last ran.
  const [isMobileSheet, setIsMobileSheet] = useState(
    () => typeof window !== "undefined" && !window.matchMedia(DESKTOP_MEDIA_QUERY).matches,
  );

  // Adjusted during render, not in an effect: everOpened only ever needs to
  // flip false -> true once and then stay true, which is exactly the
  // "adjust state during render" pattern React's own docs describe for a
  // value derived from a prop -- the `!everOpened` guard is what stops this
  // from looping. react-hooks/set-state-in-effect (this codebase's own
  // established rule, see use-site-search.ts's comment) specifically flags
  // a setState call synchronous *inside an effect body*; this isn't one.
  if (open && !everOpened) {
    setEverOpened(true);
  }

  useEffect(() => {
    // The lazy useState initializer above already computes the correct
    // value for the very first client render -- this listener only needs
    // to catch the browser window actually being resized across the
    // breakpoint after that, not re-derive the initial value too.
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    function handleChange(event: MediaQueryListEvent) {
      setIsMobileSheet(!event.matches);
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    // Focus the panel itself first (it's tabIndex=-1, a landing point, not
    // a real tab stop) rather than guessing which inner control deserves
    // focus first -- a note composer's own textarea can grab it explicitly
    // if that's the better experience for a specific open (e.g. "new note").
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Tab cycling is only enforced on the mobile sheet -- see the
      // component's own comment on why desktop leaves Tab free to move
      // between the panel and the rest of the page.
      if (!isMobileSheet) return;
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // preventScroll: true -- restoring focus to the trigger is still
      // correct (a keyboard user closing the panel should land back where
      // they opened it from), but .focus() on an element outside the
      // viewport otherwise makes the browser auto-scroll it into view,
      // which would silently fight a deliberate navigation scroll already
      // in flight -- e.g. note-card.tsx's "click a quote to return to its
      // source passage" closes this Drawer as part of that same
      // navigation, and without this, focus restoration was yanking the
      // page back to the trigger the instant the intentional scroll
      // finished.
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose, isMobileSheet]);

  // Stays unmounted entirely until the first real open -- a visitor who
  // never touches Notes pays nothing. Once opened, it stays mounted (rather
  // than unmounting on every close) so close/reopen can actually animate as
  // a slide instead of an instant pop; `inert` makes the closed-but-mounted
  // panel fully non-interactive and invisible to assistive tech in the
  // meantime, not just visually hidden.
  if (!everOpened) return null;

  return createPortal(
    // pointer-events-none on the wrapper, not just the (mobile-only, often
    // hidden) backdrop -- this div is `fixed inset-0`, covering the entire
    // viewport, and without this it silently intercepted clicks meant for
    // the article underneath everywhere the backdrop wasn't visually
    // present (which is everywhere on desktop, and is exactly the point).
    // The backdrop and panel each opt back in to pointer-events-auto
    // individually below.
    <div className="pointer-events-none fixed inset-0 z-[var(--z-modal)]" inert={!open}>
      {/* Mobile only -- see the component's own comment above. Light
          enough that the article stays recognizable underneath, never a
          blur (there never was a literal blur filter here -- a 30-50%
          black scrim over a dark-mode page reads as "hazy," which is
          likely what prompted "remove the blur"; this both lightens that
          scrim and confines it to mobile, where a dismiss-by-tapping-away
          affordance is the expected pattern). */}
      <div
        className="pointer-events-auto absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-200 motion-reduce:transition-none xl:hidden dark:bg-black/40"
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isMobileSheet ? true : undefined}
        aria-label={title}
        tabIndex={-1}
        className={`fixed inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-black/10 bg-surface shadow-dropdown outline-none transition-transform duration-200 ease-out motion-reduce:transition-none xl:inset-x-auto xl:inset-y-0 xl:right-0 xl:max-h-none xl:w-[380px] xl:rounded-none xl:rounded-l-2xl xl:border-t-0 xl:border-l dark:border-white/10 ${
          // The open/closed classes are fully mutually exclusive (never
          // both present at once) on purpose -- an earlier version kept
          // xl:translate-x-full as a permanent base class and added
          // xl:translate-x-0 only when open, and Tailwind's generated
          // stylesheet order (not this string's order) let -full keep
          // winning even while open, leaving the panel stuck off-screen.
          // Same reasoning applies to pointer-events: a base
          // pointer-events-auto plus a conditional pointer-events-none
          // would have hit the exact same class of bug.
          open ? "pointer-events-auto translate-y-0 xl:translate-x-0" : "pointer-events-none translate-y-full xl:translate-y-0 xl:translate-x-full"
        }`}
      >
        {/* A small centered grab-handle bar, the standard bottom-sheet
            affordance -- purely visual (no drag-to-dismiss gesture, Escape
            and the backdrop already close it), hidden at xl: where the
            panel isn't a sheet. */}
        <div className="flex items-center justify-center pt-2.5 xl:hidden">
          <div className="h-1 w-9 rounded-full bg-black/10 dark:bg-white/15" />
        </div>
        <div className="flex items-center justify-between border-b border-black/5 px-6 pt-3 pb-3 xl:pt-5 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            {title}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close notes"
            aria-describedby={closeTooltipId}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <Tooltip id={closeTooltipId} label="Close notes" side="bottom" align="end" anchorRef={closeButtonRef} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
