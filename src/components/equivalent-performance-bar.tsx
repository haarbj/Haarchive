import { rankByImpact } from "@/lib/environmental/coaching-summary";
import type { EngineResult } from "@/lib/environmental/types";

const FACTOR_ICON: Record<string, string> = {
  Heat: "🌡️",
  Humidity: "💧",
  Wind: "💨",
  Elevation: "⛰️",
};

function formatSignedSeconds(seconds: number): string {
  const rounded = Math.round(Math.abs(seconds));
  if (rounded === 0) return "±0s";
  const sign = seconds > 0 ? "+" : "−";
  return `${sign}${rounded}s`;
}

function BarRow({
  label,
  seconds,
  maxMagnitude,
  bold,
}: {
  label: string;
  seconds: number;
  maxMagnitude: number;
  bold?: boolean;
}) {
  const widthPct = Math.min(100, (Math.abs(seconds) / maxMagnitude) * 100);
  const isCost = seconds > 0.5;
  const isBenefit = seconds < -0.5;
  const barColor = isCost
    ? "bg-red-500/70 dark:bg-red-400/70"
    : isBenefit
      ? "bg-emerald-500/70 dark:bg-emerald-400/70"
      : "bg-zinc-400/50 dark:bg-zinc-500/50";

  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-24 shrink-0 text-sm ${bold ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-200"}`}
      >
        {label}
      </span>
      <div aria-hidden="true" className="h-3 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${widthPct}%` }} />
      </div>
      <span
        className={`w-14 shrink-0 text-right text-sm tabular-nums ${bold ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-200"}`}
      >
        {formatSignedSeconds(seconds)}
      </span>
    </div>
  );
}

/**
 * The "Environmental Breakdown" visualization -- one bar per applicable
 * factor (red = cost, green = benefit), sized relative to the largest
 * magnitude among them, plus a bolded "Combined" total row. Deliberately
 * a plain labeled bar list rather than a chart library: every value is
 * also printed as text, so nothing here depends on color alone or on a
 * canvas/SVG a screen reader can't read.
 *
 * Rows are sorted largest-impact-first (regardless of sign) rather than a
 * fixed Heat/Humidity/Wind/Elevation order, so whatever mattered most
 * today reads first -- matching how a coach would explain it, not how
 * the engines happen to be registered internally.
 */
export function EquivalentPerformanceBar({
  results,
  totalAdjustmentSeconds,
}: {
  results: EngineResult[];
  totalAdjustmentSeconds: number;
}) {
  const maxMagnitude = Math.max(
    1,
    ...results.map((r) => Math.abs(r.adjustmentSeconds)),
    Math.abs(totalAdjustmentSeconds),
  );
  const ranked = rankByImpact(results);

  return (
    <div className="space-y-2.5">
      {ranked.map((result) => (
        <BarRow
          key={result.factor}
          label={`${FACTOR_ICON[result.factor] ?? ""} ${result.factor}`}
          seconds={result.adjustmentSeconds}
          maxMagnitude={maxMagnitude}
        />
      ))}
      <div className="border-t border-black/10 pt-2.5 dark:border-white/10">
        <BarRow label="Combined" seconds={totalAdjustmentSeconds} maxMagnitude={maxMagnitude} bold />
      </div>
    </div>
  );
}
