"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { copyWeek } from "./actions";
import { formatDate } from "@/lib/format";

// Direct Copy/Paste between weeks, reusing the copyWeek action (already
// built and tested) rather than the earlier "Copy this week to..."
// destination-picker. Mounted once per visible week -- Week View's own
// header, both WeekStrips, and every week row in Month View -- so a coach
// can go Copy Aug 24 -> Paste on Aug 31 without leaving whichever page
// they're already looking at. `baseParams` is that page's own current
// view-identifying params (e.g. `{ view: "week", week: pageWeek }` or
// `{ view: "month", month }`), kept stable across Copy/Paste clicks so
// clicking Copy/Paste never navigates the coach away from the page they're
// on -- only the `copiedWeek` param layered on top changes.
export function WeekCopyPasteControls({
  athleteId,
  baseParams,
  week,
  copiedWeek,
  compact,
}: {
  athleteId: string;
  baseParams: Record<string, string>;
  week: string;
  copiedWeek: string | null;
  // Month View mounts this once per week row inside a narrow grid column --
  // "Paste week of Aug 24" doesn't fit there the way it does in Week View's
  // own header/strips. Shortens the labels only; behavior is identical.
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function baseUrl(extra: Record<string, string | null>) {
    const params = new URLSearchParams(baseParams);
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
    return `?${params.toString()}`;
  }

  function handleCopy() {
    router.push(baseUrl({ copiedWeek: week }));
  }

  async function handlePaste() {
    if (!copiedWeek) return;
    setError(null);
    setNotice(null);
    setIsPending(true);
    const result = await copyWeek(athleteId, copiedWeek, week);
    setIsPending(false);
    if (result.error) return setError(result.error);
    // A partial conflict (some target days already had a workout) isn't an
    // error -- copyWeek already skips those days and reports them -- but a
    // silent "success" here would leave the coach assuming every day copied
    // when some didn't.
    if (result.skippedDates && result.skippedDates.length > 0) {
      setNotice(
        `Copied ${result.copiedCount ?? 0} ${result.copiedCount === 1 ? "day" : "days"} -- ${result.skippedDates.length} already had a workout and ${result.skippedDates.length === 1 ? "was" : "were"} skipped.`,
      );
    }
    router.push(baseUrl({ copiedWeek: null }));
    router.refresh();
  }

  const showPaste = copiedWeek != null && copiedWeek !== week;
  const textSize = compact ? "text-[10px]" : "text-xs";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className={`${textSize} font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white`}
      >
        Copy
      </button>
      {showPaste ? (
        <button
          type="button"
          disabled={isPending}
          onClick={handlePaste}
          className={`${textSize} font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white`}
        >
          {isPending ? "Pasting…" : compact ? "Paste" : `Paste week of ${formatDate(copiedWeek!)}`}
        </button>
      ) : null}
      {error ? <span className={`${textSize} text-accent-error`}>{error}</span> : null}
      {notice ? <span className={`${textSize} text-zinc-500 dark:text-zinc-400`}>{notice}</span> : null}
    </div>
  );
}
