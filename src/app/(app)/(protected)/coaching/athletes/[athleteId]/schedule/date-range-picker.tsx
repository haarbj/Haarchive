"use client";

import { useState } from "react";

import { monthGridDates, shiftMonth } from "@/lib/week";
import { formatDate } from "@/lib/format";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A small inline calendar for picking a start/end date range visually --
// built for PhaseForm specifically, since guessing a phase's start/end
// weekday from two bare <input type="date"> fields is exactly the kind of
// thing a visual calendar solves better than typing. Reuses the same
// Monday-start grid math MonthView itself uses (monthGridDates/
// shiftMonth), so this picker and the calendar it's scheduling into never
// disagree about which dates belong to which week.
//
// Click behavior: the first click (or a click once a full range is
// already set) starts a new range; the second click completes it,
// swapping if the second date falls before the first so start/end stay in
// order regardless of click order.
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string | null;
  endDate: string | null;
  onChange: (next: { startDate: string | null; endDate: string | null }) => void;
}) {
  const [month, setMonth] = useState(() => (startDate ?? endDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7));
  const gridDates = monthGridDates(month);
  const today = new Date().toISOString().slice(0, 10);

  function handleClick(date: string) {
    if (!startDate || (startDate && endDate)) {
      onChange({ startDate: date, endDate: null });
    } else if (date < startDate) {
      onChange({ startDate: date, endDate: startDate });
    } else {
      onChange({ startDate, endDate: date });
    }
  }

  const startMisaligned = startDate ? new Date(`${startDate}T00:00:00Z`).getUTCDay() !== 1 : false;
  const endMisaligned = endDate ? new Date(`${endDate}T00:00:00Z`).getUTCDay() !== 0 : false;

  return (
    <div className="rounded-control border border-black/10 p-2 dark:border-white/10">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="rounded-control px-2 py-1 text-sm text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="rounded-control px-2 py-1 text-sm text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {WEEKDAY_HEADERS.map((d) => (
          <p key={d} className="text-center text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            {d}
          </p>
        ))}
        {gridDates.map((date) => {
          const inMonth = date.slice(0, 7) === month;
          const isStart = date === startDate;
          const isEnd = date === endDate;
          const inRange = !!(startDate && endDate && date > startDate && date < endDate);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onClick={() => handleClick(date)}
              aria-pressed={isStart || isEnd}
              className={`rounded-control py-1 text-xs ${inMonth ? "" : "text-zinc-300 dark:text-zinc-700"} ${
                isStart || isEnd
                  ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
                  : inRange
                    ? "bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-white"
                    : "text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              } ${isToday && !isStart && !isEnd ? "ring-1 ring-inset ring-accent-tip" : ""}`}
            >
              {Number(date.slice(8, 10))}
            </button>
          );
        })}
      </div>

      <div className="mt-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
        {startDate && endDate ? (
          <p>
            {formatDate(startDate)} – {formatDate(endDate)}
          </p>
        ) : startDate ? (
          <p>{formatDate(startDate)} – pick an end date</p>
        ) : (
          <p>Click a date to set the start</p>
        )}
        {startMisaligned ? <p>Phases work best starting on a Monday.</p> : null}
        {endMisaligned ? <p>Phases work best ending on a Sunday.</p> : null}
      </div>
    </div>
  );
}
