"use client";

import { useEffect, useRef, useState } from "react";

const DEEP_SCROLL_THRESHOLD = 0.75;

type ReadingProgressBarProps = {
  targetId: string;
  // Fired once, the moment this component actually mounts client-side (a
  // real visit -- never a server-rendered prefetch, since nothing here
  // runs until hydration). The "first topic engagement" learning signal.
  onView?: () => unknown;
  // Fired at most once per mount, the first time progress crosses
  // DEEP_SCROLL_THRESHOLD -- the "deep engagement" learning signal (see
  // src/app/learning-actions.ts). Optional: most call sites of this
  // component aren't a recognized learning Topic, so most don't pass one.
  onDeepScroll?: () => unknown;
  // Concept-breadth signal: real in-page heading anchors for this topic's
  // curated Concepts (see src/lib/mastery/concept-anchors.ts). Reuses this
  // same scroll effect rather than a second tracker -- each anchor fires
  // onConceptSeen(slug) at most once per mount, the first time its heading
  // passes the vertical midpoint of the viewport (a real "the reader has
  // reached this heading" signal, not just "it's technically on screen").
  conceptAnchors?: { slug: string; anchorId: string }[];
  onConceptSeen?: (conceptSlug: string) => unknown;
};

// Tracks progress through a specific article container (by id), not the
// whole document -- so the header and footer don't skew the percentage.
export function ReadingProgressBar({
  targetId,
  onView,
  onDeepScroll,
  conceptAnchors,
  onConceptSeen,
}: ReadingProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const deepScrollFiredRef = useRef(false);
  const conceptsSeenRef = useRef<Set<string>>(new Set());

  // Separate from the scroll-tracking effect below on purpose -- this
  // should fire exactly once per mount regardless of targetId/onDeepScroll
  // identity, not re-fire if either of those props changes.
  useEffect(() => {
    onView?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire-once-on-mount is intentional, see comment above
  }, []);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    let ticking = false;

    const update = () => {
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollableDistance = rect.height - viewportHeight;
      const scrolledPastTop = -rect.top;

      const pct =
        scrollableDistance <= 0
          ? scrolledPastTop > 0
            ? 1
            : 0
          : scrolledPastTop / scrollableDistance;

      const clamped = Math.min(1, Math.max(0, pct));
      setProgress(clamped);

      if (!deepScrollFiredRef.current && clamped >= DEEP_SCROLL_THRESHOLD) {
        deepScrollFiredRef.current = true;
        onDeepScroll?.();
      }

      if (conceptAnchors && onConceptSeen) {
        for (const anchor of conceptAnchors) {
          if (conceptsSeenRef.current.has(anchor.slug)) continue;
          const el = document.getElementById(anchor.anchorId);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= viewportHeight / 2) {
            conceptsSeenRef.current.add(anchor.slug);
            onConceptSeen(anchor.slug);
          }
        }
      }

      ticking = false;
    };

    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [targetId, onDeepScroll, conceptAnchors, onConceptSeen]);

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[var(--z-toast)] h-[3px]">
      <div
        className="h-full bg-zinc-900 transition-[width] duration-150 ease-out dark:bg-white"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
