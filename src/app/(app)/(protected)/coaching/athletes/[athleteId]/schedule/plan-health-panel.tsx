"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  dismissPlanHealthFinding,
  loadAdjustmentPlaybook,
  loadPlanHealth,
  restorePlanHealthFindings,
  type PlanHealthView,
  type PlaybookView,
} from "./plan-health-actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { ADAPTATION_WINDOW_DAYS, type SessionLoadClass } from "@/lib/private-coaching/plan-health";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Part B, coach-only. Advisory throughout: nothing here blocks a save,
// nothing here changes the plan, and every finding can be dismissed.
//
// Loaded client-side after mount rather than server-rendered with the
// page, so a slow set of checks never delays the schedule itself. An empty
// result renders nothing at all -- a healthy plan should not grow a panel
// telling it so.

const LOAD_CLASS_LABEL: Record<SessionLoadClass, string> = {
  "load-bearing": "Load-bearing",
  supporting: "Supporting",
  droppable: "Droppable",
};

const LOAD_CLASS_ORDER: SessionLoadClass[] = ["load-bearing", "supporting", "droppable"];

function daysUntil(date: string): number {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - today) / (24 * 60 * 60 * 1000));
}

export function PlanHealthPanel({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [view, setView] = useState<PlanHealthView | null>(null);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [showAdaptation, setShowAdaptation] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // Part E: the adjustment playbook. Loaded alongside the checks, since a
  // coach looking at plan guidance is usually about to change something.
  const [playbook, setPlaybook] = useState<PlaybookView | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [raceDistanceInput, setRaceDistanceInput] = useState("");
  const [raceDateInput, setRaceDateInput] = useState("");
  const [racePending, setRacePending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPlanHealth({ athleteId, includeDismissed }).then((result) => {
      if (cancelled) return;
      setView(result);
      // Inside the last four weeks, retooling is the likely reason a coach
      // is on this page at all, so the breakdown starts open.
      if (result.raceDate && daysUntil(result.raceDate) >= 0 && daysUntil(result.raceDate) <= ADAPTATION_WINDOW_DAYS) {
        setShowAdaptation(true);
      }
    });
    loadAdjustmentPlaybook({ athleteId }).then((result) => {
      if (!cancelled) setPlaybook(result);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId, includeDismissed]);

  if (!view || view.error) return null;

  const findings = view.findings ?? [];
  const upcoming = view.upcoming ?? [];
  const dismissedCount = view.dismissedCount ?? 0;
  const hasAnything = findings.length > 0 || dismissedCount > 0 || upcoming.length > 0 || (playbook != null && !playbook.error);
  if (!hasAnything) return null;

  const loadBearing = upcoming.filter((s) => s.loadClass === "load-bearing");

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Plan guidance</p>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Advisory. Nothing here blocks a change.</span>
      </div>

      {findings.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {findings.map((finding) => (
            <li key={finding.key} className="rounded-control border border-black/10 p-3 dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{finding.title}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingKey === finding.key}
                  onClick={async () => {
                    setPendingKey(finding.key);
                    await dismissPlanHealthFinding({ athleteId, findingKey: finding.key });
                    setPendingKey(null);
                    setView((prev) =>
                      prev
                        ? {
                            ...prev,
                            findings: (prev.findings ?? []).filter((f) => f.key !== finding.key),
                            dismissedCount: (prev.dismissedCount ?? 0) + 1,
                          }
                        : prev,
                    );
                    router.refresh();
                  }}
                >
                  Dismiss
                </Button>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{finding.detail}</p>
              {finding.dates.length > 0 && finding.dates.length <= 4 ? (
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {finding.dates.map((d) => formatDate(d)).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Nothing to flag in this plan right now.
        </p>
      )}

      {dismissedCount > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {dismissedCount} dismissed.
          </span>
          {includeDismissed ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIncludeDismissed(false)}>
              Hide dismissed
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIncludeDismissed(true)}>
              Show dismissed
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await restorePlanHealthFindings({ athleteId });
              setIncludeDismissed(false);
              setView(null);
              router.refresh();
            }}
          >
            Reset dismissals
          </Button>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              What is load-bearing
              {loadBearing.length > 0 ? (
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {loadBearing.length} session{loadBearing.length === 1 ? "" : "s"} to protect
                </span>
              ) : null}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdaptation((prev) => !prev)}>
              {showAdaptation ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            For retooling around illness, injury or life. Protect the load-bearing sessions and take the time out of the
            droppable ones.
          </p>
          {showAdaptation ? (
            <div className="mt-3 space-y-4">
              {LOAD_CLASS_ORDER.map((loadClass) => {
                const group = upcoming.filter((s) => s.loadClass === loadClass);
                if (group.length === 0) return null;
                return (
                  <div key={loadClass}>
                    <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                      {LOAD_CLASS_LABEL[loadClass]} · {group.length}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{group[0].reason}</p>
                    <ul className="mt-1.5 space-y-1">
                      {group.slice(0, 12).map((session) => (
                        <li key={session.workout.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                          {formatDate(session.workout.scheduledDate)}
                          {session.workout.dayLabel ? ` · ${session.workout.dayLabel}` : ""}
                        </li>
                      ))}
                    </ul>
                    {group.length > 12 ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        and {group.length - 12} more
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {playbook && !playbook.error ? (
        <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              Adjustment playbook
              {playbook.currentPhaseKey ? (
                <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {playbook.currentPhaseKey} phase
                </span>
              ) : null}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowPlaybook((prev) => !prev)}>
              {showPlaybook ? "Hide" : "Show"}
            </Button>
          </div>
          {playbook.completionNote ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{playbook.completionNote}</p>
          ) : null}

          {showPlaybook ? (
            <div className="mt-3 space-y-4">
              {playbook.rearrange ? <GuidanceBlock guidance={playbook.rearrange} /> : null}

              <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Adding a race</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Check which session a race would replace before putting it on the calendar.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 xs:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Race distance</span>
                    <select
                      value={raceDistanceInput}
                      onChange={(e) => setRaceDistanceInput(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Choose&hellip;</option>
                      <option value="5000">5K</option>
                      <option value="8000">8K</option>
                      <option value="10000">10K</option>
                      <option value="15000">15K</option>
                      <option value="16093">10 miles</option>
                      <option value="21097">Half marathon</option>
                      <option value="42195">Marathon</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Race date</span>
                    <input type="date" value={raceDateInput} onChange={(e) => setRaceDateInput(e.target.value)} className={fieldClass} />
                  </label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={racePending || !raceDistanceInput || !raceDateInput}
                  onClick={async () => {
                    setRacePending(true);
                    const result = await loadAdjustmentPlaybook({
                      athleteId,
                      raceDistanceM: Number(raceDistanceInput),
                      raceDate: raceDateInput,
                    });
                    setRacePending(false);
                    setPlaybook(result);
                  }}
                >
                  {racePending ? "Checking…" : "What does it replace?"}
                </Button>

                {playbook.raceReplacement ? (
                  <div className="mt-3">
                    <GuidanceBlock guidance={playbook.raceReplacement.guidance} />
                    {playbook.raceReplacement.candidates.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {playbook.raceReplacement.candidates.map((c) => (
                          <li key={c.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                            {formatDate(c.scheduledDate)}
                            {c.dayLabel ? ` · ${c.dayLabel}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** One piece of playbook guidance: what the rule is, then what to do about it. */
function GuidanceBlock({ guidance }: { guidance: { title: string; detail: string; actions: string[] } }) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{guidance.title}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{guidance.detail}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {guidance.actions.map((action) => (
          <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}
