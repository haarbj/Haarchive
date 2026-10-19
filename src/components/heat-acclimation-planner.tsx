"use client";

import { useId } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { LabeledInput } from "@/components/ui/labeled-input";
import { formatDate } from "@/lib/format";
import { labelClass } from "@/lib/form-styles";
import {
  buildHeatAcclimationPlan,
  TAPER_DAYS,
  TARGET_SESSION_MAX_MINUTES,
  type HeatTrainingStatus,
} from "@/lib/heat-acclimation-planner-math";
import { segmentedButtonClass, sectionLabelClass, statCardClass, statLabelClass, heroCardClass, detailsClass, detailsBodyClass, summaryClass } from "@/lib/tool-styles";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import { todayDateString } from "@/lib/weather-wind";

const STORAGE_KEY = "haarchive-heat-acclimation-planner-state";

const STATUS_OPTIONS: { value: HeatTrainingStatus; label: string; description: string }[] = [
  { value: "none", label: "None", description: "Not training in heat at all right now." },
  { value: "some", label: "Some", description: "Occasional heat exposure, not consistent." },
  { value: "already", label: "Already training in heat", description: "Regular heat sessions already, most weeks." },
];

type PersistedState = {
  raceDateInput: string;
  status: HeatTrainingStatus;
  availableMinutesInput: string;
};

export function HeatAcclimationPlanner() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);
  const today = todayDateString();

  const [raceDateInput, setRaceDateInput] = usePersistedField(persisted?.raceDateInput, "");
  const [status, setStatus] = usePersistedField<HeatTrainingStatus>(persisted?.status, "none");
  const [availableMinutesInput, setAvailableMinutesInput] = usePersistedField(persisted?.availableMinutesInput, "60");

  function persistState(patch: Partial<PersistedState> = {}) {
    try {
      const state: PersistedState = { raceDateInput, status, availableMinutesInput, ...patch };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  const raceDateValid = raceDateInput.trim() !== "" && raceDateInput > today;
  const availableMinutesRaw = Number(availableMinutesInput);
  const availableMinutesValid = availableMinutesInput.trim() !== "" && Number.isFinite(availableMinutesRaw) && availableMinutesRaw > 0;
  const canCompute = raceDateValid && availableMinutesValid;

  const plan = canCompute ? buildHeatAcclimationPlan(raceDateInput, status, availableMinutesRaw, today) : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Your race</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap gap-4">
            <LabeledInput
              id={`${baseId}-race-date`}
              label="Race date"
              type="date"
              min={today}
              value={raceDateInput}
              onChange={(event) => {
                setRaceDateInput(event.target.value);
                persistState({ raceDateInput: event.target.value });
              }}
              className="w-40"
            />
            <LabeledInput
              id={`${baseId}-minutes`}
              label="Typical training time available per day (min)"
              type="number"
              inputMode="numeric"
              min={1}
              value={availableMinutesInput}
              onChange={(event) => {
                setAvailableMinutesInput(event.target.value);
                persistState({ availableMinutesInput: event.target.value });
              }}
              className="w-28"
            />
          </div>

          <div>
            <p className={labelClass}>Current heat training status</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.description}
                  onClick={() => {
                    setStatus(option.value);
                    persistState({ status: option.value });
                  }}
                  aria-pressed={status === option.value}
                  className={segmentedButtonClass(status === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">{STATUS_OPTIONS.find((o) => o.value === status)?.description}</p>
          </div>
        </div>
      </div>

      {!canCompute && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter a race date (today or later), your heat training status, and how much training time you typically
          have per day.
        </p>
      )}

      {plan && (
        <>
          {plan.isCompressed && (
            <div className={`${heroCardClass} border-l-4 border-amber-500/60`}>
              <p className={statLabelClass}>Full acclimation isn&rsquo;t possible in {plan.daysUntilRace} days</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                Meaningful heat adaptation starts showing up in as few as 4 days, and the kind of complete
                adaptation this status would normally build takes about {plan.neededProtocolDays} days plus a short
                taper -- more than you have before race day. The plan below still uses every day you have, so
                you&rsquo;ll arrive partially adapted, not fully -- that&rsquo;s a real, worthwhile head start on
                race-day heat, just not the full picture.
              </p>
            </div>
          )}

          {plan.maintainUntilDate && (
            <div className={statCardClass}>
              <p className={statLabelClass}>Until {formatDate(plan.maintainUntilDate)}</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                Keep training normally -- it&rsquo;s too early to start deliberate heat exposure yet. Starting the
                protocol now would mean the adaptation fades again before race day instead of being fresh when you
                need it.
              </p>
            </div>
          )}

          <div>
            <p className={sectionLabelClass}>Day-by-day plan</p>
            <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-200">
              Sessions build from a short, easy exposure up to {TARGET_SESSION_MAX_MINUTES} minutes (or whatever
              time you have), then hold there until a short taper {TAPER_DAYS} days before race day -- the
              adaptation itself holds for about two weeks without upkeep, so pulling back right before race day
              costs fatigue, not fitness.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left dark:border-white/10">
                    <th className="py-2 pr-4 font-semibold text-zinc-900 dark:text-white">Day</th>
                    <th className="px-3 py-2 text-left font-semibold text-zinc-900 dark:text-white">Session</th>
                    <th className="py-2 pl-3 text-left font-semibold text-zinc-900 dark:text-white">Hydration</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-200">
                  {plan.days.map((day) => (
                    <tr key={day.date} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2 pr-4 font-medium whitespace-nowrap text-zinc-900 dark:text-white">
                        {day.dayLabel}
                        {day.kind === "taper" ? <Badge tone="tip" className="ml-2">taper</Badge> : null}
                        {day.kind === "race-day" ? <Badge tone="race" className="ml-2">race</Badge> : null}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {day.kind === "heat-session" ? (
                          <>
                            <span className="font-semibold text-zinc-900 dark:text-white">{day.durationMinutes} min in heat</span>
                            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{day.effortNote}</p>
                          </>
                        ) : (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300">{day.effortNote}</p>
                        )}
                      </td>
                      <td className="py-2 pl-3 align-top text-xs text-zinc-600 dark:text-zinc-300">{day.hydrationNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>No time to train outdoors in heat?</p>
            <div className={statCardClass}>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                A sauna (20-40 min at 175-220°F) or a hot bath (20 min at 104-111°F) after a run, at least 3x/week,
                produces some of the same adaptation and can supplement the plan above -- but it&rsquo;s a
                supplement, not a substitute. Running in the heat itself is what actually drives the adaptation
                that matters on race day.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Where this comes from, and how solid it is
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The exposure numbers above (roughly 60-90 minutes a day, meaningful adaptation in as few as 4
                  days, full adaptation in about 2 weeks, and the sauna/hot-bath supplement) match this
                  site&rsquo;s own existing Heat Tracker guidance and the Heat Acclimatization section of the
                  Workout Library -- not a second, separately-chosen protocol. That guidance traces to
                  sports-science consensus work (Armstrong et al.-style heat-acclimatization reviews) and
                  decades-old applied research (a 1930s South African gold-mine heat-adaptation study is the
                  earliest version of this same roughly-two-week timeline), not a single randomized trial that
                  pins the numbers exactly.
                </p>
                <p className="mt-2">
                  The race-week taper ({TAPER_DAYS} days with no deliberate heat exposure) and the exact day-by-day
                  session schedule are this tool&rsquo;s own addition -- the site&rsquo;s existing pages describe
                  the adaptation and its slow decay over weeks, but not a race-week pullback specifically. This
                  follows the general consensus that adaptation persists for a while after the last exposure, so a
                  short taper trades a little topping-up for arriving recovered, not the adaptation itself. Treat
                  the whole plan as well-grounded general guidance, not a personalized medical or physiological
                  prescription -- individual heat tolerance varies, and real heat illness risk doesn&rsquo;t wait
                  for a training plan.
                </p>
              </div>
            </details>
          </div>
        </>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Want to know what a specific day&rsquo;s heat actually costs your pace, not just how to prepare for it? The{" "}
        <Link
          href="/heat-tracker"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Heat Tracker
        </Link>{" "}
        reads real forecast conditions and flags what today or race day actually calls for.
      </p>
    </div>
  );
}
