"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";

import { parseFit } from "@/lib/route-import/parse-fit";
import { parseGpx } from "@/lib/route-import/parse-gpx";
import { parseTcx } from "@/lib/route-import/parse-tcx";
import { summarizeRoute, type RouteSummary } from "@/lib/route-import/route-summary";
import type { ParsedRoute } from "@/lib/route-import/types";
import { formatClock } from "@/lib/running-format";
import { fetchActivityRoute, listRecentRunActivities, type StravaActivitySummary } from "@/lib/strava/route-actions";
import { segmentedButtonClass, statCardClass } from "@/lib/tool-styles";

type ImportSource = "file" | "strava";
type Status = "idle" | "loading" | "error" | "loaded";

function milesFromMeters(m: number): string {
  return (m / 1609.344).toFixed(2);
}

function feetFromMeters(m: number): number {
  return Math.round(m * 3.28084);
}

async function parseRouteFile(file: File): Promise<ParsedRoute> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "gpx") return parseGpx(await file.text());
  if (extension === "tcx") return parseTcx(await file.text());
  if (extension === "fit") return parseFit(await file.arrayBuffer());
  throw new Error("Please upload a .gpx, .tcx, or .fit file.");
}

export function RouteImportPanel({
  onRouteLoaded,
}: {
  /** `label` is the Strava activity's own title, or the uploaded file's name -- used for auto-inferring the workout type. */
  onRouteLoaded: (summary: RouteSummary, label: string) => void;
}) {
  const [source, setSource] = useState<ImportSource>("file");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const [activities, setActivities] = useState<StravaActivitySummary[] | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  function acceptRoute(route: ParsedRoute, label: string) {
    const summary = summarizeRoute(route);
    if (summary.totalDistanceM === 0) {
      throw new Error("No usable GPS points found -- this file may be from an indoor/treadmill activity.");
    }
    setStatus("loaded");
    setMessage(
      `Loaded ${label} — ${milesFromMeters(summary.totalDistanceM)} mi, ${formatClock(summary.totalTimeSeconds)}, ` +
        `${feetFromMeters(summary.elevationGainM)}ft gain / ${feetFromMeters(summary.elevationLossM)}ft loss`,
    );
    onRouteLoaded(summary, label);
  }

  async function handleFile(file: File) {
    setStatus("loading");
    setMessage(`Reading ${file.name}…`);
    try {
      const route = await parseRouteFile(file);
      acceptRoute(route, file.name);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Couldn't read that file.");
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = ""; // allow re-selecting the same file name after an error
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function loadStravaActivities() {
    setActivitiesLoading(true);
    setConnectMessage(null);
    const result = await listRecentRunActivities();
    setActivitiesLoading(false);
    if ("error" in result) {
      setConnectMessage(result.error);
      return;
    }
    setActivities(result.activities);
  }

  async function handleSelectActivity(activity: StravaActivitySummary) {
    setStatus("loading");
    setMessage(`Fetching ${activity.name}…`);
    const result = await fetchActivityRoute(activity.id, activity.startTimeIso);
    if ("error" in result) {
      setStatus("error");
      setMessage(result.error);
      return;
    }
    try {
      acceptRoute(result.route, activity.name);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Couldn't use that activity's route.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSource("file")}
          aria-pressed={source === "file"}
          className={segmentedButtonClass(source === "file")}
        >
          Upload a file
        </button>
        <button
          type="button"
          onClick={() => {
            setSource("strava");
            if (!activities && !activitiesLoading) void loadStravaActivities();
          }}
          aria-pressed={source === "strava"}
          className={segmentedButtonClass(source === "strava")}
        >
          🟠 Import from Strava
        </button>
      </div>

      {source === "file" ? (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="rounded-lg border-2 border-dashed border-black/15 p-6 text-center dark:border-white/15"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Drag a .gpx, .tcx, or .fit file here, or</p>
          <label className="mt-2 inline-block cursor-pointer text-sm font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white">
            browse for a file
            <input type="file" accept=".gpx,.tcx,.fit" onChange={handleFileInputChange} className="sr-only" />
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          {activitiesLoading && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading your recent activities…</p>
          )}
          {connectMessage && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {connectMessage}{" "}
              <Link
                href="/dashboard"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Go to your dashboard
              </Link>
              .
            </p>
          )}
          {activities && activities.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">No runs found in the last 90 days.</p>
          )}
          {activities && activities.length > 0 && (
            <div className={`${statCardClass} max-h-64 overflow-y-auto`}>
              <ul className="divide-y divide-black/5 dark:divide-white/5">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelectActivity(activity)}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm text-zinc-700 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
                    >
                      <span className="min-w-0 truncate">{activity.name}</span>
                      <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-300">
                        {activity.date} · {milesFromMeters(activity.distanceM)} mi
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {status !== "idle" && message && (
        <p
          className={`text-sm ${status === "error" ? "font-semibold text-red-700 dark:text-red-400" : "text-zinc-600 dark:text-zinc-300"}`}
        >
          {status === "loaded" ? "✓ " : ""}
          {message}
        </p>
      )}
    </div>
  );
}
