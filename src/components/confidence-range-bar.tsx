// A visual "likely range" bar -- the shaded band is the low-high range,
// the dark tick is the point estimate, and an optional lighter tick marks
// a reference value (e.g. the actual/planned pace) for comparison.
// Deliberately aria-hidden: the numeric labels below already convey the
// same range/estimate to a screen reader, so the bar is decoration on top
// of information that's already accessible as plain text, not a
// replacement for it.

export type ConfidenceRangeBarProps = {
  lowSeconds: number;
  estimateSeconds: number;
  highSeconds: number;
  referenceSeconds?: number;
  referenceLabel?: string;
  formatValue: (seconds: number) => string;
};

export function ConfidenceRangeBar({
  lowSeconds,
  estimateSeconds,
  highSeconds,
  referenceSeconds,
  referenceLabel,
  formatValue,
}: ConfidenceRangeBarProps) {
  const rangeMin = Math.min(lowSeconds, highSeconds);
  const rangeMax = Math.max(lowSeconds, highSeconds);
  const scaleMin = Math.min(rangeMin, referenceSeconds ?? rangeMin);
  const scaleMax = Math.max(rangeMax, referenceSeconds ?? rangeMax);
  const padding = (scaleMax - scaleMin || 1) * 0.15;
  const scaleLow = scaleMin - padding;
  const scaleHigh = scaleMax + padding;
  const scaleSpan = scaleHigh - scaleLow || 1;

  const toPercent = (value: number) => ((value - scaleLow) / scaleSpan) * 100;

  const rangeLeftPct = toPercent(rangeMin);
  const rangeWidthPct = toPercent(rangeMax) - rangeLeftPct;
  const estimatePct = toPercent(estimateSeconds);
  const referencePct = referenceSeconds !== undefined ? toPercent(referenceSeconds) : null;

  return (
    <div>
      <div aria-hidden="true" className="relative h-3 w-full rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="absolute inset-y-0 rounded-full bg-accent-tip/40"
          style={{ left: `${rangeLeftPct}%`, width: `${rangeWidthPct}%` }}
        />
        {referencePct !== null && (
          <div
            className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-zinc-400 dark:bg-zinc-500"
            style={{ left: `${referencePct}%` }}
          />
        )}
        <div
          className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 dark:bg-white"
          style={{ left: `${estimatePct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-600 dark:text-zinc-300">
        <span>{formatValue(rangeMin)}</span>
        <span className="font-semibold text-zinc-900 dark:text-white">{formatValue(estimateSeconds)}</span>
        <span>{formatValue(rangeMax)}</span>
      </div>
      {referenceLabel && referenceSeconds !== undefined && (
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {referenceLabel}: {formatValue(referenceSeconds)}
        </p>
      )}
    </div>
  );
}
