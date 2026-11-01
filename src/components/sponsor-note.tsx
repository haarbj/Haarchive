"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Trailing "!" is part of the code itself, not punctuation -- never drop it.
// It's also literally part of the discount-link path below (Shopify-style
// /discount/<code> URL), not just the fallback copy.
const SPONSOR_CODE = "Cardemore123!";
const SHOP_URL =
  "https://www.cruoptics.com/discount/Cardemore123!?redirect=/products/traverse-sunglasses?variant=44639210602584";

// A clearly-labeled sponsor note, not a banner ad -- reuses the site's own
// Card/Badge/Button primitives (CLAUDE.md §7) instead of inventing a new ad
// style. Which pages render this is decided entirely by SPONSOR_NOTE_SLUGS
// (sponsor-note-slugs.ts), not by this component.
export function SponsorNote() {
  const textRef = useRef<HTMLDivElement>(null);
  const [textHeight, setTextHeight] = useState<number | null>(null);

  // CSS alone can't reliably do "match a sibling's height, derive width from
  // the photo's own aspect ratio": a flex item with align-items: stretch
  // resolves its cross size (height) only *after* its main size (width) is
  // already determined via flex-basis, so the width never gets re-derived
  // from the stretched height -- confirmed empirically (a prior version
  // rendered 220x326, a 0.675 ratio, next to the photo's real 0.75,
  // visibly stretched). Measuring the text column's real height and
  // applying it as a plain pixel height is unambiguous: with height a
  // concrete px value (not a percentage or a flex computation) and width
  // left unset, the browser derives width purely from the image's own
  // aspect-ratio, every time.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setTextHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    // A quiet card spanning the full content column (no max-width cap). On
    // mobile the (uncropped) photo stacks above the text at a fixed,
    // moderate width; from sm: up it sits beside the text at the measured
    // text-column height (see textHeight above), width following
    // automatically from the photo's own aspect ratio -- never cropped,
    // never distorted, never both axes set at once.
    <Card padding="md" className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      {/* Fixed-width reservation (static per breakpoint, never derived from
          the image's own rendered size) -- this is what keeps the text
          column's own width, and therefore its wrapped height, independent
          of the image. Deriving the image's height from the *live* text
          column while the text column's width also depended on the
          image's *live* width created a real feedback loop (confirmed:
          image height ballooned to 2000+px at one breakpoint). With a
          static reservation here, the text column's height is stable, so
          measuring it once and applying that as the image's height has
          nothing left to feed back into.
          The per-breakpoint values (sm/lg/xl) are tuned to sit close to
          this component's own fixed copy's actual wrapped-text-driven
          image width at each breakpoint (empirically measured), not just
          one generic value -- a reservation much wider than the image's
          real rendered width is what reads as oversized left padding
          (object-contain/max-w-full below are only the safety net for
          the breakpoints where the reservation is still slightly
          generous, never the primary sizing mechanism). */}
      <div className="flex w-60 shrink-0 justify-center sm:w-56 sm:justify-end lg:w-[204px] xl:w-[183px]">
        <Image
          src="/sponsors/cru-optics-traverse-brody.jpg"
          alt="Brody wearing CRÜ Optics Traverse sunglasses on a run."
          width={2316}
          height={3088}
          sizes="224px"
          className="h-auto max-w-full rounded-control object-contain max-sm:!h-auto max-sm:!w-60 sm:w-auto"
          style={textHeight ? { height: textHeight, width: "auto" } : undefined}
        />
      </div>
      <div ref={textRef} className="min-w-0 flex-1">
        <Badge tone="neutral">SPONSORED</Badge>
        <p className="mt-3 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          I&rsquo;ve always been known for wearing sunglasses during my runs and races. It started
          when I began running, and at this point, I rarely run without them.
        </p>
        <p className="mt-3 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          These days, I wear the CRÜ Optics Traverse on just about every run, even in the rain.
          They&rsquo;re easily the best running sunglasses I&rsquo;ve owned: lightweight, comfortable,
          adjustable, stay put, and honestly look great too.
        </p>
        <div className="mt-4">
          <Button href={SHOP_URL} variant="outline">
            Shop CRÜ
          </Button>
        </div>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          15% off applies automatically, or enter code {SPONSOR_CODE} at checkout.
        </p>
      </div>
    </Card>
  );
}
