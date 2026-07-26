"use client";

import { useState } from "react";

import { getActivityDecoupling } from "@/lib/strava/route-actions";
import type { DecouplingResult } from "@/lib/aerobic-decoupling";

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "no-data" } | { status: "done"; result: DecouplingResult };

export function AerobicDecouplingCheck({ stravaActivityId }: { stravaActivityId: number }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function check() {
    setState({ status: "loading" });
    const result = await getActivityDecoupling(stravaActivityId);
    if ("error" in result) {
      setState({ status: "error", message: result.error });
    } else if (!result.decoupling) {
      setState({ status: "no-data" });
    } else {
      setState({ status: "done", result: result.decoupling });
    }
  }

  if (state.status === "idle") {
    return (
      <button
        type="button"
        onClick={() => void check()}
        className="mt-1 text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
      >
        Check aerobic decoupling
      </button>
    );
  }

  if (state.status === "loading") {
    return <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Checking…</p>;
  }

  if (state.status === "error") {
    return <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{state.message}</p>;
  }

  if (state.status === "no-data") {
    return <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">No heart-rate data recorded for this run.</p>;
  }

  const { result } = state;
  const direction = result.decouplingPct >= 0 ? "higher" : "lower";

  return (
    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
      Aerobic decoupling: {result.decouplingPct >= 0 ? "+" : ""}
      {result.decouplingPct.toFixed(1)}% ({Math.round(result.firstHalfAvgHr)} → {Math.round(result.secondHalfAvgHr)} bpm{" "}
      {direction} in the second half at a similar pace). Under 5% suggests a well-developed aerobic base for this
      effort; over 10% often reflects heat, fueling, or fatigue.
    </p>
  );
}
