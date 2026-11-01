import Image from "next/image";

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
  return (
    // A quiet, compact card. On mobile the (uncropped) photo stacks above
    // the text at a fixed, moderate width. From sm: up it sits beside the
    // text with items-stretch (set explicitly, not just relying on the
    // flex default) so the image's rendered height matches the text
    // column's height, with its width following automatically from the
    // photo's own aspect ratio -- never cropped, never distorted.
    <Card
      padding="md"
      className="flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:gap-6"
    >
      <Image
        src="/sponsors/cru-optics-traverse-brody.jpg"
        alt="Brody wearing CRÜ Optics Traverse sunglasses on a run."
        width={2316}
        height={3088}
        sizes="(min-width: 640px) 220px, 240px"
        className="h-auto w-60 shrink-0 rounded-control sm:h-auto sm:w-auto"
      />
      <div className="min-w-0 flex-1">
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
