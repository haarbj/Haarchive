"use client";

import { useId } from "react";
import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LabeledInput } from "@/components/ui/labeled-input";
import type { AcwrZone } from "@/lib/acwr";
import {
  buildTrainingLoadPlan,
  CUTBACK_INTERVAL_WEEKS,
  CUTBACK_REDUCTION,
  WEEKLY_INCREASE_CAP,
  type PlannedWeek,
} from "@/lib/training-load-planner-math";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  sectionLabelClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";

const STORAGE_KEY = "haarchive-training-load-planner-state";

const WEEK_LABELS = ["4 weeks ago", "3 weeks ago", "2 weeks ago", "Last week"];

const ZONE_LABEL: Record<AcwrZone, string> = {
  undertrained: "Undertraining / losing fitness",
  "sweet-spot": "Safe progression",
  caution: "Caution",
  "high-risk": "High injury risk",
};

const ZONE_TONE: Record<AcwrZone, BadgeTone> = {
  undertrained: "neutral",
  "sweet-spot": "success",
  caution: "warning",
  "high-risk": "error",
};

type PersistedState = {
  weekInputs: [string, string, string, string];
  goalInput: string;
  weeksInput: string;
};

function formatMi(value: number): string {
  return `${Math.round(value)} mi`;
}

export function TrainingLoadPlanner() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [weekInputs, setWeekInputs] = usePersistedField<[string, string, string, string]>(
    persisted?.weekInputs,
    ["20", "22", "18", "24"],
  );
  const [goalInput, setGoalInput] = usePersistedField(persisted?.goalInput, "35");
  const [weeksInput, setWeeksInput] = usePersistedField(persisted?.weeksInput, "6");

  function persistState(patch: Partial<PersistedState> = {}) {
    try {
      const state: PersistedState = { weekInputs, goalInput, weeksInput, ...patch };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  function setWeekInput(index: number, value: string) {
    const next = [...weekInputs] as [string, string, string, string];
    next[index] = value;
    setWeekInputs(next);
    persistState({ weekInputs: next });
  }

  const weekValues = weekInputs.map((v) => Number(v));
  const weeksValid = weekInputs.every((v) => v.trim() !== "") && weekValues.every((v) => Number.isFinite(v) && v >= 0);

  const goalRaw = Number(goalInput);
  const goalValid = goalInput.trim() !== "" && Number.isFinite(goalRaw) && goalRaw > 0;

  const weeksAvailableRaw = Math.round(Number(weeksInput));
  const weeksAvailableValid = weeksInput.trim() !== "" && Number.isFinite(weeksAvailableRaw) && weeksAvailableRaw >= 1 && weeksAvailableRaw <= 52;

  const canCompute = weeksValid && goalValid && weeksAvailableValid;

  const plan = canCompute
    ? buildTrainingLoadPlan(weekValues as [number, number, number, number], goalRaw, weeksAvailableRaw)
    : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Your recent mileage</p>
        <div className={`${statCardClass} space-y-4`}>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            Four weeks, oldest first. The ramp itself starts from last week&rsquo;s mileage -- the other three just
            establish your rolling average, so the very first planned week&rsquo;s risk check reflects real recent
            training, not just one number.
          </p>
          <div className="flex flex-wrap gap-4">
            {WEEK_LABELS.map((label, i) => (
              <LabeledInput
                key={label}
                id={`${baseId}-week-${i}`}
                label={`${label} (mi)`}
                type="number"
                inputMode="decimal"
                min={0}
                value={weekInputs[i]}
                onChange={(event) => setWeekInput(i, event.target.value)}
                className="w-24"
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Your goal</p>
        <div className={`${statCardClass} flex flex-wrap gap-4`}>
          <LabeledInput
            id={`${baseId}-goal`}
            label="Goal weekly mileage (mi)"
            type="number"
            inputMode="decimal"
            min={1}
            value={goalInput}
            onChange={(event) => {
              setGoalInput(event.target.value);
              persistState({ goalInput: event.target.value });
            }}
            className="w-28"
          />
          <LabeledInput
            id={`${baseId}-weeks`}
            label="Weeks available (1-52)"
            type="number"
            inputMode="numeric"
            min={1}
            max={52}
            value={weeksInput}
            onChange={(event) => {
              setWeeksInput(event.target.value);
              persistState({ weeksInput: event.target.value });
            }}
            className="w-24"
          />
        </div>
      </div>

      {!canCompute && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Enter your last 4 weeks of mileage, a goal, and how many weeks you have to get there.
        </p>
      )}

      {plan && (
        <>
          {!plan.reachesGoal && plan.safeAlternative && (
            <div className={`${heroCardClass} border-l-4 border-amber-500/60`}>
              <p className={statLabelClass}>This goal isn&rsquo;t safely reachable in {weeksAvailableRaw} weeks</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                Ramping at {Math.round(WEEKLY_INCREASE_CAP * 100)}%/week with a down week every {CUTBACK_INTERVAL_WEEKS}, the
                most you could safely reach in that time is about{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">
                  {formatMi(plan.safeAlternative.maxSafeMileageInGivenWeeks)}/week
                </strong>
                . Reaching your actual goal of {formatMi(goalRaw)}/week safely would take about{" "}
                <strong className="font-semibold text-zinc-900 dark:text-white">{plan.safeAlternative.weeksNeeded} weeks</strong> total --
                either give it more time, or lower the goal for this stretch.
              </p>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                The plan below still shows what&rsquo;s safe to run over your {weeksAvailableRaw} weeks -- it just
                tops out below your stated goal instead of forcing it.
              </p>
            </div>
          )}

          <div>
            <p className={sectionLabelClass}>Week-by-week plan</p>
            <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-200">
              Each week&rsquo;s risk check is its{" "}
              <strong className="font-semibold text-zinc-900 dark:text-white">ACWR</strong> (acute:chronic workload
              ratio) -- a concept from sports science comparing that week&rsquo;s mileage to your trailing 4-week
              average. A ratio well above 1 means volume is climbing faster than your body has adapted to; well
              below 1 can mean you&rsquo;re losing fitness, not just resting.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left dark:border-white/10">
                    <th className="py-2 pr-4 font-semibold text-zinc-900 dark:text-white">Week</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">Mileage</th>
                    <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">ACWR</th>
                    <th className="py-2 pl-3 text-left font-semibold text-zinc-900 dark:text-white">Flag</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-200">
                  {plan.weeks.map((week: PlannedWeek) => (
                    <tr key={week.weekNumber} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2 pr-4 font-medium whitespace-nowrap text-zinc-900 dark:text-white">
                        Week {week.weekNumber}
                        {week.isCutback ? <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">(down week)</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatMi(week.mileage)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{week.acwr !== null ? week.acwr.toFixed(2) : "—"}</td>
                      <td className="py-2 pl-3">
                        {week.zone !== null ? <Badge tone={ZONE_TONE[week.zone]}>{ZONE_LABEL[week.zone]}</Badge> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
                  ▶
                </span>
                Where these numbers come from, and how solid the evidence is
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The ramp itself caps any single week&rsquo;s increase at {Math.round(WEEKLY_INCREASE_CAP * 100)}% over the
                  last ramp week -- the commonly-cited &ldquo;10% rule.&rdquo; Worth being honest about what that
                  actually is: a widely-repeated rule of thumb runners and coaches have passed down for decades, not
                  the result of a dedicated trial proving 10% is the right number (or that 11% is meaningfully
                  riskier than 9%). Treat it as a sensible default, not a law of physiology. A down week every{" "}
                  {CUTBACK_INTERVAL_WEEKS} weeks, dropping to {Math.round((1 - CUTBACK_REDUCTION) * 100)}% of the
                  prior week&rsquo;s volume, is the same convention this site&rsquo;s own private-coaching plan
                  builder already uses for a real assigned season.
                </p>
                <p className="mt-2">
                  ACWR (acute:chronic workload ratio) compares a recent, short window of training (here, one week)
                  to a longer trailing average (here, 4 weeks) as a ratio. It&rsquo;s a real, published idea from
                  sports-science research on injury risk (Tim Gabbett&rsquo;s 2016 review is the most commonly cited
                  source for the bands used below), but most of that evidence comes from team sports like rugby and
                  Australian football, not distance running specifically -- and more recent methodology papers
                  (e.g. Impellizzeri et al., 2020) have raised real statistical concerns about how this exact ratio
                  is usually calculated. This tool uses the same bands and the same calculation this site&rsquo;s
                  own dashboard already uses for a runner&rsquo;s real training history, for consistency -- not
                  because the underlying science is settled. Treat the flags below as a directional signal worth
                  paying attention to, not a precise injury-risk score.
                </p>
                <p className="mt-2">Bands used: below 0.8 undertraining, 0.8&ndash;1.3 safe progression, 1.3&ndash;1.5 caution, above 1.5 high injury risk.</p>
              </div>
            </details>
          </div>
        </>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        Have a pace in hand and want a session built around it instead of a weekly total? The{" "}
        <Link
          href="/workout-builder"
          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
        >
          Workout Builder
        </Link>{" "}
        turns a pace into a full warmup/main set/cooldown session.
      </p>
    </div>
  );
}
