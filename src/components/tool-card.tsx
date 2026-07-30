import Link from "next/link";

import type { ToolVisual } from "@/lib/tool-visuals";

type ToolCardProps = {
  href: string;
  title: string;
  mission: string;
  visual: ToolVisual;
};

// Matches CardLink's own bones exactly (border, surface, shadow, hover
// lift) rather than a distinct "photo card" treatment -- calculators have
// no cover photo. Color lives in exactly one small place: the ~44px icon
// chip, tinted per tool -- a full-card gradient wash turned out to be too
// much color at 10-cards-wide, but confining it to the chip keeps each
// tool's own color while the card itself stays as neutral as every other
// card on the site. Colors go through inline `style`, not Tailwind's
// `from-[...]` arbitrary-value classes, since Tailwind can't generate a
// utility class for a hex value that only exists as a runtime prop.
export function ToolCard({ href, title, mission, visual }: ToolCardProps) {
  const { icon: Icon, accentFrom, accentTo } = visual;
  const chipWash = `linear-gradient(135deg, ${accentFrom}26, ${accentTo}40)`;

  return (
    <Link
      href={href}
      className="group block rounded-card border border-white/10 bg-zinc-900 p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ backgroundImage: chipWash }}
      >
        {/* accentFrom, not accentTo -- accentTo is the darker stop in every
            pair (that's what makes the chip's gradient read as a gradient
            at all), and tinman-calculator's accentTo is Deep Navy (#172554),
            nearly black against the dark card. accentFrom is reliably the
            lighter stop across every tool, so it's the one safe choice for
            icon fill contrast. */}
        <Icon aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" style={{ color: accentFrom }} />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-300">{mission}</p>
      <span className="mt-4 inline-flex text-sm font-semibold text-zinc-300 transition group-hover:text-white">
        Open tool →
      </span>
    </Link>
  );
}
