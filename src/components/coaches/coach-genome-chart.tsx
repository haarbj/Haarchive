import { GENOME_CATEGORIES } from "@/lib/coaches/genome";
import type { CoachGenome } from "@/lib/coaches/types";

type CoachGenomeChartProps = {
  genome: CoachGenome;
  // Compact mode drops the numeric value and tightens spacing, for use
  // inside a directory card where the full chart would be too tall.
  compact?: boolean;
};

// The "Coach Genome" -- ten fixed categories, always in the same order (see
// genome.ts), rendered as horizontal bars. Deliberately not a radar/spider
// chart: a bar's length is legible at a glance and compares cleanly across
// two side-by-side instances of this same component, where a radar chart's
// rotated axes make that comparison much harder to read quickly.
//
// Each row's `title` attribute surfaces GENOME_CATEGORIES' own description
// on hover/focus -- a native tooltip, not a custom popover, so it works for
// keyboard and touch users without extra JS. `tabIndex=0` makes a bare
// non-interactive div focusable specifically so the tooltip (and any future
// richer explanation) is reachable without a mouse.
export function CoachGenomeChart({ genome, compact = false }: CoachGenomeChartProps) {
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {GENOME_CATEGORIES.map(({ key, label, description }) => {
        const value = genome[key];
        return (
          <div
            key={key}
            tabIndex={0}
            title={description}
            className="flex items-center gap-3 rounded-md transition hover:bg-black/[0.03] focus:bg-black/[0.03] focus:outline-none dark:hover:bg-white/[0.04] dark:focus:bg-white/[0.04]"
          >
            <span
              className={`shrink-0 text-zinc-600 dark:text-zinc-300 ${
                compact ? "w-28 text-[11px]" : "w-36 text-xs font-medium"
              }`}
            >
              {label}
            </span>
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
              role="img"
              aria-label={`${label}: ${value} out of 100 -- ${description}`}
            >
              <div
                className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 dark:bg-white"
                style={{ width: `${value}%` }}
              />
            </div>
            {compact ? null : (
              <span className="w-7 shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">{value}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
