"use client";

import { useEffect, useState } from "react";

// Tracks progress through a specific article container (by id), not the
// whole document -- so the header and footer don't skew the percentage.
export function ReadingProgressBar({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0);

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

      setProgress(Math.min(1, Math.max(0, pct)));
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
  }, [targetId]);

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[var(--z-toast)] h-[3px]">
      <div
        className="h-full bg-zinc-900 transition-[width] duration-150 ease-out dark:bg-white"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
