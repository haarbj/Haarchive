"use client";

type SelectionToolbarProps = {
  rect: DOMRect;
  onAddNote: () => void;
};

// A single small affordance near a finished selection -- never intercepts
// the selection itself (mousedown/mouseup on the text underneath still do
// exactly what the browser would do anyway: select, copy, right-click).
// Positioned with `fixed` against the same viewport-relative rect
// getBoundingClientRect() already returns, so no scroll-offset math is
// needed; use-text-selection.ts dismisses this on scroll instead of trying
// to keep it glued to text that's since moved.
export function SelectionToolbar({ rect, onAddNote }: SelectionToolbarProps) {
  return (
    <button
      type="button"
      data-notes-selection-toolbar
      onClick={onAddNote}
      style={{
        position: "fixed",
        top: rect.bottom + 8,
        left: Math.min(Math.max(rect.left + rect.width / 2, 72), window.innerWidth - 72),
        transform: "translateX(-50%)",
      }}
      // dark:bg-zinc-900 (identical to the page background) plus a
      // dark:border-white/10 hairline measured at ~1.1-1.25:1 against the
      // article background -- effectively invisible on a dark, near-black
      // page (WCAG 1.4.11 needs >=3:1 for a UI component's boundary). A
      // solid (non-alpha) zinc-500 border measures 4.12:1 against the page
      // background -- a comfortable, robust margin over the 3:1 floor
      // rather than a borderline pass -- while staying a muted gray, not a
      // bright accent ring, per "small + understated + clearly visible."
      // The fill moves one step lighter (zinc-900 -> zinc-800) so the
      // border reads as a real edge rather than sitting on an identical
      // fill; text/icon stay zinc-200 (11.74:1 against zinc-800).
      className="z-[var(--z-dropdown)] flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-dropdown transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus-visible:ring-white"
    >
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Note
    </button>
  );
}
