import type { ReactNode } from "react";
import { PenTool } from "lucide-react";

import { ASPECT_CLASSES, type ImageSlotAspect } from "@/components/ui/image-slot";

type DiagramProps = {
  // The actual inline SVG (or any markup), omitted entirely until the
  // diagram is drawn -- see the placeholder below for what belongs here.
  // Per the visual system doc: thin line art (~1.25-1.5px stroke), one
  // accent color via the site's own --accent-* custom properties (e.g.
  // stroke="var(--accent-research)"), no fills/gradients/3D. A hand-authored
  // <svg> here has zero asset weight and inherits dark mode for free --
  // that's the whole reason this is a separate component from ImageSlot
  // rather than another `kind`, which is built around loading a raster
  // file through next/image.
  children?: ReactNode;
  alt: string;
  aspect?: ImageSlotAspect;
  // Dev-facing guidance, shown only when no children are provided yet.
  label?: string;
  className?: string;
};

export function Diagram({ children, alt, aspect = "video", label, className = "" }: DiagramProps) {
  const aspectClass = ASPECT_CLASSES[aspect];

  if (!children) {
    return (
      // Same placeholder language as ImageSlot's own (dashed border, muted
      // icon, aspect-locked via an absolutely-positioned text layer so the
      // guidance copy can never stretch the box) -- a diagram slot should
      // look like a sibling of a photo slot while empty, even though once
      // filled it renders completely differently (inline markup, not
      // next/image).
      <div
        aria-hidden="true"
        className={`relative overflow-hidden rounded-card border border-dashed border-white/15 bg-zinc-900/50 ${aspectClass} ${className}`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
          <PenTool strokeWidth={1.25} className="h-7 w-7 shrink-0 text-zinc-600" />
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">Diagram needed</p>
            {label ? <p className="mt-1.5 max-w-[32ch] text-sm text-zinc-400">{label}</p> : null}
            <p className="mt-2 max-w-[32ch] text-xs text-zinc-600 italic">alt: &ldquo;{alt}&rdquo;</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex items-center justify-center overflow-hidden rounded-card bg-zinc-950 p-6 ${aspectClass} ${className}`}
    >
      {children}
    </div>
  );
}
