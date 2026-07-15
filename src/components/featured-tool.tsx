import type { ReactNode } from "react";
import Link from "next/link";

export type FeaturedToolProps = {
  href: string;
  icon: ReactNode;
  // A short status pill ("New", "Updated", ...), not a section eyebrow --
  // set to undefined to omit it entirely for a tool that isn't new.
  badgeLabel?: string;
  title: string;
  description: string;
  ctaLabel: string;
  // Optional escape hatches for a future tool that has somewhere to send
  // "tell me more" clicks, or a screenshot to show -- neither exists for
  // the Environmental Calculator today, so both are omitted at the call
  // site rather than faked. Using `preview` will make the card taller than
  // this component's compact-by-default layout; that's an intentional
  // trade a future tool can opt into, not the baseline.
  secondaryHref?: string;
  secondaryLabel?: string;
  preview?: ReactNode;
  accentFrom?: string;
  accentTo?: string;
};

const DEFAULT_ACCENT_FROM = "#00F2FE"; // Electric Teal
const DEFAULT_ACCENT_TO = "#4FACFE"; // Oxygen Blue

// The homepage's "this is interactive software" card -- the deliberate
// counterpart to FeaturedEssay. Where that one stays flat, quiet, and
// text-only (a magazine article), this one gets an icon tile, a real
// button, and a bit of hover motion, so the two communicate "read this"
// vs. "use this" at a glance. Deliberately compact (a single scannable
// row, not a tall showcase) -- a homepage banner, per its own best-practice
// comment below, earns one glance and one action, not a pitch.
//
// Fully generic: nothing here names the Environmental Calculator. This
// slot is expected to hold a different tool later (a race predictor, an
// AI coach, whatever ships next) -- swapping it is just different props
// at the call site, not a new component.
//
// Accent colors go through inline `style`, not Tailwind's `from-[...]`
// arbitrary-value classes: Tailwind only generates CSS for class strings
// it can see literally in the source at build time, so a color passed in
// as a prop can never become a real utility class. Everything else
// (spacing, radius, motion) stays as ordinary Tailwind utilities; only
// the two color values themselves are computed at render time.
export function FeaturedTool({
  href,
  icon,
  badgeLabel = "New",
  title,
  description,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  preview,
  accentFrom = DEFAULT_ACCENT_FROM,
  accentTo = DEFAULT_ACCENT_TO,
}: FeaturedToolProps) {
  // Alpha baked into the hex values themselves (8-digit hex), not a
  // Tailwind opacity utility -- keeps the wash genuinely subtle at every
  // stage (base and hover are both low-alpha; only which layer is visible
  // changes) instead of ever rendering the raw, fully-saturated gradient.
  // High-contrast body text (zinc-900/zinc-600 on white, matching every
  // other card on the page) sits on top regardless, so this never touches
  // text legibility.
  const baseWash = `linear-gradient(135deg, ${accentFrom}0D, ${accentTo}1F)`;
  const hoverWash = `linear-gradient(135deg, ${accentFrom}1A, ${accentTo}33)`;
  const iconTint = `linear-gradient(135deg, ${accentFrom}26, ${accentTo}40)`;
  const badgeTint = `linear-gradient(135deg, ${accentFrom}1F, ${accentTo}33)`;
  const borderTint = `${accentFrom}26`;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-zinc-900 sm:p-7"
      style={{ borderColor: borderTint }}
    >
      {/* Invisible, full-bleed -- the whole card is one click target, same
          as FeaturedEssay's CardLink. Kept as its own element (rather than
          wrapping everything in <Link>) so an optional secondaryHref link
          below can still be independently clickable -- see that element's
          pointer-events-auto. */}
      <Link href={href} aria-label={title} className="absolute inset-0 z-0" />

      {/* Base wash, always faintly present; a second, stronger layer fades
          in on hover ("the gradient shifts slightly") -- pure CSS, no JS. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: baseWash }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: hoverWash }}
      />

      {/* pointer-events-none so clicks on any of this visible content fall
          through to the full-bleed Link above -- text and icons aren't
          interactive elements, so without this a click would land on this
          div and do nothing instead of navigating. One row on larger
          screens (icon+copy left, CTA right) is what keeps this short;
          it only wraps to stacked on narrow screens. */}
      <div className="relative z-[1] pointer-events-none flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300 group-hover:-translate-y-0.5"
            style={{ backgroundImage: iconTint }}
          >
            {icon}
          </div>
          <div>
            {badgeLabel ? (
              <span
                aria-label={`${badgeLabel} feature`}
                className="inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-700 uppercase dark:text-zinc-200"
                style={{ backgroundImage: badgeTint }}
              >
                {badgeLabel}
              </span>
            ) : null}
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl dark:text-white">
              {title}
            </h3>
            <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
            {preview ? <div className="mt-4 max-w-md">{preview}</div> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 pl-[60px] sm:pl-0">
          <span className="inline-flex items-center gap-2 rounded-pill bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-300 group-hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:group-hover:bg-zinc-200">
            {ctaLabel}
            <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </span>

          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="pointer-events-auto relative z-10 text-sm font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-zinc-300 dark:decoration-white/30 dark:hover:decoration-white/70"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
