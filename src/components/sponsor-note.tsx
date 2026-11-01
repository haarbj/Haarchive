"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ImageSlot } from "@/components/ui/image-slot";
import { textLinkClass } from "@/components/ui/text-link";

// Trailing "!" is part of the code itself, not punctuation -- never drop it.
const SPONSOR_CODE = "Cardemore123!";

// Same async-clipboard-first, textarea/execCommand-fallback pattern as
// environmental-calculator.tsx's CopyLinkButton -- there's no shared
// clipboard component yet, so this mirrors that one rather than inventing
// a third approach.
function fallbackCopy(text: string, onSuccess: () => void) {
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
    onSuccess();
  } catch {
    // Nothing more to fall back to -- the code is still visible to copy by hand.
  } finally {
    document.body.removeChild(textarea);
  }
}

function CopyCodeButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const showConfirmation = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(SPONSOR_CODE)
        .then(showConfirmation)
        .catch(() => fallbackCopy(SPONSOR_CODE, showConfirmation));
    } else {
      fallbackCopy(SPONSOR_CODE, showConfirmation);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy discount code ${SPONSOR_CODE}`}
      className="mt-3 inline-flex items-center gap-2 rounded-control border border-black/10 bg-zinc-50 px-3 py-1.5 font-mono text-sm font-semibold text-zinc-900 transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-white dark:focus:ring-white dark:hover:border-white/20"
    >
      {SPONSOR_CODE}
      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

// A clearly-labeled sponsor note, not a banner ad -- reuses the site's own
// Card/Badge/ImageSlot/textLinkClass primitives (CLAUDE.md §7) instead of
// inventing a new ad style. Which pages render this is decided entirely by
// SPONSOR_NOTE_SLUGS (sponsor-note-slugs.ts), not by this component.
export function SponsorNote() {
  return (
    // A quiet, compact card -- a small fixed-size thumbnail next to the
    // text, never a large feature image. flex-row at every width (not
    // stacked on mobile) so the thumbnail stays small and the card's
    // height is always set by the text column, not the photo.
    <Card padding="md" className="flex flex-row items-start gap-4 sm:gap-6">
      <div className="w-20 shrink-0 sm:w-36">
        <ImageSlot
          src="/sponsors/cru-optics-traverse-brody.jpg"
          kind="photo"
          aspect="square"
          alt="Brody wearing CRÜ Optics Traverse sunglasses on a run."
          label="Close-up selfie of Brody wearing the CRÜ Optics Traverse sunglasses on a run (source file: IMG_5071.JPG)."
          // Portrait source (2316x3088) cropped to the square slot -- biased
          // toward the top so the sunglasses/cap stay in frame instead of
          // object-cover's default center crop pulling in more of the torso.
          objectPosition="50% 12%"
          className="rounded-control"
          sizes="144px"
        />
      </div>
      <div className="min-w-0 flex-1">
        <Badge tone="neutral">SPONSORED</Badge>
        <p className="mt-3 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          I&rsquo;ve always been known for wearing sunglasses during my runs and races. That started in
          high school. These days I wear CRÜ Optics&rsquo; Traverse on every run, even in the rain.
          They&rsquo;re the best running sunglasses I&rsquo;ve owned, and they look great too.
        </p>
        <p className="mt-3 text-base leading-7 text-zinc-700 dark:text-zinc-300">
          Take 15% off at checkout with code {SPONSOR_CODE}
        </p>
        <CopyCodeButton />
        <div className="mt-4">
          <a
            href="https://www.cruoptics.com/products/traverse-sunglasses?variant=44639210602584"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`font-semibold text-zinc-900 dark:text-white ${textLinkClass}`}
          >
            Shop CRÜ
          </a>
        </div>
      </div>
    </Card>
  );
}
