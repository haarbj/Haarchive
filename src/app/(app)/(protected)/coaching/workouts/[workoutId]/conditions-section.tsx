"use client";

import { useState, useTransition } from "react";

import { formatClock } from "@/lib/running-format";
import { metersToFeet } from "@/lib/altitude-adjusted-pace-math";
import type { ConditionsAnalysis } from "@/lib/private-coaching/completion-conditions-service";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { triggerConditionsAnalysis } from "./completion-actions";

const FACTOR_LABELS: Record<string, string> = {
  heat_humidity: "Heat & humidity",
  wind: "Wind",
  grade: "Grade / hills",
};

// Same signed-seconds convention as equivalent-performance-bar.tsx (the
// Environmental Calculator's own breakdown display) -- same voice, same
// numbers discipline, just without that component's EngineResult-shaped
// props (confidence bounds, icons) this simpler per-factor list doesn't
// carry. See completed-workout-conditions.ts's own header comment for
// why this breakdown isn't literally an EngineResult.
function formatSignedSeconds(seconds: number): string {
  const rounded = Math.round(Math.abs(seconds));
  if (rounded === 0) return "±0s";
  const sign = seconds > 0 ? "+" : "−";
  return `${sign}${rounded}s/mi`;
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function msToMph(ms: number): number {
  return ms / 0.44704;
}

// Conditions-adjusted actuals: shown on the workout detail page for a
// Strava-matched completion only (see this file's own hasStravaActivity
// prop) -- a manually-logged completion has no GPS to analyze, so the
// whole section is simply absent for it, never a nag. Athlete and coach
// see the exact same facts; only the "Analyze conditions"/"Retry" action
// itself is gated by completed_workouts' own RLS (see
// triggerConditionsAnalysis's own comment).
export function ConditionsSection({
  scheduledWorkoutId,
  hasStravaActivity,
  analysis,
}: {
  scheduledWorkoutId: string;
  hasStravaActivity: boolean;
  analysis: ConditionsAnalysis | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!hasStravaActivity) return null;

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await triggerConditionsAnalysis(scheduledWorkoutId);
      if (result.error) setError(result.error);
    });
  }

  const status = isPending ? "analyzing" : analysis?.status ?? "not_analyzed";

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Conditions</p>

      {status === "not_analyzed" ? (
        <div className="mt-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            See what this run was worth once heat, wind, and hills are accounted for.
          </p>
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={handleAnalyze}>
              Analyze conditions
            </Button>
          </div>
        </div>
      ) : status === "analyzing" || status === "pending" ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Analyzing…</p>
      ) : status === "failed" ? (
        <div className="mt-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{analysis?.error ?? "Couldn't analyze this run's conditions."}</p>
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={handleAnalyze} disabled={isPending}>
              {isPending ? "Retrying…" : "Retry"}
            </Button>
          </div>
        </div>
      ) : (
        <ReadyConditions analysis={analysis!} />
      )}

      {error ? <FormError className="mt-2">{error}</FormError> : null}
    </div>
  );
}

function ReadyConditions({ analysis }: { analysis: ConditionsAnalysis }) {
  const conditions = analysis.conditions?.[0] ?? null;
  const topFactors = (analysis.factors ?? []).filter((f) => Math.round(Math.abs(f.secPerMi)) > 0);

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-zinc-900 dark:text-white">
        {analysis.actualPaceSPerMi != null ? `${formatClock(Math.round(analysis.actualPaceSPerMi))}/mi` : "—"}
        {" in these conditions = "}
        {analysis.idealPaceSPerMi != null ? `${formatClock(Math.round(analysis.idealPaceSPerMi))}/mi` : "—"}
        {" on an ideal day"}
      </p>

      {analysis.actualTimeS != null && analysis.idealTimeS != null ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatClock(Math.round(analysis.actualTimeS))} actual · {formatClock(Math.round(analysis.idealTimeS))} ideal-equivalent
        </p>
      ) : null}

      {topFactors.length > 0 ? (
        <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {topFactors.map((factor) => (
            <li key={factor.factor}>
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">{FACTOR_LABELS[factor.factor] ?? factor.label}:</span>{" "}
              {formatSignedSeconds(factor.secPerMi)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Conditions were close enough to ideal that nothing moved the needle.</p>
      )}

      {conditions ? (
        <details className="text-xs text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer">Conditions used{(analysis.conditions?.length ?? 0) > 1 ? ` (first of ${analysis.conditions!.length} readings)` : ""}</summary>
          <p className="mt-1">
            {cToF(conditions.tempC).toFixed(0)}°F ({conditions.tempC.toFixed(0)}°C) · {conditions.relativeHumidityPct.toFixed(0)}% humidity ·{" "}
            {msToMph(conditions.windSpeedMS).toFixed(0)} mph wind
            {conditions.elevationM != null ? ` · ${Math.round(metersToFeet(conditions.elevationM))} ft elevation` : ""}
          </p>
        </details>
      ) : null}

      {analysis.computedAt ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Analyzed {new Date(analysis.computedAt).toLocaleString()}</p>
      ) : null}
    </div>
  );
}
