import Link from "next/link";

import { formatDate, formatMiles } from "@/lib/format";
import { getPhaseForWeek, type TrainingPhase } from "@/lib/private-coaching/training-phases";
import { WeekCopyPasteControls } from "./week-copy-paste-controls";
import type { WeekSummary } from "./calendar-data";

// Surrounding-week context for Week View -- deliberately NOT another full
// interactive WeekCalendar (no drag/edit, no full WorkoutCards), but
// genuinely informative rather than a strip of status dots: a real
// per-day prescription summary and the week's own planned total, enough
// that a coach can recognize the training pattern at a glance. Read-only
// except for the Copy/Paste controls it hosts, which target THIS week
// specifically regardless of which week the page itself is centered on.
export function WeekStrip({
  athleteId,
  pageWeek,
  weekStart,
  weekEnd,
  summary,
  phases,
  copiedWeek,
  label,
}: {
  athleteId: string;
  pageWeek: string;
  weekStart: string;
  weekEnd: string;
  summary: WeekSummary;
  phases: TrainingPhase[];
  copiedWeek: string | null;
  label: "Previous week" | "Next week";
}) {
  const phase = getPhaseForWeek(phases, weekStart);

  return (
    <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
            {phase ? ` · ${phase.phaseType.toUpperCase()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`?view=week&week=${weekStart}`}
            className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
          >
            View Week
          </Link>
          <WeekCopyPasteControls athleteId={athleteId} baseParams={{ view: "week", week: pageWeek }} week={weekStart} copiedWeek={copiedWeek} />
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{summary.days.map((d) => d.label).join(" · ")}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatMiles(summary.totalDistanceM)} planned</p>
    </div>
  );
}
