"use client";

import { useEffect, useState, type RefObject } from "react";

export type SelectionCapture = {
  text: string;
  blockIndex: number;
  rect: DOMRect;
};

// Read-only with respect to the Selection API -- never calls
// preventDefault, never modifies the selection, so native browser
// selection/copy/context-menu behavior is completely unaffected. Recomputes
// on mouseup/touchend (a drag-select finishing) and on keyup within the
// container (Shift+Arrow/Ctrl+A-style keyboard selection), not on every
// selectionchange event, which fires continuously -- including on every
// caret move -- and would be needless work for something this lightweight.
// The keyup listener specifically is what keeps this usable via keyboard,
// not just mouse/touch.
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): SelectionCapture | null {
  const [capture, setCapture] = useState<SelectionCapture | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      setCapture(null);
      return;
    }

    function computeCapture(): SelectionCapture | null {
      const el = containerRef.current;
      if (!el) return null;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

      const text = selection.toString().trim();
      if (!text) return null;

      const range = selection.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return null;

      const anchorNode = range.commonAncestorContainer;
      const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
      const blockEl = anchorEl?.closest<HTMLElement>("[data-block-index]");
      if (!blockEl) return null;

      const blockIndex = Number(blockEl.dataset.blockIndex);
      if (Number.isNaN(blockIndex)) return null;

      return { text, blockIndex, rect: range.getBoundingClientRect() };
    }

    function handleSelectionEnd() {
      setCapture(computeCapture());
    }

    function handlePointerDown(event: MouseEvent) {
      // A fresh click/drag starting outside the article should clear any
      // showing "+ Note" affordance right away, rather than waiting on the
      // next selection to resolve. The toolbar button itself is a sibling
      // of the article container, not a descendant of it (it's positioned
      // fixed, not inline in the prose) -- without this exclusion, mousedown
      // firing before click would clear the capture (and unmount the
      // button) before its own onClick ever got to run.
      const el = containerRef.current;
      const target = event.target;
      if (!el || !(target instanceof Node)) return;
      if (el.contains(target)) return;
      if (target instanceof Element && target.closest("[data-notes-selection-toolbar]")) return;
      setCapture(null);
    }

    function handleScroll() {
      // The captured rect is a point-in-time viewport position -- rather
      // than tracking scroll to keep the floating button glued to text
      // that's now moved, just dismiss it. Re-selecting after scrolling is
      // a normal, cheap interaction; a stale button pointing at the wrong
      // spot is a worse one.
      setCapture(null);
    }

    container.addEventListener("mouseup", handleSelectionEnd);
    container.addEventListener("touchend", handleSelectionEnd);
    container.addEventListener("keyup", handleSelectionEnd);
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      container.removeEventListener("mouseup", handleSelectionEnd);
      container.removeEventListener("touchend", handleSelectionEnd);
      container.removeEventListener("keyup", handleSelectionEnd);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [containerRef, enabled]);

  return capture;
}
