// Read-only visual for "how does the wind relate to my direction of
// travel" -- reuses the same visual grammar as WindCompass's "wind"
// variant (a fixed runner-forward marker plus a rotating flow arrow
// through a HEAD/CROSS/TAIL ring) but without drag interaction, since
// this is displaying an already-resolved angle rather than collecting
// one. Lets a user see "headwind" or "tailwind" at a glance instead of
// mentally comparing two separate compass bearings ("wind blows from
// SSW (213°)" vs. "you run toward N (0°)").

import { classifyWindAngle } from "@/lib/wind-physics";

type WindRelativeIndicatorProps = {
  /** 0deg = direct headwind, 180deg = direct tailwind -- matches relativeAngleFromTrueBearing's output convention exactly, so callers can pass that straight through. */
  relativeAngleDeg: number;
};

export function WindRelativeIndicator({ relativeAngleDeg }: WindRelativeIndicatorProps) {
  const windType = classifyWindAngle(relativeAngleDeg);
  const rad = (relativeAngleDeg * Math.PI) / 180;
  // cos(0) = 1 (pure headwind), cos(180) = -1 (pure tailwind), cos(90) = 0
  // (pure crosswind) -- a simple, honest read of "how much of this wind
  // is actually working against/with you" rather than just a category.
  const alignmentPct = Math.round(Math.cos(rad) * 100);
  const label =
    windType === "headwind"
      ? `${Math.abs(alignmentPct)}% Headwind`
      : windType === "tailwind"
        ? `${Math.abs(alignmentPct)}% Tailwind`
        : "Mostly Crosswind";

  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-16 shrink-0" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          <circle
            cx="50"
            cy="50"
            r="36"
            className="fill-white stroke-black/10 dark:fill-zinc-900 dark:stroke-white/10"
            strokeWidth="1.5"
          />
          <text x="50" y="9" textAnchor="middle" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            HEAD
          </text>
          <text x="92" y="53" textAnchor="end" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            CROSS
          </text>
          <text x="50" y="97" textAnchor="middle" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            TAIL
          </text>
          <text x="8" y="53" textAnchor="start" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            CROSS
          </text>

          {/* Fixed marker: always points up, representing the runner's own direction of travel. */}
          <path d="M 50 41 L 45 51 L 55 51 Z" className="fill-zinc-400 dark:fill-zinc-500" />
          <line x1="50" y1="51" x2="50" y2="58" strokeWidth="2" className="stroke-zinc-400 dark:stroke-zinc-500" />

          {/* Rotating flow arrow: where the wind comes from, through to where it blows toward. */}
          <g style={{ transform: `rotate(${relativeAngleDeg}deg)`, transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="16" r="4.5" className="fill-accent-tip" />
            <line x1="50" y1="20.5" x2="50" y2="76" strokeWidth="2.5" strokeLinecap="round" className="stroke-accent-tip" />
            <path d="M 50 86 L 44.5 74 L 55.5 74 Z" className="fill-accent-tip" />
          </g>
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{label}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-300">Relative to your direction of travel</p>
      </div>
    </div>
  );
}
