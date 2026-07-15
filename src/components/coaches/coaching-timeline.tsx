import Link from "next/link";

import type { Coach } from "@/lib/coaches/types";

const SCALE_START = 1950;
const SCALE_END = 2030;
const CURRENT_YEAR = 2026;
const DECADE_MARKS = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030];

function percent(year: number): number {
  return ((year - SCALE_START) / (SCALE_END - SCALE_START)) * 100;
}

// Horizontal bars over one shared year axis, not isolated per-decade dots --
// the point is showing which philosophies were actually active at the same
// time (and for how long), since "evolution of ideas" is a story about
// overlapping eras and direct influence, not a single-file sequence of
// disconnected decades. Sorted by start year so the visual cascade roughly
// follows the real order these systems emerged in.
export function CoachingTimeline({ coaches }: { coaches: Coach[] }) {
  const sorted = [...coaches].sort((a, b) => a.activeYears.start - b.activeYears.start);

  return (
    <div className="mt-8 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="relative h-6 border-b border-black/10 dark:border-white/10">
          {DECADE_MARKS.map((year) => (
            <span
              key={year}
              className="absolute top-0 -translate-x-1/2 text-xs text-zinc-400 dark:text-zinc-500"
              style={{ left: `${percent(year)}%` }}
            >
              {year}
            </span>
          ))}
        </div>

        <div className="mt-2 space-y-3">
          {sorted.map((coach) => {
            const end = coach.activeYears.end ?? CURRENT_YEAR;
            const left = percent(coach.activeYears.start);
            const width = percent(end) - left;
            return (
              <div key={coach.slug} className="relative h-9">
                {/* Faint gridlines at each decade, behind every bar. */}
                {DECADE_MARKS.map((year) => (
                  <span
                    key={year}
                    aria-hidden="true"
                    className="absolute top-0 h-full w-px bg-black/5 dark:bg-white/10"
                    style={{ left: `${percent(year)}%` }}
                  />
                ))}
                <Link
                  href={`/coaching-library/${coach.slug}`}
                  className="group absolute top-0 flex h-full items-center overflow-hidden rounded-full bg-zinc-900 px-3 transition hover:bg-zinc-700 dark:bg-white dark:hover:bg-zinc-200"
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: "6rem" }}
                >
                  <span className="truncate text-xs font-semibold whitespace-nowrap text-white dark:text-zinc-900">
                    {coach.name}
                    {coach.shortName ? ` (${coach.shortName})` : ""}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
