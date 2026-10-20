import type { PatternSeries, PatternWeek, TrendDirection } from "@/lib/private-coaching/pattern-view";
import { formatMiles, formatDate } from "@/lib/format";

// Wetmore's principle, rendered: never judge training by a single
// workout, judge the trend. Six weeks of numbers and a plain-language
// direction word next to each row -- no score, no color-coded good/bad,
// no recommendation. Adaptation cards own "what to do about it"; this is
// only the lens.
//
// The one component behind both the coach's athlete-detail "Patterns"
// section and the athlete's own /plan -- a pure render of an already-
// computed PatternSeries (pattern-view-data.ts's loadPatternViewData),
// so the two surfaces can't drift apart on what number they show.
//
// No charting library exists in this codebase (the Course Comparator
// hand-built its own SVG for the same reason) -- this is plainer still:
// a number per week plus a thin, unscaled-by-judgment bar, the same
// hairline-bordered, text-zinc visual language the roster and weekly-
// load footers already use.

const TREND_LABEL: Record<TrendDirection, string> = {
  rising: "rising",
  falling: "falling",
  steady: "steady",
  "insufficient-data": "not enough data yet",
};

function WeekHeader({ week }: { week: PatternWeek }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{formatDate(week.weekStart)}</p>
      {week.isCurrent ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">in progress</p>
      ) : week.isGap ? (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">no program</p>
      ) : null}
    </div>
  );
}

// `background` (when given) renders as a lighter full-width bar behind
// the main one -- the scheduled-vs-completed row's own way of showing
// both figures in one bar without a second chart type: completed is
// always <= scheduled's bar underneath it, never a separate color
// judgment, just "how much of the lighter bar got covered."
function Bar({ value, background, max }: { value: number | null; background?: number | null; max: number }) {
  const pct = (v: number | null) => (v != null && max > 0 ? Math.max(v > 0 ? 4 : 0, Math.min(100, (v / max) * 100)) : 0);
  return (
    <div className="relative mt-1 h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10">
      {background != null ? (
        <div className="absolute inset-y-0 left-0 rounded-full bg-zinc-300 dark:bg-zinc-600" style={{ width: `${pct(background)}%` }} />
      ) : null}
      {value != null ? (
        <div className="absolute inset-y-0 left-0 rounded-full bg-zinc-500 dark:bg-zinc-400" style={{ width: `${pct(value)}%` }} />
      ) : null}
    </div>
  );
}

function SeriesRow({
  label,
  weeks,
  trend,
  value,
  background,
  format,
}: {
  label: string;
  weeks: PatternWeek[];
  trend: TrendDirection;
  value: (week: PatternWeek) => number | null;
  /** A second, lighter-bar figure behind the main one -- e.g. scheduled mileage behind completed. */
  background?: (week: PatternWeek) => number | null;
  format: (value: number) => string;
}) {
  const values = weeks.map(value);
  const backgrounds = background ? weeks.map(background) : null;
  const max = Math.max(1, ...values.filter((v): v is number => v != null), ...(backgrounds ?? []).filter((v): v is number => v != null));
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{label}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{TREND_LABEL[trend]}</p>
      </div>
      <div className="mt-2 flex gap-2">
        {weeks.map((week, i) => {
          const v = values[i];
          const bg = backgrounds?.[i] ?? null;
          const text = week.isGap
            ? "—"
            : v != null
              ? bg != null
                ? `${format(v)} / ${format(bg)}`
                : format(v)
              : "—";
          return (
            <div key={week.weekStart} className="flex-1">
              <p className="text-center text-xs text-zinc-600 dark:text-zinc-300">{text}</p>
              <Bar value={week.isGap ? null : v} background={week.isGap ? null : bg} max={max} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PatternViewPanel({ series }: { series: PatternSeries }) {
  const { weeks } = series;
  const hasAnyCheckin = weeks.some((w) => w.checkin?.overallFeel != null);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Patterns</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Six weeks of patterns. Single workouts are weather; this is the climate.
      </p>

      <div className="mt-4 flex gap-2 border-b border-black/10 pb-2 dark:border-white/10">
        <div className="flex-1" />
        {weeks.map((week) => (
          <WeekHeader key={week.weekStart} week={week} />
        ))}
      </div>

      <div className="divide-y divide-black/10 dark:divide-white/10">
        <SeriesRow
          label="Scheduled vs. completed mileage"
          weeks={weeks}
          trend={series.completedMileageTrend}
          value={(w) => w.completedMileageM}
          background={(w) => w.scheduledMileageM}
          format={formatMiles}
        />
        <SeriesRow
          label="Completion rate"
          weeks={weeks}
          trend={series.completionRateTrend}
          value={(w) => w.completionRate}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SeriesRow
          label="Long run"
          weeks={weeks}
          trend={series.longRunTrend}
          value={(w) => w.longRunDistanceM}
          format={formatMiles}
        />
        <SeriesRow
          label="Key-session RPE"
          weeks={weeks}
          trend={series.keySessionRpeTrend}
          value={(w) => w.keySessionAvgRpe}
          format={(v) => v.toFixed(1)}
        />
        {hasAnyCheckin ? (
          <SeriesRow
            label="Check-in: overall feel"
            weeks={weeks}
            trend={series.checkinTrend}
            value={(w) => w.checkin?.overallFeel ?? null}
            format={(v) => `${v}/5`}
          />
        ) : null}
      </div>
    </div>
  );
}
