import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { AppWindow, Camera, NotebookPen, PenTool, UserRound } from "lucide-react";

export type ImageSlotKind = "photo" | "portrait" | "diagram" | "screenshot" | "archival";

const KIND_ICONS: Record<ImageSlotKind, LucideIcon> = {
  photo: Camera,
  portrait: UserRound,
  diagram: PenTool,
  screenshot: AppWindow,
  // A found/historical artifact (a notebook page, a handwritten workout, a
  // physiology sketch) -- distinct from `diagram` (this site's own,
  // originally-drawn illustration) and `photo` (a modern photograph).
  archival: NotebookPen,
};

const KIND_LABELS: Record<ImageSlotKind, string> = {
  photo: "Photo",
  portrait: "Portrait",
  diagram: "Diagram",
  screenshot: "Screenshot",
  archival: "Archival material",
};

export type ImageSlotAspect = "video" | "portrait" | "square" | "wide";

// video (16:9) matches the article/tool card convention already used
// elsewhere; portrait and square cover a founder/coach photo; wide is for
// a full-bleed section break, should one ever earn its place. Exported so
// Diagram (a separate component for hand-authored inline SVG, not a file
// through this one) can share the exact same aspect-ratio scale.
export const ASPECT_CLASSES: Record<ImageSlotAspect, string> = {
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  wide: "aspect-[21/9]",
};

// Per the visual system's border rule: a screenshot or archival scan
// usually has its own busy/light internal background and needs a hairline
// edge to read as a distinct image against the page; a photo, portrait, or
// diagram usually has enough natural contrast against the dark ground on
// its own. Still overridable per call site via the `bordered` prop below.
const KIND_BORDERED_BY_DEFAULT: Record<ImageSlotKind, boolean> = {
  photo: false,
  portrait: false,
  diagram: false,
  screenshot: true,
  archival: true,
};

type ImageSlotProps = {
  // Root-relative path under /public (e.g. "/homepage/founder-portrait.jpg").
  // Omit entirely until the real asset exists -- see the placeholder
  // rendered below for exactly what belongs here and why.
  src?: string;
  // Required even before `src` exists, on purpose: writing real alt text
  // is part of deciding what the image should actually show, not a
  // finishing touch bolted on once the file lands. Shown inside the
  // placeholder so it stays visible (and honest) while it's still just a
  // plan.
  alt: string;
  kind: ImageSlotKind;
  aspect?: ImageSlotAspect;
  // Dev-facing production guidance, shown only in the placeholder --
  // what to shoot/draw and in what style, specific enough that whoever
  // sources the asset doesn't have to come ask. Never rendered once a
  // real `src` is provided.
  label: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  // For avatar/thumbnail-scale slots (a timeline-progression photo, e.g.)
  // where there's no room to show the full label/alt text without it
  // turning into an illegible scroll of tiny type -- icon and a short
  // label only. The full guidance still lives in the code comment at the
  // call site and in public/homepage/README.md; this isn't the only place
  // it's written down.
  compact?: boolean;
  // Overrides the generic kind label ("Photo") shown in compact mode --
  // for a run of several small thumbnails (the My Story progression) that
  // each need their own short identifier ("Brophy", "Run22", ...), not
  // the same generic word repeated five times.
  compactLabel?: string;
  // Overrides KIND_BORDERED_BY_DEFAULT for this one call site -- most
  // slots should just take the kind's default rather than deciding this
  // per instance.
  bordered?: boolean;
  // CSS object-position (e.g. "50% 30%"), for when the subject isn't
  // centered in the source photo and object-cover's default 50%/50% crops
  // off the wrong part -- shifting this is cheaper than re-cropping the
  // source file itself. Defaults to center, i.e. plain object-cover.
  objectPosition?: string;
  // "cover" (default) fills the aspect box exactly, cropping whichever
  // edge doesn't match -- fine for a photo with room to spare at the
  // edges, wrong for anything where every edge is real content (a full
  // page of handwriting, a UI screenshot, a stack of books each with a
  // legible title). "contain" scales the whole image to fit inside a
  // still-fixed-shape box, letterboxed on whichever axis doesn't match --
  // no crop, but still not the image's own real proportions.
  fit?: "cover" | "contain";
  // The real, honest fix for "every edge is real content": don't force
  // any box shape at all. Pass the source file's actual pixel dimensions
  // and the image renders at its own natural aspect ratio, scaled to fill
  // the available width -- no crop, no letterboxing, no forced shape.
  // `aspect` and `fit` are ignored for the real-image render when this is
  // set (the empty-state placeholder still needs *a* box shape to reserve
  // space before the real dimensions are known, so it keeps using `aspect`).
  naturalSize?: { width: number; height: number };
};

// The one component every future homepage image goes through. Layout,
// aspect ratio, and responsive sizing are already correct and final --
// adding the real asset later is a one-line change (pass `src`), not a
// layout job. Until then this renders a clearly-labeled scaffold, not a
// broken image or a stock placeholder photo, so the page's actual visual
// rhythm (spacing, proportions, where the eye lands) is honest right now,
// not just promised. See about-page.tsx's own comments for the specific
// asset manifest this backs -- exact file path, dimensions, and content
// per slot.
//
// Local assets only (a path under /public) -- next.config.ts has no
// images.remotePatterns configured, so next/image only works unconfigured
// for local files today. That's fine for curated homepage imagery (a
// founder photo, a diagram, a coach portrait all ship with the codebase
// like public/coaches/tom-schwartz.jpg already does), but is not the
// right component for arbitrary user-uploaded URLs -- those still go
// through a plain <img> with the eslint-disable-next-line convention
// already used in article-hero.tsx and the article/tool cards.
export function ImageSlot({
  src,
  alt,
  kind,
  aspect = "video",
  label,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  className = "",
  compact = false,
  compactLabel,
  bordered,
  objectPosition,
  fit = "cover",
  naturalSize,
}: ImageSlotProps) {
  const aspectClass = ASPECT_CLASSES[aspect];
  const isBordered = bordered ?? KIND_BORDERED_BY_DEFAULT[kind];

  if (!src) {
    const Icon = KIND_ICONS[kind];
    return (
      // The aspect ratio has to hold exactly, even here -- the whole point
      // of reserving this box now is that the real image drops in later
      // without the surrounding spacing jumping. The guidance text below is
      // real content (a label plus a full alt string), long enough to
      // overflow a small portrait/square slot's aspect-locked height if it
      // sat in normal flow -- the exact "in-flow child stretches an
      // aspect-ratio container" bug already hit twice elsewhere on this
      // site (article-hero.tsx, the article preview card). Fix is the
      // same: make the text absolutely positioned so it can never affect
      // this div's own size, with its own scroll for the rare case a slot
      // is too small to show all of it at once.
      <div
        aria-hidden="true"
        className={`relative overflow-hidden rounded-card border border-dashed border-white/15 bg-zinc-900/50 ${aspectClass} ${className}`}
      >
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center text-center ${
            compact ? "gap-1.5 p-2" : "gap-3 overflow-y-auto p-6"
          }`}
        >
          <Icon strokeWidth={1.25} className={compact ? "h-4 w-4 shrink-0 text-zinc-600" : "h-7 w-7 shrink-0 text-zinc-600"} />
          {compact ? (
            <p className="text-[9px] leading-tight font-semibold tracking-[0.1em] text-zinc-500 uppercase">
              {compactLabel ?? KIND_LABELS[kind]}
            </p>
          ) : (
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
                {KIND_LABELS[kind]} needed
              </p>
              <p className="mt-1.5 max-w-[32ch] text-sm text-zinc-400">{label}</p>
              <p className="mt-2 max-w-[32ch] text-xs text-zinc-600 italic">alt: &ldquo;{alt}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (naturalSize) {
    // No `fill`, no forced aspect box -- explicit width/height (the
    // source's real pixel dimensions) let next/image compute the correct
    // ratio, and h-auto/w-full scale it responsively while preserving
    // that ratio exactly. The box takes the image's own shape instead of
    // the other way around.
    return (
      <div className={`overflow-hidden rounded-card ${isBordered ? "border border-white/10" : ""} ${className}`}>
        <Image
          src={src}
          alt={alt}
          width={naturalSize.width}
          height={naturalSize.height}
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="h-auto w-full"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-card ${fit === "contain" ? "bg-zinc-950" : ""} ${isBordered ? "border border-white/10" : ""} ${aspectClass} ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className={fit === "contain" ? "object-contain" : "object-cover"}
        style={objectPosition ? { objectPosition } : undefined}
      />
    </div>
  );
}
