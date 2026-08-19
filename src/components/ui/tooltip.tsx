"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  label: string;
  side?: "top" | "bottom";
  align?: "center" | "end";
  // Pair with aria-describedby on a trigger you render directly -- see the
  // component's own doc comment below.
  id?: string;
  // The element hover/focus is actually watched on -- getBoundingClientRect()
  // on this is what the portaled tooltip below positions itself against.
  anchorRef: RefObject<HTMLElement | null>;
};

const GAP = 8;
// Same "hover is a mouse-cursor affordance" reasoning as
// selection-toolbar.tsx -- a tooltip has nothing useful to say on a device
// that never hovers, and this is now a JS check (not a `lg:block` CSS
// class) since the tooltip itself is portaled outside any element that
// class could apply to.
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

// The site's reusable tooltip -- portaled to document.body and positioned
// with `fixed` from the anchor's own live getBoundingClientRect(), the same
// technique site-search.tsx's dropdown already uses (including the
// `{ capture: true }` scroll listener, which is what actually catches a
// scroll happening *inside* a nested scrollable ancestor, not just the
// document itself).
//
// This used to be a plain sibling `<span>` inside a `group relative`
// wrapper, shown via `group-hover`/`group-focus-within` CSS alone. That
// broke down for exactly one real case: the Delete tooltip in note-card.tsx
// lives inside Drawer's own `overflow-y-auto` content region, and a plain
// `absolute`-positioned child is clipped by that ancestor's overflow the
// moment its trigger scrolls near the top edge of the visible panel.
// Portaling to document.body with `position: fixed` doesn't just reposition
// around that problem, it removes the tooltip from the clipping ancestor's
// box entirely -- it's a sibling of the Drawer's own portal under
// document.body, not a descendant of anything that clips.
//
// Visibility is now driven by real pointerenter/pointerleave/focusin/
// focusout listeners on the anchor (mount/unmount), not CSS group
// selectors -- a portaled node can't be targeted by an ancestor's
// group-hover rule in the first place, since it's no longer a descendant of
// that ancestor once rendered under document.body. Mounting exactly when
// shown (rather than always-present-but-opacity-0) also means a trigger's
// aria-describedby only ever points at an id that's actually in the
// accessibility tree while the description is genuinely visible/relevant.
export function Tooltip({ label, side = "top", align = "center", id, anchorRef }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  // A separate flag from `visible`, flipped one frame after mount, purely
  // to get a real opacity transition on entry (mounting straight at
  // opacity-100 can't animate) without needing the tooltip DOM to exist at
  // all while hidden.
  const [entered, setEntered] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    function updatePosition() {
      if (!anchor) return;
      const box = anchor.getBoundingClientRect();
      setPosition({
        top: side === "top" ? box.top - GAP : box.bottom + GAP,
        left: align === "end" ? box.right : box.left + box.width / 2,
      });
    }

    function show() {
      if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return;
      updatePosition();
      setVisible(true);
    }
    function hide() {
      setVisible(false);
      setEntered(false);
    }

    anchor.addEventListener("pointerenter", show);
    anchor.addEventListener("pointerleave", hide);
    anchor.addEventListener("focusin", show);
    anchor.addEventListener("focusout", hide);
    return () => {
      anchor.removeEventListener("pointerenter", show);
      anchor.removeEventListener("pointerleave", hide);
      anchor.removeEventListener("focusin", show);
      anchor.removeEventListener("focusout", hide);
    };
  }, [anchorRef, side, align]);

  useEffect(() => {
    if (!visible) return;
    const anchor = anchorRef.current;

    function updatePosition() {
      if (!anchor) return;
      const box = anchor.getBoundingClientRect();
      setPosition({
        top: side === "top" ? box.top - GAP : box.bottom + GAP,
        left: align === "end" ? box.right : box.left + box.width / 2,
      });
    }

    const raf = requestAnimationFrame(() => setEntered(true));
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible, anchorRef, side, align]);

  if (!visible || !position) return null;

  const translate = `translate(${align === "end" ? "-100%" : "-50%"}, ${side === "top" ? "-100%" : "0"})`;

  return createPortal(
    <span
      id={id}
      role="tooltip"
      style={{ position: "fixed", top: position.top, left: position.left, transform: translate }}
      className={`pointer-events-none z-[var(--z-tooltip)] whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-dropdown transition-opacity duration-150 motion-reduce:transition-none dark:bg-zinc-100 dark:text-zinc-900 ${entered ? "opacity-100" : "opacity-0"}`}
    >
      {label}
    </span>,
    document.body,
  );
}
