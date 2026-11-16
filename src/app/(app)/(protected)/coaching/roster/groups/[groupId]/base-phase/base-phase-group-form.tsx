"use client";

import { useEffect, useState } from "react";

import {
  assignBasePhaseToGroup,
  previewBasePhaseForGroup,
  type GroupBasePhaseConfig,
  type GroupBasePhaseMemberPreview,
} from "./base-phase-group-actions";
import { loadPlanFirstWeek, type BasePhaseAnchor, type BasePhaseProgramOption } from "../../../../athletes/[athleteId]/base-phase/actions";
import {
  DEFAULT_RESTART_STEP_MILES,
  MAX_DAYS_PER_WEEK,
  MIN_DAYS_PER_WEEK,
  type BasePhaseAthleteType,
  type BasePhasePlan,
} from "@/lib/private-coaching/base-phase-generator";
import type { AcwrZone } from "@/lib/acwr";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Same display-only label/tone map used by the single-athlete form and the
// Training Load Planner's own component -- not safety math.
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

function mostRecentMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// The group-assign counterpart to the single-athlete BasePhaseGeneratorForm
// and the sibling AssignProgramGroupForm (commit 8721d64): one shared base
// configuration for the whole group, a per-athlete preview (Ready/Conflict,
// matching the program-assign flow's own review screen exactly), and a
// server-side re-verified submit with an assigned/skipped/failed summary.
export function BasePhaseGroupForm({
  groupId,
  groupName,
  members,
  programs,
}: {
  groupId: string;
  groupName: string;
  members: { athleteId: string; name: string }[];
  programs: BasePhaseProgramOption[];
}) {
  const [startingWeeklyMiles, setStartingWeeklyMiles] = useState("");

  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const program = programs.find((p) => p.id === programId) ?? null;
  const [variantId, setVariantId] = useState(program?.variants[0]?.id ?? "");
  const [volumeVariantId, setVolumeVariantId] = useState(program?.volumeVariants[0]?.id ?? "");
  const [targetTotalMiles, setTargetTotalMiles] = useState("");
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(String(MAX_DAYS_PER_WEEK));
  const [planWeekError, setPlanWeekError] = useState<string | null>(null);

  const [weeksAvailableInput, setWeeksAvailableInput] = useState("6");
  const [anchorMode, setAnchorMode] = useState<"endingWeek" | "startingWeek">("endingWeek");
  const [planStartDateInput, setPlanStartDateInput] = useState("");
  const [baseStartDateInput, setBaseStartDateInput] = useState(mostRecentMonday(new Date()));
  const [athleteType, setAthleteType] = useState<BasePhaseAthleteType>("restarting");
  const [restartStepMiles, setRestartStepMiles] = useState(String(DEFAULT_RESTART_STEP_MILES));
  const [currentDaysPerWeek, setCurrentDaysPerWeek] = useState(String(MIN_DAYS_PER_WEEK));
  const [longestRunInput, setLongestRunInput] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [plan, setPlan] = useState<BasePhasePlan | null>(null);
  const [memberPreviews, setMemberPreviews] = useState<GroupBasePhaseMemberPreview[]>([]);
  const [clearDecisions, setClearDecisions] = useState<Record<string, boolean>>({});
  // athleteId -> coach checked "build anyway" for that member's reported
  // injury history (same override the single-athlete form exposes). A
  // blocked member has no plan/conflict yet -- checking this and clicking
  // "Preview for group" again generates their real plan on the next pass.
  const [injuryOverrides, setInjuryOverrides] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<{
    assigned: { athleteId: string; name: string; daysCreated: number }[];
    skipped: { athleteId: string; name: string; reason: string }[];
    failed: { athleteId: string; name: string; error: string }[];
  } | null>(null);

  useEffect(() => {
    if (!variantId) return;
    let cancelled = false;
    loadPlanFirstWeek(variantId, volumeVariantId || null).then((result) => {
      if (cancelled) return;
      if (result.error || !result.week) {
        setPlanWeekError(result.error ?? "Couldn't read this plan's first week.");
        return;
      }
      setPlanWeekError(null);
      setTargetTotalMiles(String(result.week.totalMiles));
      setTargetDaysPerWeek(String(result.week.daysPerWeek));
      setPlan(null);
    });
    return () => {
      cancelled = true;
    };
  }, [variantId, volumeVariantId]);

  function updateProgram(nextProgramId: string) {
    setProgramId(nextProgramId);
    const nextProgram = programs.find((p) => p.id === nextProgramId) ?? null;
    setVariantId(nextProgram?.variants[0]?.id ?? "");
    setVolumeVariantId(nextProgram?.volumeVariants[0]?.id ?? "");
    setPlan(null);
  }

  function resolveAnchor(): BasePhaseAnchor {
    return anchorMode === "endingWeek" ? { kind: "endingWeek", planStartDate: planStartDateInput } : { kind: "startingWeek", baseStartDate: baseStartDateInput };
  }

  function buildConfig(): { error: string } | { config: GroupBasePhaseConfig } {
    const starting = Number(startingWeeklyMiles);
    const target = Number(targetTotalMiles);
    if (!Number.isFinite(starting) || starting < 0) return { error: "Enter a starting weekly mileage." };
    if (!Number.isFinite(target) || target <= 0) return { error: "Pick a plan so its first workout week can be read." };
    if (!planStartDateInput) return { error: "Enter the plan's own start date." };
    if (anchorMode === "startingWeek" && !baseStartDateInput) return { error: "Pick the date the base phase starts." };

    const targetDays = Math.max(MIN_DAYS_PER_WEEK, Math.min(MAX_DAYS_PER_WEEK, Math.round(Number(targetDaysPerWeek) || MAX_DAYS_PER_WEEK)));
    const currentDays = Math.max(MIN_DAYS_PER_WEEK, Math.min(MAX_DAYS_PER_WEEK, Math.round(Number(currentDaysPerWeek) || MIN_DAYS_PER_WEEK)));
    const weeksAvailable = Math.max(1, Math.round(Number(weeksAvailableInput) || 1));
    const longestRun = longestRunInput.trim() ? Number(longestRunInput) : null;

    return {
      config: {
        startingWeeklyMiles: starting,
        targetWeek: { totalMiles: target, daysPerWeek: targetDays },
        weeksAvailable,
        athleteType,
        currentDaysPerWeek: currentDays,
        longestRunInLast30DaysMiles: longestRun,
        restartStepMiles: athleteType === "restarting" ? Math.max(1, Number(restartStepMiles) || DEFAULT_RESTART_STEP_MILES) : undefined,
        anchor: resolveAnchor(),
        planStartDate: planStartDateInput,
      },
    };
  }

  async function handlePreview() {
    setError(null);
    const built = buildConfig();
    if ("error" in built) return setError(built.error);

    setIsPending(true);
    const result = await previewBasePhaseForGroup(groupId, built.config, injuryOverrides);
    setIsPending(false);
    if (result.error && !result.plan) return setError(result.error);
    setPlan(result.plan ?? null);
    setMemberPreviews(result.members ?? []);
    setClearDecisions({});
  }

  async function handleAssign() {
    setError(null);
    const built = buildConfig();
    if ("error" in built) return setError(built.error);

    setIsPending(true);
    const result = await assignBasePhaseToGroup(groupId, built.config, clearDecisions, injuryOverrides);
    setIsPending(false);
    if (result.error) return setError(result.error);
    setOutcome({ assigned: result.assigned ?? [], skipped: result.skipped ?? [], failed: result.failed ?? [] });
  }

  const readyCount = memberPreviews.filter((m) => !m.error && !m.blockedForInjuryHistory && !m.conflict).length;
  const willAssignCount =
    readyCount + memberPreviews.filter((m) => !m.error && !m.blockedForInjuryHistory && m.conflict && clearDecisions[m.athleteId]).length;

  if (outcome) {
    return (
      <div className="space-y-4 rounded-control border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Assigned to {outcome.assigned.length} athlete{outcome.assigned.length === 1 ? "" : "s"} in {groupName}.
        </p>
        {outcome.assigned.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
            {outcome.assigned.map((a) => (
              <li key={a.athleteId}>
                {a.name}: {a.daysCreated} days added
              </li>
            ))}
          </ul>
        ) : null}
        {outcome.skipped.length > 0 ? (
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-600 uppercase dark:text-amber-400">Skipped</p>
            <ul className="mt-1.5 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
              {outcome.skipped.map((s) => (
                <li key={s.athleteId}>
                  {s.name}: {s.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {outcome.failed.length > 0 ? (
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-red-600 uppercase dark:text-red-400">Failed</p>
            <ul className="mt-1.5 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">
              {outcome.failed.map((f) => (
                <li key={f.athleteId}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button type="button" size="sm" onClick={() => window.location.assign("/coaching/roster")}>
          Back to roster
        </Button>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          You don&rsquo;t have any programs yet -- build one in your Programs library first.
        </p>
        <Button href="/coaching/programs" size="sm">
          Go to Programs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-control border border-black/10 p-3 dark:border-white/10">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Applies to {members.length} athlete{members.length === 1 ? "" : "s"} in {groupName}.
      </p>

      <div>
        <p className={labelClass}>Plan to build toward</p>
        <div className="mt-1.5 grid grid-cols-1 gap-3 xs:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Program</span>
            <select value={programId} onChange={(e) => updateProgram(e.target.value)} className={fieldClass}>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Plan length</span>
            <select
              value={variantId}
              onChange={(e) => {
                setVariantId(e.target.value);
                setPlan(null);
              }}
              className={fieldClass}
            >
              {(program?.variants ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {program && program.volumeVariants.length > 0 ? (
            <label className="block">
              <span className={labelClass}>Peak weekly volume</span>
              <select
                value={volumeVariantId}
                onChange={(e) => {
                  setVolumeVariantId(e.target.value);
                  setPlan(null);
                }}
                className={fieldClass}
              >
                {program.volumeVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-3 rounded-control border border-black/10 p-3 text-sm dark:border-white/10">
          {planWeekError ? (
            <FormError>{planWeekError}</FormError>
          ) : (
            <p className="text-zinc-700 dark:text-zinc-300">
              First workout week: <span className="font-medium text-zinc-900 dark:text-white">{targetTotalMiles || "--"} mi</span> over{" "}
              <span className="font-medium text-zinc-900 dark:text-white">{targetDaysPerWeek || "--"} days</span>, 2 of them MLRs/workouts.
            </p>
          )}
          <div className="mt-2 grid grid-cols-1 gap-3 xs:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Total miles (editable)</span>
              <input
                value={targetTotalMiles}
                onChange={(e) => {
                  setTargetTotalMiles(e.target.value);
                  setPlan(null);
                }}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>
                Day count (editable, {MIN_DAYS_PER_WEEK}-{MAX_DAYS_PER_WEEK})
              </span>
              <input
                type="number"
                min={MIN_DAYS_PER_WEEK}
                max={MAX_DAYS_PER_WEEK}
                value={targetDaysPerWeek}
                onChange={(e) => {
                  setTargetDaysPerWeek(e.target.value);
                  setPlan(null);
                }}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      </div>

      <label className="block max-w-xs">
        <span className={labelClass}>Starting weekly mileage (shared for the group)</span>
        <input
          value={startingWeeklyMiles}
          onChange={(e) => {
            setStartingWeeklyMiles(e.target.value);
            setPlan(null);
          }}
          className={fieldClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div>
          <p className={labelClass}>Duration (weeks)</p>
          <input
            type="number"
            min={1}
            max={52}
            value={weeksAvailableInput}
            onChange={(e) => {
              setWeeksAvailableInput(e.target.value);
              setPlan(null);
            }}
            className={`${fieldClass} mt-1.5`}
          />
        </div>
        <label className="block">
          <span className={labelClass}>Plan start date (when the plan&rsquo;s own workouts begin)</span>
          <input
            type="date"
            value={planStartDateInput}
            onChange={(e) => {
              setPlanStartDateInput(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
      </div>

      <div>
        <p className={labelClass}>Anchor</p>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setAnchorMode("endingWeek");
              setPlan(null);
            }}
            className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
              anchorMode === "endingWeek"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            Ending week
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchorMode("startingWeek");
              setPlan(null);
            }}
            className={`rounded-control border px-3 py-1.5 text-sm font-medium ${
              anchorMode === "startingWeek"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 text-zinc-600 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            Starting week
          </button>
        </div>
        {anchorMode === "endingWeek" ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            The base runs backward from the plan start date above, for exactly {weeksAvailableInput || "0"} week
            {weeksAvailableInput === "1" ? "" : "s"}, ending the week before it.
          </p>
        ) : (
          <label className="mt-2 block max-w-xs">
            <span className={labelClass}>Base start date</span>
            <input
              type="date"
              value={baseStartDateInput}
              onChange={(e) => {
                setBaseStartDateInput(e.target.value);
                setPlan(null);
              }}
              className={fieldClass}
            />
            <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
              The base runs forward from this date for exactly {weeksAvailableInput || "0"} week
              {weeksAvailableInput === "1" ? "" : "s"}.
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Current days/week (shared for the group)</span>
          <input
            type="number"
            min={MIN_DAYS_PER_WEEK}
            max={MAX_DAYS_PER_WEEK}
            value={currentDaysPerWeek}
            onChange={(e) => {
              setCurrentDaysPerWeek(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Longest run, last 30 days (mi, shared, optional)</span>
          <input
            value={longestRunInput}
            onChange={(e) => {
              setLongestRunInput(e.target.value);
              setPlan(null);
            }}
            className={fieldClass}
          />
        </label>
      </div>

      <div>
        <p className={labelClass}>Athlete type</p>
        <div className="mt-1.5 space-y-2">
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="radio"
              checked={athleteType === "restarting"}
              onChange={() => {
                setAthleteType("restarting");
                setPlan(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">Restarting</span> -- the group has run
              consistently before, just currently below the plan&rsquo;s starting mileage.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-control border border-black/10 p-2 text-sm text-zinc-700 dark:border-white/10 dark:text-zinc-300">
            <input
              type="radio"
              checked={athleteType === "beginner"}
              onChange={() => {
                setAthleteType("beginner");
                setPlan(null);
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">True beginners</span> -- follows the
              platform&rsquo;s standard 10% rule.
            </span>
          </label>
        </div>
        {athleteType === "restarting" ? (
          <label className="mt-2 block max-w-[10rem]">
            <span className={labelClass}>Weekly step (mi)</span>
            <input
              value={restartStepMiles}
              onChange={(e) => {
                setRestartStepMiles(e.target.value);
                setPlan(null);
              }}
              className={fieldClass}
            />
          </label>
        ) : null}
      </div>

      {error && <FormError>{error}</FormError>}

      {!plan ? (
        <Button type="button" size="sm" disabled={isPending} onClick={handlePreview}>
          {isPending ? "Generating…" : "Preview for group"}
        </Button>
      ) : (
        <div className="space-y-4">
          {plan.guardrail.tooAggressive ? (
            <div className="space-y-2 rounded-control border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">This build is too aggressive as entered.</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{plan.guardrail.reason}</p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-control border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-zinc-900/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Week</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Total mi</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Long run</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">MLRs</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Easy days</th>
                  <th className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Zone</th>
                </tr>
              </thead>
              <tbody>
                {plan.weeks.map((week) => (
                  <tr key={week.weekNumber} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{week.weekNumber}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{week.totalMiles}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{week.longRunMiles}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{week.mlrMiles.join(" / ") || "--"}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{week.easyMiles.join(" / ") || "none"}</td>
                    <td className="px-3 py-2">{week.acwrZone ? <Badge tone={ZONE_TONE[week.acwrZone]}>{ZONE_LABEL[week.acwrZone]}</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              {groupName} -- {willAssignCount} of {memberPreviews.length} will be assigned
            </p>
            {memberPreviews.map((member) => {
              if (member.error) {
                return (
                  <div key={member.athleteId} className="rounded-control border border-black/10 p-2 text-sm dark:border-white/10">
                    <span className="font-medium text-zinc-900 dark:text-white">{member.name}</span>{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">-- {member.error} (skipped)</span>
                  </div>
                );
              }
              if (member.blockedForInjuryHistory) {
                return (
                  <div key={member.athleteId} className="rounded-control border border-amber-200 p-2 dark:border-amber-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{member.name}</span>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Injury history</span>
                    </div>
                    {member.injuryHistoryText ? (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{member.injuryHistoryText}</p>
                    ) : null}
                    <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={injuryOverrides[member.athleteId] ?? false}
                        onChange={(e) => setInjuryOverrides((prev) => ({ ...prev, [member.athleteId]: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      Build a standard progression anyway
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Check this, then click &ldquo;Preview for group&rdquo; again to generate their plan.
                    </p>
                  </div>
                );
              }
              return (
                <div key={member.athleteId} className="rounded-control border border-black/10 p-2 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{member.name}</span>
                    <span
                      className={`text-xs font-semibold ${member.conflict ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    >
                      {member.conflict ? "Conflict" : "Ready"}
                    </span>
                  </div>
                  {member.conflict ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        Overlaps {member.conflict.phaseType}
                        {member.conflict.name ? ` — ${member.conflict.name}` : ""} ({member.conflict.startDate} – {member.conflict.endDate})
                      </p>
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={clearDecisions[member.athleteId] ?? false}
                          onChange={(e) => setClearDecisions((prev) => ({ ...prev, [member.athleteId]: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        Clear the overlapping phase and assign
                      </label>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Left unchecked, this athlete is skipped.</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={isPending || willAssignCount === 0} onClick={handleAssign}>
              {isPending ? "Assigning…" : `Assign to ${willAssignCount} athlete${willAssignCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
