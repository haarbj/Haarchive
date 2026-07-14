import { REP_SEGMENTS, type RepType } from "@/lib/track-wind-physics";

type TrackDiagramProps = {
  repType: RepType;
};

const ACTIVE_CLASS = "stroke-accent-tip";
const INACTIVE_CLASS = "stroke-black/10 dark:stroke-white/10";

// Illustrative only (matches the original calculator's own disclaimer about
// compass directions) -- a simple oval standing in for a real 400m track,
// with each of the four segments a rep can cover colored in only if this
// rep type actually includes it. Lets a reader see at a glance, e.g., that
// a 600m skips one full backstretch while a 600m-alt skips one full
// homestretch instead.
export function TrackDiagram({ repType }: TrackDiagramProps) {
  const rep = REP_SEGMENTS[repType];

  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full max-w-[220px]" aria-hidden="true">
      <path
        d="M60,100 A40,40 0 0 1 60,20"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        className={rep.firstCurveLaps > 0 ? ACTIVE_CLASS : INACTIVE_CLASS}
      />
      <path
        d="M60,20 H180"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        className={rep.backstretchLaps > 0 ? ACTIVE_CLASS : INACTIVE_CLASS}
      />
      <path
        d="M180,20 A40,40 0 0 1 180,100"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        className={rep.secondCurveLaps > 0 ? ACTIVE_CLASS : INACTIVE_CLASS}
      />
      <path
        d="M180,100 H60"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        className={rep.homestretchLaps > 0 ? ACTIVE_CLASS : INACTIVE_CLASS}
      />

      <text x="20" y="63" textAnchor="middle" className="fill-zinc-500 text-[9px] dark:fill-zinc-400">
        1st curve
      </text>
      <text x="120" y="14" textAnchor="middle" className="fill-zinc-500 text-[9px] dark:fill-zinc-400">
        backstretch
      </text>
      <text x="220" y="63" textAnchor="middle" className="fill-zinc-500 text-[9px] dark:fill-zinc-400">
        2nd curve
      </text>
      <text x="120" y="112" textAnchor="middle" className="fill-zinc-500 text-[9px] dark:fill-zinc-400">
        homestretch
      </text>
    </svg>
  );
}
